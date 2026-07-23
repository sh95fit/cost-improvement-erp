/**
 * 파일: src/features/consumption/services/auto-create-pending-consumption-headers.service.ts
 * 목적: MealPlan CONFIRMED→IN_PROGRESS 전이 시 축 A(AUTO_MEAL_PLAN) Pending ConsumptionHeader 자동 upsert.
 * 근거: 감사서 §9-1 R5-P, §9-10 스키마 매핑 (2026-07-23).
 * 트리거: src/features/meal-plan/services/meal-plan.service.ts:updateMealPlanGroup (CONFIRMED→IN_PROGRESS / IN_PROGRESS→COMPLETED)
 *
 * enum 축 구분 (P15):
 *   - Header 축: ConsumptionHeaderSource.AUTO_MEAL_PLAN (본 서비스 사용)
 *   - Item   축: ConsumptionSourceType.MEAL_PLAN_AUTO   (본 서비스 미사용, R5-R2/R8 이관)
 *
 * idempotent: unique(mealPlanGroupId, locationId, productionLineId, source) 재사용, update no-op.
 * 즉 기존 PENDING·CONFIRMED·CANCELLED Header 모두 보존.
 */

import type { Prisma } from "@prisma/client";

export const AUTO_CREATE_PENDING_HEADERS_ERRORS = {
  GROUP_NOT_FOUND: "MEAL_PLAN_GROUP_NOT_FOUND",
} as const;

export class MealPlanGroupNotFoundError extends Error {
  constructor(mealPlanGroupId: string) {
    super(`${AUTO_CREATE_PENDING_HEADERS_ERRORS.GROUP_NOT_FOUND}: ${mealPlanGroupId}`);
    this.name = "MealPlanGroupNotFoundError";
  }
}

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
  tx: Prisma.TransactionClient,
  input: AutoCreatePendingConsumptionHeadersInput,
): Promise<AutoCreatePendingConsumptionHeadersResult> {
  // 1) MealPlanGroup 조회 + Slot productionLine.locationId 파생
  const group = await tx.mealPlanGroup.findFirst({
    where: {
      id: input.mealPlanGroupId,
      companyId: input.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      planDate: true,
      mealPlans: {
        where: { deletedAt: null },
        select: {
          slots: {
            where: {
              deletedAt: null,
              productionLineId: { not: null },
            },
            select: {
              productionLineId: true,
              productionLine: {
                select: { locationId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!group) {
    throw new MealPlanGroupNotFoundError(input.mealPlanGroupId);
  }

  // 2) (locationId, productionLineId) unique set 추출
  //    productionLineId 는 nullable 이나 위 where 필터로 not-null 만 조회됨.
  const comboMap = new Map<string, { locationId: string; productionLineId: string }>();
  for (const mp of group.mealPlans) {
    for (const slot of mp.slots) {
      // productionLine 은 slot.productionLineId not-null 필터에 의해 존재 보장.
      // 그러나 productionLine 자체가 soft-delete 되었을 가능성은 이 시점에서 없음(FK).
      if (!slot.productionLineId || !slot.productionLine) continue;
      const key = `${slot.productionLine.locationId}|${slot.productionLineId}`;
      if (!comboMap.has(key)) {
        comboMap.set(key, {
          locationId: slot.productionLine.locationId,
          productionLineId: slot.productionLineId,
        });
      }
    }
  }

  // 3) 조합별 upsert (idempotent, update no-op)
  let created = 0;
  let existing = 0;

  for (const combo of comboMap.values()) {
    const before = await tx.consumptionHeader.findUnique({
      where: {
        mealPlanGroupId_locationId_productionLineId_source: {
          mealPlanGroupId: input.mealPlanGroupId,
          locationId: combo.locationId,
          productionLineId: combo.productionLineId,
          source: "AUTO_MEAL_PLAN",
        },
      },
      select: { id: true },
    });

    await tx.consumptionHeader.upsert({
      where: {
        mealPlanGroupId_locationId_productionLineId_source: {
          mealPlanGroupId: input.mealPlanGroupId,
          locationId: combo.locationId,
          productionLineId: combo.productionLineId,
          source: "AUTO_MEAL_PLAN",
        },
      },
      create: {
        companyId: input.companyId,
        mealPlanGroupId: input.mealPlanGroupId,
        locationId: combo.locationId,
        productionLineId: combo.productionLineId,
        consumedDate: group.planDate,
        source: "AUTO_MEAL_PLAN",
        status: "PENDING",
        createdByUserId: input.actorUserId,
      },
      update: {}, // no-op: 기존 상태 보존
    });

    if (before) {
      existing++;
    } else {
      created++;
    }
  }

  return { created, existing };
}
