import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockPrisma } from "./mocks/prisma";
import {
  autoCreatePendingConsumptionHeaders,
  MealPlanGroupNotFoundError,
} from "@/features/consumption/services/auto-create-pending-consumption-headers.service";

const COMPANY_ID = "company-1";
const MEAL_PLAN_GROUP_ID = "mpg-1";
const ACTOR_USER_ID = "user-1";
const PLAN_DATE = new Date("2026-08-01T00:00:00.000Z");

describe("autoCreatePendingConsumptionHeaders (S4-3-c R5-P)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) 최초 호출 시 (locationId, productionLineId) 조합별 Header 생성", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
      mealPlans: [
        {
          slots: [
            { productionLineId: "pl-1", productionLine: { locationId: "loc-A" } },
            { productionLineId: "pl-1", productionLine: { locationId: "loc-A" } }, // 중복 조합
            { productionLineId: "pl-2", productionLine: { locationId: "loc-A" } },
          ],
        },
        {
          slots: [
            { productionLineId: "pl-1", productionLine: { locationId: "loc-B" } },
          ],
        },
      ],
    });
    mockPrisma.consumptionHeader.findUnique.mockResolvedValue(null);
    mockPrisma.consumptionHeader.upsert.mockResolvedValue({ id: "ch-x" });

    const result = await autoCreatePendingConsumptionHeaders(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        actorUserId: ACTOR_USER_ID,
      },
    );

    // 3 조합: (loc-A, pl-1), (loc-A, pl-2), (loc-B, pl-1)
    expect(result).toEqual({ created: 3, existing: 0 });
    expect(mockPrisma.consumptionHeader.upsert).toHaveBeenCalledTimes(3);

    // 첫 호출 페이로드 검증
    expect(mockPrisma.consumptionHeader.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          companyId: COMPANY_ID,
          mealPlanGroupId: MEAL_PLAN_GROUP_ID,
          consumedDate: PLAN_DATE,
          source: "AUTO_MEAL_PLAN",
          status: "PENDING",
          createdByUserId: ACTOR_USER_ID,
        }),
        update: {},
      }),
    );
  });

  it("(b) 재호출 시 기존 Header 존재 → existing 카운트 증가, 중복 생성 없음", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
      mealPlans: [
        {
          slots: [
            { productionLineId: "pl-1", productionLine: { locationId: "loc-A" } },
          ],
        },
      ],
    });
    // 이미 존재하는 Header
    mockPrisma.consumptionHeader.findUnique.mockResolvedValue({ id: "ch-existing" });
    mockPrisma.consumptionHeader.upsert.mockResolvedValue({ id: "ch-existing" });

    const result = await autoCreatePendingConsumptionHeaders(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        actorUserId: ACTOR_USER_ID,
      },
    );

    expect(result).toEqual({ created: 0, existing: 1 });
    // upsert 는 여전히 호출되지만 update 는 {} 이므로 상태 변경 없음
    expect(mockPrisma.consumptionHeader.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });

  it("(c) MealPlanGroup 미존재 시 MealPlanGroupNotFoundError throw", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue(null);

    await expect(
      autoCreatePendingConsumptionHeaders(mockPrisma as never, {
        companyId: COMPANY_ID,
        mealPlanGroupId: "nonexistent",
        actorUserId: ACTOR_USER_ID,
      }),
    ).rejects.toBeInstanceOf(MealPlanGroupNotFoundError);

    expect(mockPrisma.consumptionHeader.upsert).not.toHaveBeenCalled();
  });

  it("(d) 슬롯이 하나도 없는 그룹 → created=0, existing=0 (에러 없음)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
      mealPlans: [{ slots: [] }],
    });

    const result = await autoCreatePendingConsumptionHeaders(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        actorUserId: ACTOR_USER_ID,
      },
    );

    expect(result).toEqual({ created: 0, existing: 0 });
    expect(mockPrisma.consumptionHeader.upsert).not.toHaveBeenCalled();
  });
});
