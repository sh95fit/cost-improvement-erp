/**
 * 파일: src/features/consumption/services/auto-create-pending-consumption-headers.service.ts
 * 목적: MealPlan CONFIRMED→IN_PROGRESS 전이 시 축 A(AUTO_MEAL_PLAN) Pending ConsumptionHeader 자동 upsert.
 * 근거: 감사서 §9-1 R5-P, §9-10 스키마 매핑 (2026-07-23).
 * 트리거: src/features/meal-plan/services/meal-plan.service.ts:updateMealPlanGroup (CONFIRMED→IN_PROGRESS / IN_PROGRESS→COMPLETED)
 *
 * enum 축 구분 (P15):
 *   - Header 축: ConsumptionHeaderSource.AUTO_MEAL_PLAN (본 서비스 사용)
 *   - Item   축: ConsumptionSourceType.MEAL_PLAN_AUTO   (본 서비스 미사용)
 *
 * idempotent: unique(mealPlanGroupId, locationId, productionLineId, source) 재사용, update no-op.
 */

import type { Prisma } from "@prisma/client";

export interface AutoCreatePendingConsumptionHeadersInput {
  companyId: string;
  mealPlanGroupId: string;
  actorUserId: string;
}

export interface AutoCreatePendingConsumptionHeadersResult {
  created: number;
  existing: number;
}

export async function autoCreatePendingConsumptionHeaders(
  _tx: Prisma.TransactionClient,
  _input: AutoCreatePendingConsumptionHeadersInput,
): Promise<AutoCreatePendingConsumptionHeadersResult> {
  // TODO(R5-P Commit 2): 구현
  //   1. MealPlanGroup 조회 → planDate 확보
  //   2. MealPlan[] → MealPlanSlot[] 로부터 (locationId, productionLineId) unique set 추출
  //   3. 각 조합에 대해 consumptionHeader.upsert
  //      - create: { source: AUTO_MEAL_PLAN, status: PENDING, consumedDate: planDate, createdByUserId: actorUserId, ... }
  //      - update: {} (no-op)
  //   4. { created, existing } 반환
  throw new Error("NOT_IMPLEMENTED: autoCreatePendingConsumptionHeaders (R5-P Commit 2 예정)");
}
