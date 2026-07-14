import { describe, it, expect, beforeEach, vi } from "vitest";
import { MealPlanStatus } from "@prisma/client";

import { mockPrisma } from "./mocks/prisma";
import {
  assertMealPlanCompletedForConsumption,
  MealPlanNotCompletedForConsumptionError,
} from "@/features/consumption/services/consumption-guard.service";

const COMPANY_ID = "company-1";
const LOCATION_ID = "loc-1";
const TARGET_DATE = new Date("2026-07-15T00:00:00.000Z");

describe("assertMealPlanCompletedForConsumption (S4-3-a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("COMPLETED 인 MealPlanGroup 이 있으면 통과 (throw 없음)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: "mpg-1",
      status: MealPlanStatus.COMPLETED,
    });

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).resolves.toBeUndefined();

    expect(mockPrisma.mealPlanGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          planDate: TARGET_DATE,
          deletedAt: null,
        }),
        select: { id: true, status: true },
      }),
    );
  });

  it("MealPlanGroup 이 없으면 에러 (actualStatus=null)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue(null);

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanNotCompletedForConsumptionError);

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toMatchObject({
      companyId: COMPANY_ID,
      locationId: LOCATION_ID,
      actualStatus: null,
    });
  });

  it("DRAFT 상태면 에러", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: "mpg-1",
      status: MealPlanStatus.DRAFT,
    });

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanNotCompletedForConsumptionError);
  });

  it("CONFIRMED 상태여도 COMPLETED 아니면 에러 (P13: 확정 식수 입력까지 완료되어야 함)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: "mpg-1",
      status: MealPlanStatus.CONFIRMED,
    });

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanNotCompletedForConsumptionError);
  });

  it("IN_PROGRESS 상태여도 에러", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: "mpg-1",
      status: MealPlanStatus.IN_PROGRESS,
    });

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanNotCompletedForConsumptionError);
  });

  it("CANCELLED 상태면 에러", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: "mpg-1",
      status: MealPlanStatus.CANCELLED,
    });

    await expect(
      assertMealPlanCompletedForConsumption(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanNotCompletedForConsumptionError);
  });

  it("targetDate 는 planDate(@db.Date) 매치를 위해 UTC 자정으로 정규화된다", async () => {
    // 시분초가 있는 date 를 넘겨도 findFirst 에는 자정 UTC 로 전달되어야 함
    const dateWithTime = new Date("2026-07-15T13:45:30.000Z");
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: "mpg-1",
      status: MealPlanStatus.COMPLETED,
    });

    await assertMealPlanCompletedForConsumption(
      COMPANY_ID,
      dateWithTime,
      LOCATION_ID,
    );

    const callArg = mockPrisma.mealPlanGroup.findFirst.mock.calls[0][0];
    const passedDate = callArg.where.planDate as Date;
    expect(passedDate.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
});
