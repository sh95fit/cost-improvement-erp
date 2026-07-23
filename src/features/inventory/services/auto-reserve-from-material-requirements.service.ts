/**
 * 파일: src/features/inventory/services/auto-reserve-from-material-requirements.service.ts
 * 목적: MealPlan CONFIRMED→IN_PROGRESS 전이 시 MaterialRequirement 기반 예약(InventoryReservation) 자동 생성.
 * 근거: 감사서 §9-1 R5-R1, §9-3 P16 정정, §9-4 실패 정책, §9-10 매핑, §9-11 Location 경계 (2026-07-23).
 * 트리거: src/features/meal-plan/services/meal-plan.service.ts:updateMealPlanGroup
 *
 * P16 예약 4요소:
 *   - InventoryLot: remainingQty > 0 (활성 lot, status enum 없음)
 *   - InventoryReservation.useDate = MealPlanGroup.planDate
 *   - referenceType = "MATERIAL_REQUIREMENT", referenceId = MaterialRequirement.id
 *   - MaterialRequirement 의 (locationId, productionLineId, lineupId) 일치
 *
 * P4 준수 (§9-11):
 *   - Lot 조회 시 locationId = mr.locationId 강제. 다른 Location 의 lot 합산 금지.
 *   - MR.locationId 는 FACTORY/HYBRID 소속 ProductionLine 에서 파생됨을 신뢰 (방어 검증 생략).
 *
 * FIFO: InventoryLot.receivedAt asc (입고 확정일).
 *
 * 재산출 정책 (D-R5-R1-a α):
 *   FINAL 진입 시 기존 ESTIMATED 예약을 전부 release (reason=MANUAL_CANCEL) → FINAL MR 기반 재예약.
 *
 * 실패 정책 (§9-4):
 *   동일 Location 내 eligible lot 합산이 requiredQty 미달 시 InsufficientAvailableQtyError throw.
 *   상위 트랜잭션 롤백.
 *   SK 자재(전 lot 이 STOCK_KEEPING) 는 skip (§9-6).
 */

import type { MealCountSource, Prisma } from "@prisma/client";

import { isReservationEligibleLot } from "@/features/inventory/lib/reservation-eligibility";
import {
  createReservation,
  InsufficientAvailableQtyError,
  releaseReservation,
} from "@/features/inventory/services/reservation.service";

export const AUTO_RESERVE_ERRORS = {
  GROUP_NOT_FOUND: "MEAL_PLAN_GROUP_NOT_FOUND",
} as const;

export class MealPlanGroupNotFoundForReserveError extends Error {
  constructor(mealPlanGroupId: string) {
    super(`${AUTO_RESERVE_ERRORS.GROUP_NOT_FOUND}: ${mealPlanGroupId}`);
    this.name = "MealPlanGroupNotFoundForReserveError";
  }
}

export interface AutoReserveFromMaterialRequirementsInput {
  companyId: string;
  mealPlanGroupId: string;
  countSource: MealCountSource;
  actorUserId: string;
}

export interface AutoReserveFromMaterialRequirementsResult {
  reserved: number;   // 생성된 InventoryReservation 레코드 수
  skipped: number;    // eligible lot 이 없어 skip 된 MR 수 (SK 자재 등)
  released: number;   // release 된 기존 예약 수
}

export async function autoReserveFromMaterialRequirements(
  tx: Prisma.TransactionClient,
  input: AutoReserveFromMaterialRequirementsInput,
): Promise<AutoReserveFromMaterialRequirementsResult> {
  // 1) MealPlanGroup 조회 → planDate 획득 (useDate 축)
  const group = await tx.mealPlanGroup.findFirst({
    where: {
      id: input.mealPlanGroupId,
      companyId: input.companyId,
      deletedAt: null,
    },
    select: { id: true, planDate: true },
  });
  if (!group) {
    throw new MealPlanGroupNotFoundForReserveError(input.mealPlanGroupId);
  }

  // 2) Phase 1 — release 기존 예약 (α 정책)
  //    referenceType="MATERIAL_REQUIREMENT" AND referenceId IN (해당 그룹의 MR ids)
  //    countSource 무관 전량 release (ESTIMATED/FINAL 모두)
  const targetMrs = await tx.materialRequirement.findMany({
    where: {
      mealPlanGroupId: input.mealPlanGroupId,
      deletedAt: null,
    },
    select: { id: true },
  });
  const targetMrIds = targetMrs.map((m) => m.id);

  let released = 0;
  if (targetMrIds.length > 0) {
    const existingReservations = await tx.inventoryReservation.findMany({
      where: {
        companyId: input.companyId,
        referenceType: "MATERIAL_REQUIREMENT",
        referenceId: { in: targetMrIds },
        releasedAt: null,
      },
      select: { id: true },
    });

    for (const r of existingReservations) {
      await releaseReservation(
        {
          reservationId: r.id,
          reason: "MANUAL_CANCEL",
          actorUserId: input.actorUserId,
        },
        tx,
      );
      released++;
    }
  }

  // 3) Phase 2 — 신규 예약 (countSource 필터)
  const mrs = await tx.materialRequirement.findMany({
    where: {
      mealPlanGroupId: input.mealPlanGroupId,
      countSource: input.countSource,
      deletedAt: null,
    },
    select: {
      id: true,
      materialMasterId: true,
      requiredQty: true,
      locationId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let reserved = 0;
  let skipped = 0;

  for (const mr of mrs) {
    // FIFO lot 조회 (자재, Location 일치, 잔량 > 0)
    // §9-11: locationId 필터로 Location 경계 강제
    const lots = await tx.inventoryLot.findMany({
      where: {
        companyId: input.companyId,
        materialMasterId: mr.materialMasterId,
        locationId: mr.locationId,
        remainingQty: { gt: 0 },
      },
      orderBy: [{ receivedAt: "asc" }],
      select: {
        id: true,
        remainingQty: true,
        purchaseKind: true,
        itemType: true,
      },
    });

    // eligible lot 만 필터 (SK 등 제외)
    const eligibleLots = lots.filter(isReservationEligibleLot);

    if (eligibleLots.length === 0) {
      // 전체 lot 이 SK 이거나 아예 lot 없음 → skip (§9-6)
      skipped++;
      continue;
    }

    let remainingNeed = mr.requiredQty;
    for (const lot of eligibleLots) {
      if (remainingNeed <= 0) break;

      // 활성 예약 합산 후 available 계산
      const activeSum = await tx.inventoryReservation.aggregate({
        where: {
          inventoryLotId: lot.id,
          releasedAt: null,
        },
        _sum: { quantity: true },
      });
      const available = lot.remainingQty - (activeSum._sum.quantity ?? 0);
      if (available <= 0) continue;

      const takeQty = Math.min(available, remainingNeed);
      await createReservation(
        {
          companyId: input.companyId,
          inventoryLotId: lot.id,
          materialMasterId: mr.materialMasterId,
          quantity: takeQty,
          useDate: group.planDate,
          referenceType: "MATERIAL_REQUIREMENT",
          referenceId: mr.id,
          actorUserId: input.actorUserId,
        },
        tx,
      );
      remainingNeed -= takeQty;
      reserved++;
    }

    if (remainingNeed > 0) {
      // Location 내 eligible lot 이 있었으나 합산 부족 → 실패
      // (§9-4 롤백 트리거)
      throw new InsufficientAvailableQtyError(
        `MR ${mr.id}`,
        mr.requiredQty,
        mr.requiredQty - remainingNeed,
      );
    }
  }

  return { reserved, skipped, released };
}
