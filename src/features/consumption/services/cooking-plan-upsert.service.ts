import type { Prisma } from "@prisma/client";

/**
 * 지정한 location + 날짜의 CookingPlan을 조회하거나 생성.
 * ConsumptionItem 은 cookingPlanId 를 통해서만 locationId 를 간접 참조하므로
 * confirmConsumption 시점에 반드시 확보되어야 함.
 *
 * 대표 productionLine 선정: 해당 location 의 productionLine 중 createdAt 오름차순 1건.
 * 향후 UI에서 명시 선택할 수 있도록 확장 여지 있음.
 */
export async function getOrCreateCookingPlanForConsumption(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    locationId: string;
    planDate: Date; // UTC 자정 정규화된 값
  },
): Promise<string> {
  const { companyId, locationId, planDate } = params;

  const line = await tx.productionLine.findFirst({
    where: { companyId, locationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!line) {
    throw new Error(
      `해당 location(${locationId}) 에 등록된 ProductionLine 이 없습니다.`,
    );
  }

  const existing = await tx.cookingPlan.findFirst({
    where: {
      companyId,
      productionLineId: line.id,
      planDate,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.cookingPlan.create({
    data: {
      companyId,
      productionLineId: line.id,
      planDate,
      status: "DRAFT",
      note: "auto-created by confirmConsumption",
    },
    select: { id: true },
  });
  return created.id;
}
