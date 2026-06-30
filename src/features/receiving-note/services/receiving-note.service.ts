import type { Prisma } from "@prisma/client";
import { DiscrepancyType, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import { transitionPurchaseOrderStatus } from "@/features/purchase-order/services/purchase-order.service";

type Tx = Prisma.TransactionClient;

export class ReceivingNoteNotFoundError extends Error {
  constructor(id: string) {
    super(`ReceivingNote not found: ${id}`);
    this.name = "ReceivingNoteNotFoundError";
  }
}

export class ReceivingNoteAlreadyConfirmedError extends Error {
  constructor(id: string) {
    super(`ReceivingNote already confirmed: ${id}`);
    this.name = "ReceivingNoteAlreadyConfirmedError";
  }
}

export class ReceivingNoteCompanyMismatchError extends Error {
  constructor() {
    super("ReceivingNote does not belong to the given company");
    this.name = "ReceivingNoteCompanyMismatchError";
  }
}

/**
 * D30 (2026-06-30): 입고 확정
 *
 * 단일 트랜잭션 안에서:
 *  1) ReceivingNote.status → CONFIRMED, confirmedAt/confirmedByUserId 기록
 *  2) 각 ReceivingNoteItem 당:
 *     - InventoryLot 생성 (unitCost = PO 단가, 단가 변경 금지 - P9)
 *     - InventoryTransaction(PURCHASE) 기록
 *     - PurchaseOrderItem.receivedQty 누적
 *     - 발주↔입고 불일치 시 ReceivingDiscrepancy 스냅샷
 *  3) 발주서에 매칭되지 않은 입고 항목/누락 항목 → ITEM_MISSING 스냅샷
 *  4) PurchaseOrder.status → RECEIVED (transitionPurchaseOrderStatus, 같은 tx 주입)
 *
 * 원자성: 어느 단계라도 실패 시 전체 롤백.
 */
export async function confirmReceivingNote(
  companyId: string,
  receivingNoteId: string,
  actorUserId: string,
  options?: { existingTx?: Tx },
) {
  return withTransaction(
    async (tx) => {
      // 1) 입고서 로드 + 검증
      const note = await tx.receivingNote.findUnique({
        where: { id: receivingNoteId },
        include: {
          items: true,
          purchaseOrder: {
            include: { items: true },
          },
        },
      });

      if (!note) {
        throw new ReceivingNoteNotFoundError(receivingNoteId);
      }
      if (note.companyId !== companyId) {
        throw new ReceivingNoteCompanyMismatchError();
      }
      if (note.status === "CONFIRMED") {
        throw new ReceivingNoteAlreadyConfirmedError(receivingNoteId);
      }

      const po = note.purchaseOrder;
      const poItemById = new Map(po.items.map((i) => [i.id, i]));
      const matchedPoItemIds = new Set<string>();

      // 2) 각 입고 항목 처리
      for (const rItem of note.items) {
        const poItem = rItem.purchaseOrderItemId
          ? poItemById.get(rItem.purchaseOrderItemId)
          : undefined;

        if (!poItem) {
          // 발주에 없던 항목이 입고됨
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type: DiscrepancyType.ITEM_MISSING,
              expectedQty: null,
              actualQty: rItem.quantity,
              expectedUnitPrice: null,
              actualUnitPrice: rItem.unitPrice,
              diffValue: rItem.quantity,
              reason: "발주에 없는 항목이 입고됨",
              recordedByUserId: actorUserId,
            },
          });
          continue; // 발주 항목 매칭 불가 → 재고 적재는 정책상 스킵
        }

        matchedPoItemIds.add(poItem.id);

        // 2-1) InventoryLot 생성 (P9: 단가는 PO 단가 고정)
        const lot = await tx.inventoryLot.create({
          data: {
            companyId,
            itemType: poItem.itemType,
            materialMasterId: poItem.materialMasterId,
            subsidiaryMasterId: poItem.subsidiaryMasterId,
            locationId: po.locationId,
            supplierItemId: poItem.supplierItemId,
            receivingNoteItemId: rItem.id,
            initialQty: rItem.quantity,
            remainingQty: rItem.quantity,
            unitCost: poItem.unitPrice, // ★ P9: PO 확정 시점 단가 고정
            receivedAt: note.receivedDate,
          },
        });

        // 2-2) InventoryTransaction(PURCHASE) 기록
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            type: TransactionType.PURCHASE,
            itemType: poItem.itemType,
            materialMasterId: poItem.materialMasterId,
            subsidiaryMasterId: poItem.subsidiaryMasterId,
            locationId: po.locationId,
            lotId: lot.id,
            quantity: rItem.quantity,
            unitCost: poItem.unitPrice,
            referenceType: "RECEIVING_NOTE",
            referenceId: note.id,
            occurredAt: note.receivedDate,
            createdByUserId: actorUserId,
          },
        });

        // 2-3) PO 항목 누적 수량 업데이트
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: { increment: rItem.quantity } },
        });

        // 2-4) 불일치 스냅샷 (수량)
        const qtyDiff = rItem.quantity - poItem.quantity;
        if (qtyDiff !== 0) {
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              purchaseOrderItemId: poItem.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type:
                qtyDiff < 0
                  ? DiscrepancyType.QUANTITY_SHORT
                  : DiscrepancyType.QUANTITY_OVER,
              expectedQty: poItem.quantity,
              actualQty: rItem.quantity,
              expectedUnitPrice: poItem.unitPrice,
              actualUnitPrice: rItem.unitPrice,
              diffValue: qtyDiff,
              reason: null,
              recordedByUserId: actorUserId,
            },
          });
        }

        // 2-5) 불일치 스냅샷 (단가) — P9: 기록만, 단가 변경 없음
        const priceDiff = Number(rItem.unitPrice) - Number(poItem.unitPrice);
        if (priceDiff !== 0) {
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              purchaseOrderItemId: poItem.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type: DiscrepancyType.UNIT_PRICE_DIFF,
              expectedQty: poItem.quantity,
              actualQty: rItem.quantity,
              expectedUnitPrice: poItem.unitPrice,
              actualUnitPrice: rItem.unitPrice,
              diffValue: priceDiff,
              reason: "입고 단가가 발주 단가와 다름 (기록 전용, 단가 변경 없음)",
              recordedByUserId: actorUserId,
            },
          });
        }
      }

      // 3) 발주에 있었지만 입고에는 없는 항목 → ITEM_MISSING
      for (const poItem of po.items) {
        if (matchedPoItemIds.has(poItem.id)) continue;
        await tx.receivingDiscrepancy.create({
          data: {
            companyId,
            purchaseOrderId: po.id,
            purchaseOrderItemId: poItem.id,
            receivingNoteId: note.id,
            receivingNoteItemId: null,
            type: DiscrepancyType.ITEM_MISSING,
            expectedQty: poItem.quantity,
            actualQty: 0,
            expectedUnitPrice: poItem.unitPrice,
            actualUnitPrice: null,
            diffValue: -poItem.quantity,
            reason: "발주에 있었으나 입고되지 않음",
            recordedByUserId: actorUserId,
          },
        });
      }

      // 4) 입고서 상태 갱신
      const updatedNote = await tx.receivingNote.update({
        where: { id: note.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedByUserId: actorUserId,
        },
      });

      // 5) 발주서 상태 → RECEIVED (같은 tx 주입)
      await transitionPurchaseOrderStatus(
        companyId,
        po.id,
        "RECEIVED",
        { existingTx: tx },
      );

      return updatedNote;
    },
    { existingTx: options?.existingTx },
  );
}
