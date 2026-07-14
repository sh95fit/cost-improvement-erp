import { prisma } from "@/lib/prisma";
import { MealPlanStatus } from "@prisma/client";

/**
 * ════════════════════════════════════════
 * S4-3-a — 사용 처리 진입 가드 서비스
 * ════════════════════════════════════════
 *
 * 헌법 P13: 사용 처리는 `MealPlan.status = COMPLETED` 이후에만 진입 가능.
 * 스키마 실측: MealPlan 자체에는 status 컬럼이 없으며, 상위 `MealPlanGroup.status`
 * 가 판정 축. `(companyId, planDate)` 로 유니크.
 *
 * ⚠️ locationId 는 시그니처상 받지만 스키마상 MealPlanGroup 이 locationId 를
 * 갖지 않으므로 판정에 사용하지 않는다. UI 라우팅 축·향후 확장·감사 로그
 * 스코프용으로 보존한다 (P13 컨텍스트 계약 유지).
 */

export class MealPlanNotCompletedForConsumptionError extends Error {
  constructor(
    public readonly companyId: string,
    public readonly targetDate: Date,
    public readonly locationId: string,
    public readonly actualStatus: MealPlanStatus | null,
  ) {
    super(
      `MealPlanGroup 이 COMPLETED 상태가 아니어서 사용 처리 진입 불가: ` +
        `companyId=${companyId}, planDate=${targetDate.toISOString().slice(0, 10)}, ` +
        `locationId=${locationId}, actualStatus=${actualStatus ?? "NOT_FOUND"}`,
    );
    this.name = "MealPlanNotCompletedForConsumptionError";
  }
}

/**
 * 사용 처리 진입 가드.
 *
 * 진입 조건 (P13):
 *   해당 (companyId, targetDate) 의 MealPlanGroup.status === COMPLETED.
 *
 * 실패 시 `MealPlanNotCompletedForConsumptionError` throw (action 계층에서
 * `MEAL_PLAN_NOT_COMPLETED_FOR_CONSUMPTION` 코드로 매핑).
 *
 * @param companyId  현재 세션의 회사 ID
 * @param targetDate 사용 처리 대상 일자 (시간 부분 무시, planDate 는 @db.Date)
 * @param locationId 대상 공장/거점 ID (판정에는 사용하지 않음, 계약 유지용)
 */
export async function assertMealPlanCompletedForConsumption(
  companyId: string,
  targetDate: Date,
  locationId: string,
): Promise<void> {
  // planDate 는 @db.Date 이므로 자정으로 정규화 (시분초 제거)
  const normalizedDate = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
    ),
  );

  const group = await prisma.mealPlanGroup.findFirst({
    where: {
      companyId,
      planDate: normalizedDate,
      deletedAt: null,
    },
    select: { id: true, status: true },
  });

  if (!group || group.status !== MealPlanStatus.COMPLETED) {
    throw new MealPlanNotCompletedForConsumptionError(
      companyId,
      normalizedDate,
      locationId,
      group?.status ?? null,
    );
  }
}
