/**
 * 파일: src/features/inventory/services/auto-reserve-on-receiving-confirm.service.ts
 * 목적: ReceivingNote 가 CONFIRMED 로 전이될 때, 해당 노트의 위저드 발주 항목에 대해
 *       InventoryReservation 을 자동 생성.
 * 근거: 감사서 §0 원칙 1·2, §9-14, §11-2 R14 (2026-07-30).
 * 트리거: src/features/receiving-note/services/receiving-note.service.ts:confirmReceivingNote
 *
 * 스코프 (§9-14-1):
 *   - 위저드 발주(materialRequirementId 존재) → 예약 생성.
 *   - 수동 발주(materialRequirementId=null) → skip.
 *   - 부자재(SUBSIDIARY) Lot → skip (InventoryReservation 스키마에 subsidiaryMasterId 없음, §10 D-R6-f α).
 *
 * 예약 축 (§9-14-3):
 *   - referenceType = "MATERIAL_REQUIREMENT"
 *   - referenceId = MaterialRequirement.id
 *   - useDate = MealPlanGroup.planDate
 *   - inventoryLotId = InventoryLot.receivingNoteItemId 역방향 조회
 *   - materialMasterId = InventoryLot.materialMasterId
 *
 * 수량 정책 (§0 원칙 2 · §9-14-4):
 *   - quantity = ReceivingNoteItem.receivedQty (수량 상한 없음, 독립 누적).
 *
 * 실패 정책 (§0 원칙 3 · §9-14-6):
 *   - 재고 부족 검증 없음 (입고분 자체가 예약 대상).
 *   - Lot 미조회 시 skip (트랜잭션 순서 위반이면 상위 for 루프에서 이미 검증됨).
 *   - MR 미조회 시 skip (soft-delete 등).
 *
 * 중복 방지 (§9-14-7):
 *   - ReceivingNoteAlreadyConfirmedError 로 자연 충족 (재실행 방어).
 *   - 별도 중복 체크 없음 — 동일 MR 다중 예약 허용 (§0 원칙 2).
 */

import type { Prisma } from "@prisma/client";

export const AUTO_RESERVE_ON_RECEIVE_ERRORS = {
  NOTE_NOT_FOUND: "RECEIVING_NOTE_NOT_FOUND",
} as const;

export class ReceivingNoteNotFoundForReserveError extends Error {
  constructor(receivingNoteId: string) {
    super(`${AUTO_RESERVE_ON_RECEIVE_ERRORS.NOTE_NOT_FOUND}: ${receivingNoteId}`);
    this.name = "ReceivingNoteNotFoundForReserveError";
  }
}

export interface AutoReserveOnReceivingConfirmInput {
  companyId: string;
  receivingNoteId: string;
  actorUserId: string;
}

export interface AutoReserveOnReceivingConfirmResult {
  reserved: number;
  skipped: number;
}

export async function autoReserveOnReceivingConfirm(
  tx: Prisma.TransactionClient,
  input: AutoReserveOnReceivingConfirmInput,
): Promise<AutoReserveOnReceivingConfirmResult> {
  // 1) ReceivingNote 존재 확인 (companyId 격리) + items + purchaseOrderItem 조회
  const note = await tx.receivingNote.findFirst({
    where: {
      id: input.receivingNoteId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      items: {
        select: {
          id: true,
          receivedQty: true,
          purchaseOrderItem: {
            select: {
              materialRequirementId: true,
            },
          },
        },
      },
    },
  });
  if (!note) {
    throw new ReceivingNoteNotFoundForReserveError(input.receivingNoteId);
  }

  let reserved = 0;
  let skipped = 0;

  // 2) 각 ReceivingNoteItem 순회
  for (const rItem of note.items) {
    const materialRequirementId = rItem.purchaseOrderItem.materialRequirementId;

    // 2-a) 수동 발주 skip (§9-14-5)
    if (!materialRequirementId) {
      skipped += 1;
      continue;
    }

    // 2-b) MR 조회 (planDate 파생용, soft-delete 제외)
    const mr = await tx.materialRequirement.findFirst({
      where: {
        id: materialRequirementId,
        companyId: input.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        mealPlanGroup: {
          select: { planDate: true },
        },
      },
    });
    if (!mr) {
      skipped += 1;
      continue;
    }

    // 2-c) Lot 역방향 조회 (§9-14-3, H-89 실측 정정)
    const lot = await tx.inventoryLot.findFirst({
      where: {
        receivingNoteItemId: rItem.id,
        companyId: input.companyId,
      },
      select: {
        id: true,
        itemType: true,
        materialMasterId: true,
      },
    });
    if (!lot) {
      skipped += 1;
      continue;
    }

    // 2-d) 부자재 skip (§10 D-R6-f α, InventoryReservation 스키마에 subsidiaryMasterId 없음)
    if (!lot.materialMasterId) {
      skipped += 1;
      continue;
    }

    // 2-e) 예약 생성 (§0 원칙 2, 독립 누적, 중복 체크 없음)
    await tx.inventoryReservation.create({
      data: {
        companyId: input.companyId,
        inventoryLotId: lot.id,
        materialMasterId: lot.materialMasterId,
        referenceType: "MATERIAL_REQUIREMENT",
        referenceId: mr.id,
        quantity: rItem.receivedQty,
        useDate: mr.mealPlanGroup.planDate,
      },
    });
    reserved += 1;
  }

  return { reserved, skipped };
}