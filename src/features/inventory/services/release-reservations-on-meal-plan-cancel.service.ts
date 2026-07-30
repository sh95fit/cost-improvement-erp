/**
 * 파일: src/features/inventory/services/release-reservations-on-meal-plan-cancel.service.ts
 * 목적: MealPlanGroup 이 CANCELLED 로 전이될 때, 해당 그룹의 MaterialRequirement 를
 *       참조하는 활성 InventoryReservation 을 일괄 release.
 * 근거: 감사서 §9-5, §11-3 R15 (2026-07-23).
 * 트리거: src/features/meal-plan/services/meal-plan.service.ts:updateMealPlanGroup
 *
 * 범위 (§11-3):
 *   - 활성 Reservation (releasedAt IS NULL) 만 release.
 *   - MR soft-delete · PENDING Consumption 정리는 본 서비스 범위 밖 (R5-R1-B/R12 전담).
 *
 * 해제 사유:
 *   - ReservationReleaseReason "MANUAL_CANCEL" 재사용 (신규 사유 추가 없음).
 *
 * 감사 로그:
 *   - releaseReservation 이 트랜잭션 내부에서 자동 기록 (§S4-0-d).
 *   - 본 서비스는 별도 감사 로그 기록 없음.
 *
 * 실패 정책:
 *   - MealPlanGroup 미존재 시 MealPlanGroupNotFoundForCancelError throw → 상위 롤백.
 *   - 개별 releaseReservation 예외는 상위 트랜잭션 롤백.
 */

import type { Prisma } from "@prisma/client";

import { releaseReservation } from "@/features/inventory/services/reservation.service";

export const RELEASE_ON_CANCEL_ERRORS = {
  GROUP_NOT_FOUND: "MEAL_PLAN_GROUP_NOT_FOUND",
} as const;

export class MealPlanGroupNotFoundForCancelError extends Error {
  constructor(mealPlanGroupId: string) {
    super(`${RELEASE_ON_CANCEL_ERRORS.GROUP_NOT_FOUND}: ${mealPlanGroupId}`);
    this.name = "MealPlanGroupNotFoundForCancelError";
  }
}

export interface ReleaseReservationsOnMealPlanCancelInput {
  companyId: string;
  mealPlanGroupId: string;
  actorUserId: string;
}

export interface ReleaseReservationsOnMealPlanCancelResult {
  released: number;
}

export async function releaseReservationsOnMealPlanCancel(
  tx: Prisma.TransactionClient,
  input: ReleaseReservationsOnMealPlanCancelInput,
): Promise<ReleaseReservationsOnMealPlanCancelResult> {
  // 1) 그룹 존재 확인 (companyId 격리 + soft-delete 제외)
  const group = await tx.mealPlanGroup.findFirst({
    where: {
      id: input.mealPlanGroupId,
      companyId: input.companyId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!group) {
    throw new MealPlanGroupNotFoundForCancelError(input.mealPlanGroupId);
  }

  // 2) 해당 그룹의 활성 MR id 조회
  const mrs = await tx.materialRequirement.findMany({
    where: {
      mealPlanGroupId: input.mealPlanGroupId,
      companyId: input.companyId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (mrs.length === 0) {
    return { released: 0 };
  }
  const mrIds = mrs.map((m) => m.id);

  // 3) MR 참조 활성 Reservation 조회
  const reservations = await tx.inventoryReservation.findMany({
    where: {
      companyId: input.companyId,
      referenceType: "MATERIAL_REQUIREMENT",
      referenceId: { in: mrIds },
      releasedAt: null,
    },
    select: { id: true },
  });

  // 4) 각 예약을 MANUAL_CANCEL 사유로 release
  //    releaseReservation 이 감사 로그를 트랜잭션 내부에서 기록
  let released = 0;
  for (const r of reservations) {
    await releaseReservation(
      {
        reservationId: r.id,
        reason: "MANUAL_CANCEL",
        actorUserId: input.actorUserId,
      },
      tx,
    );
    released += 1;
  }

  return { released };
}
