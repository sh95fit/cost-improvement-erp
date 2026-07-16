import { prisma } from "@/lib/prisma";
import { MealPlanStatus } from "@prisma/client";

/**
 * ════════════════════════════════════════
 * S4-3-c-4-1 — 확정 대기 식단 조회 서비스
 * ════════════════════════════════════════
 *
 * 사용 처리(P13)는 `MealPlanGroup.status = COMPLETED` 이후에만 가능하다.
 * 사용자가 "왜 이 식단은 사용처리 안 되지?" 를 인지할 수 있도록,
 * COMPLETED 직전 단계인 `CONFIRMED` 상태의 MealPlanGroup 목록을 노출한다.
 *
 * 노출 대상:
 *   - `status = CONFIRMED` (발주서 생성 가능, 사용처리 직전)
 *
 * 제외:
 *   - `DRAFT` — 발주서 생성 불가 단계이므로 노이즈
 *   - `COMPLETED` — 이미 사용 처리 가능 (정상 리스트에 노출)
 *   - `CANCELLED` — 폐기됨
 *
 * 정렬: `planDate ASC` (임박한 것부터)
 *
 * 주의: MealPlanGroup 스키마에는 식수 집계 필드가 없다. 배너에서 식수
 *       요약이 필요해지면 별도로 MealCount 조인/집계를 추가한다 (c-4-2 이후).
 */
export type PendingMealPlanRow = {
  id: string;
  planDate: Date;
  status: MealPlanStatus;
};

export async function listPendingMealPlans(
  companyId: string,
): Promise<PendingMealPlanRow[]> {
  const rows = await prisma.mealPlanGroup.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: MealPlanStatus.CONFIRMED,
    },
    select: {
      id: true,
      planDate: true,
      status: true,
    },
    orderBy: [{ planDate: "asc" }],
  });

  return rows;
}
