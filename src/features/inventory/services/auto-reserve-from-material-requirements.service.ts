/**
 * 파일: src/features/inventory/services/auto-reserve-from-material-requirements.service.ts
 * 목적: MealPlan CONFIRMED→IN_PROGRESS 전이 시 MaterialRequirement 기반 예약(InventoryReservation) 자동 생성.
 * 근거: 감사서 §9-1 R5-R1, §9-3 P16 정정, §9-4 실패 정책, §9-10 매핑 (2026-07-23).
 * 트리거: src/features/meal-plan/services/meal-plan.service.ts:updateMealPlanGroup
 *
 * P16 예약 4요소:
 *   - InventoryLot.status = ACTIVE
 *   - InventoryReservation.useDate = MealPlanGroup.planDate
 *   - referenceType = "MATERIAL_REQUIREMENT", referenceId = MaterialRequirement.id
 *   - MaterialRequirement 의 (locationId, productionLineId, lineupId) 일치
 *
 * 재산출 정책 (D-R5-1-a α):
 *   FINAL 진입 시 기존 ESTIMATED 예약을 전부 release → FINAL MR 기반 재예약.
 *
 * 실패 정책 (§9-4):
 *   isReservationEligibleLot 통과 후에도 재고 부족 시 InsufficientAvailableQtyError throw.
 *   상위 트랜잭션 롤백.
 */

import type { MealCountSource, Prisma } from "@prisma/client";

export interface AutoReserveFromMaterialRequirementsInput {
  companyId: string;
  mealPlanGroupId: string;
  countSource: MealCountSource;
  actorUserId: string;
}

export interface AutoReserveFromMaterialRequirementsResult {
  reserved: number;
  skipped: number;
  released: number;
}

export async function autoReserveFromMaterialRequirements(
  _tx: Prisma.TransactionClient,
  _input: AutoReserveFromMaterialRequirementsInput,
): Promise<AutoReserveFromMaterialRequirementsResult> {
  // TODO(R5-R1 Commit 3): 구현
  //   Phase 1 - release:
  //     inventoryReservation.findMany where
  //       referenceType = "MATERIAL_REQUIREMENT"
  //       AND referenceId IN (SELECT id FROM MaterialRequirement WHERE mealPlanGroupId=X AND deletedAt=NULL)
  //       AND status = ACTIVE
  //     → 전부 releaseReservation
  //   Phase 2 - create:
  //     MaterialRequirement.findMany where mealPlanGroupId=X, countSource, deletedAt=NULL
  //     for each MR:
  //       InventoryLot FIFO 조회 (materialMasterId, locationId, status=ACTIVE)
  //       isReservationEligibleLot 필터
  //       requiredQty 만큼 createReservation (referenceType, referenceId, useDate=planDate, actorUserId)
  //       부족 시 InsufficientAvailableQtyError throw
  throw new Error("NOT_IMPLEMENTED: autoReserveFromMaterialRequirements (R5-R1 Commit 3 예정)");
}
