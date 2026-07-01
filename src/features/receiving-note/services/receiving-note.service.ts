import type { Prisma } from "@prisma/client";
import { DiscrepancyType, TransactionType } from "@prisma/client";

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

export class UnsupportedSubsidiaryReceivingError extends Error {
  constructor(poItemId: string) {
    super(
      `Subsidiary 입고 트랜잭션은 현재 스키마에서 지원하지 않음 (Sprint 4 Phase 10에서 보강 예정). poItemId=${poItemId}`,
    );
    this.name = "UnsupportedSubsidiaryReceivingError";
  }
}

/**
 * D30 (2026-06-30): 입고 확정
 *
 * 단일 트랜잭션 안에서:
 *  1) ReceivingNote.status → CONFIRMED, confirmedAt/confirmedByUserId 기록
 *  2) 각 ReceivingNoteItem 당:
 *     - InventoryLot 생성 (unitPrice = PO 단가, P9: 단가 변경 금지)
 *     - InventoryTransaction(PURCHASE) 기록
 *     - PurchaseOrderItem.receivedQty 누적
 *     - 발주↔입고 불일치 시 ReceivingDiscrepancy 스냅샷
 *  3) 발주서에 매칭되지 않은 입고 항목/누락 항목 → ITEM_MISSING 스냅샷
 *  4) PurchaseOrder.status → RECEIVED (같은 tx 주입)
 *
 * 원자성: 어느 단계라도 실패 시 전체 롤백.
 *
 * 제약 (현 스키마 기준):
 *  - InventoryTransaction.materialMasterId 가 NOT NULL 이고 subsidiaryMasterId 컬럼이 없음
 *  - 따라서 SUBSIDIARY 항목 입고 확정은 Sprint 4 Phase 10 스키마 보강 후 지원
 *  - 현재는 SUBSIDIARY 발견 시 UnsupportedSubsidiaryReceivingError throw
 *
 * 용어 주의:
 *  - ReceivingNoteItem 의 "입고 수량" 컬럼은 `receivedQty`
 *  - PurchaseOrderItem 의 "발주 수량"은 `quantity`, "누적 입고 수량"은 `receivedQty`
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
        const receivedQty = rItem.receivedQty;

        const poItem = rItem.purchaseOrderItemId
          ? poItemById.get(rItem.purchaseOrderItemId)
          : undefined;

        if (!poItem) {
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type: DiscrepancyType.ITEM_MISSING,
              expectedQty: null,
              actualQty: receivedQty,
              expectedUnitPrice: null,
              actualUnitPrice: rItem.unitPrice,
              diffValue: receivedQty,
              reason: "발주에 없는 항목이 입고됨",
              recordedByUserId: actorUserId,
            },
          });
          continue;
        }

        matchedPoItemIds.add(poItem.id);

        // 부자재는 현 스키마에서 InventoryTransaction 기록 불가 → 차단
        if (poItem.itemType === "SUBSIDIARY") {
          throw new UnsupportedSubsidiaryReceivingError(poItem.id);
        }
        // MATERIAL 필수 검증
        if (!poItem.materialMasterId) {
          throw new Error(
            `PurchaseOrderItem ${poItem.id}: MATERIAL 이지만 materialMasterId 가 없음`,
          );
        }

        // 2-1) InventoryLot 생성 (P9: 단가는 PO 단가 고정)
        const lot = await tx.inventoryLot.create({
          data: {
            companyId,
            itemType: poItem.itemType,
            materialMasterId: poItem.materialMasterId,
            subsidiaryMasterId: poItem.subsidiaryMasterId,
            locationId: po.locationId,
            receivingNoteItemId: rItem.id,
            lotNumber: `${note.receiveNumber}-${rItem.id.slice(-6)}`,
            initialQty: receivedQty,
            remainingQty: receivedQty,
            unitPrice: poItem.unitPrice, // ★ P9: PO 단가 고정
            receivedAt: note.receivedDate,
          },
        });

        // 2-2) InventoryTransaction(PURCHASE) 기록
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            locationId: po.locationId,
            materialMasterId: poItem.materialMasterId,
            inventoryLotId: lot.id,
            transactionType: TransactionType.PURCHASE,
            quantity: receivedQty,
            unitPrice: poItem.unitPrice,
            referenceType: "RECEIVING_NOTE",
            referenceId: note.id,
            transactionDate: note.receivedDate,
          },
        });

        // 2-3) PO 항목 누적 수량 업데이트
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: { increment: receivedQty } },
        });

        // 2-4) 불일치 스냅샷 (수량)
        const qtyDiff = receivedQty - poItem.quantity;
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
              actualQty: receivedQty,
              expectedUnitPrice: poItem.unitPrice,
              actualUnitPrice: rItem.unitPrice,
              diffValue: qtyDiff,
              reason: null,
              recordedByUserId: actorUserId,
            },
          });
        }

        // 2-5) 불일치 스냅샷 (단가) — P9: 기록 전용
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
              actualQty: receivedQty,
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

      // 5) 발주서 상태 → RECEIVED (같은 tx 직접 전달)
      await transitionPurchaseOrderStatus(
        companyId,
        po.id,
        { toStatus: "RECEIVED", actorUserId },
        tx, // ★ 4번째 인자는 tx 자체, 옵션 객체 아님
      );

      return updatedNote;
    },
    { existingTx: options?.existingTx },
  );
}

// ════════════════════════════════════════
// D30 C-3-b1: 조회 & 초안 생성 서비스
// ════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import type {
  ReceivingNoteListQuery,
  CreateReceivingNoteDraftInput,
} from "../schemas/receiving-note.schema";

export class ReceivingNoteAlreadyExistsError extends Error {
  constructor(poId: string) {
    super(`이 발주에 대한 입고서가 이미 존재합니다: ${poId}`);
    this.name = "ReceivingNoteAlreadyExistsError";
  }
}

export class PurchaseOrderNotEligibleForReceivingError extends Error {
  constructor(poId: string, status: string) {
    super(
      `발주 상태가 입고서 작성 대상이 아닙니다 (SUBMITTED 만 허용): poId=${poId}, status=${status}`,
    );
    this.name = "PurchaseOrderNotEligibleForReceivingError";
  }
}

/**
 * 입고서 목록 조회 (페이지네이션 + 필터).
 */
export async function getReceivingNotes(
  companyId: string,
  query: ReceivingNoteListQuery,
) {
  const {
    page, limit, status, purchaseOrderId, search,
    dateFrom, dateTo, sortBy, sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status && { status }),
    ...(purchaseOrderId && { purchaseOrderId }),
    ...(search && {
      receiveNumber: { contains: search, mode: "insensitive" as const },
    }),
    ...((dateFrom || dateTo) && {
      receivedDate: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.receivingNote.findMany({
      where,
      include: {
        purchaseOrder: {
          select: {
            id: true, orderNumber: true, status: true,
            supplier: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
        confirmedByUser: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.receivingNote.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 입고서 단건 조회 (품목 + PO + 불일치 이력 포함).
 */
export async function getReceivingNoteById(companyId: string, id: string) {
  return prisma.receivingNote.findFirst({
    where: { id, companyId },
    include: {
      purchaseOrder: {
        include: {
          supplier: true,
          location: { select: { id: true, name: true, code: true } },
          productionLine: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              supplierItem: { include: { supplyUnit: true } },
              materialMaster: { select: { id: true, name: true, code: true } },
              subsidiaryMaster: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
      items: {
        include: {
          purchaseOrderItem: {
            include: {
              materialMaster: { select: { id: true, name: true, code: true } },
              subsidiaryMaster: { select: { id: true, name: true, code: true } },
              supplierItem: { include: { supplyUnit: true } },
            },
          },
        },
      },
      confirmedByUser: { select: { id: true, name: true } },
      discrepancies: {
        orderBy: { recordedAt: "desc" },
        include: {
          recordedByUser: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/**
 * 발주 상세 하단용: 이 PO 에 기록된 모든 ReceivingDiscrepancy.
 */
export async function getReceivingDiscrepanciesByPO(
  companyId: string,
  purchaseOrderId: string,
) {
  return prisma.receivingDiscrepancy.findMany({
    where: { companyId, purchaseOrderId },
    orderBy: { recordedAt: "desc" },
    include: {
      recordedByUser: { select: { id: true, name: true } },
      receivingNote: { select: { id: true, receiveNumber: true, status: true } },
      purchaseOrderItem: {
        select: {
          id: true,
          materialMaster: { select: { id: true, name: true, code: true } },
          subsidiaryMaster: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

/**
 * 입고서 초안 생성 (D30 C-3-b1).
 *
 * 정책:
 *  - 1 PO = 1 ReceivingNote (동일 PO 에 이미 노트 존재 시 ReceivingNoteAlreadyExistsError)
 *  - PO 상태는 SUBMITTED 만 허용 (그 외 PurchaseOrderNotEligibleForReceivingError)
 *  - status = DRAFT 로 생성. 확정은 별도 confirmReceivingNote 액션.
 *  - receiveNumber 자동 채번: RN-YYYYMMDD-XXX (회사+수령일 시퀀스)
 */
export async function createReceivingNoteDraft(
  companyId: string,
  input: CreateReceivingNoteDraftInput,
) {
  return prisma.$transaction(async (tx) => {
    // 1) PO 로드 + 검증
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId },
      select: { id: true, status: true },
    });
    if (!po) throw new Error("NOT_FOUND");
    if (po.status !== "SUBMITTED") {
      throw new PurchaseOrderNotEligibleForReceivingError(po.id, po.status);
    }

    // 2) 기존 노트 존재 여부 (1 PO = 1 Note)
    const existing = await tx.receivingNote.findFirst({
      where: { purchaseOrderId: po.id },
      select: { id: true },
    });
    if (existing) {
      throw new ReceivingNoteAlreadyExistsError(po.id);
    }

    // 3) receiveNumber 채번 (RN-YYYYMMDD-XXX)
    const d = input.receivedDate;
    const prefix = `RN-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`;
    const last = await tx.receivingNote.findFirst({
      where: { companyId, receiveNumber: { startsWith: prefix } },
      orderBy: { receiveNumber: "desc" },
      select: { receiveNumber: true },
    });
    let nextSeq = 1;
    if (last) {
      const seq = parseInt(last.receiveNumber.slice(prefix.length), 10);
      if (!Number.isNaN(seq)) nextSeq = seq + 1;
    }
    const receiveNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    // 4) 노트 + 아이템 생성
    return tx.receivingNote.create({
      data: {
        companyId,
        purchaseOrderId: po.id,
        receiveNumber,
        status: "DRAFT",
        receivedDate: input.receivedDate,
        note: input.note,
        items: {
          create: input.items.map((it) => ({
            purchaseOrderItemId: it.purchaseOrderItemId,
            receivedQty: it.receivedQty,
            unitPrice: it.unitPrice,
          })),
        },
      },
      include: { items: true },
    });
  });
}