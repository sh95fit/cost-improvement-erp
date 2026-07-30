import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { mockPrisma } from "./mocks/prisma";
import {
  releaseReservationsOnMealPlanCancel,
  MealPlanGroupNotFoundForCancelError,
} from "@/features/inventory/services/release-reservations-on-meal-plan-cancel.service";
import { releaseReservation } from "@/features/inventory/services/reservation.service";

// releaseReservation 은 별도 서비스이므로 mock 처리
vi.mock("@/features/inventory/services/reservation.service", () => ({
  releaseReservation: vi.fn(),
}));

const tx = mockPrisma as unknown as Prisma.TransactionClient;

const COMPANY_ID = "company-1";
const ACTOR_ID = "user-1";
const MEAL_PLAN_GROUP_ID = "mpg-1";

describe("releaseReservationsOnMealPlanCancel (R15, §9-5·§11-3)", () => {
  beforeEach(() => {
    mockPrisma.mealPlanGroup.findFirst.mockReset();
    mockPrisma.materialRequirement.findMany.mockReset();
    mockPrisma.inventoryReservation.findMany.mockReset();
    vi.mocked(releaseReservation).mockReset();
    vi.mocked(releaseReservation).mockResolvedValue(undefined as never);
  });

  it("MealPlanGroup 미존재 시 MealPlanGroupNotFoundForCancelError throw", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(null);

    await expect(
      releaseReservationsOnMealPlanCancel(tx, {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        actorUserId: ACTOR_ID,
      }),
    ).rejects.toBeInstanceOf(MealPlanGroupNotFoundForCancelError);

    expect(mockPrisma.materialRequirement.findMany).not.toHaveBeenCalled();
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it("그룹에 활성 MR 이 하나도 없으면 released: 0 반환하고 예약 조회 안 함", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({ id: MEAL_PLAN_GROUP_ID });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);

    const result = await releaseReservationsOnMealPlanCancel(tx, {
      companyId: COMPANY_ID,
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ released: 0 });
    expect(mockPrisma.inventoryReservation.findMany).not.toHaveBeenCalled();
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it("MR 는 있지만 활성 예약이 없으면 released: 0 반환", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({ id: MEAL_PLAN_GROUP_ID });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      { id: "mr-1" },
      { id: "mr-2" },
    ]);
    mockPrisma.inventoryReservation.findMany.mockResolvedValueOnce([]);

    const result = await releaseReservationsOnMealPlanCancel(tx, {
      companyId: COMPANY_ID,
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ released: 0 });
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it("활성 예약 N건 → 각각 MANUAL_CANCEL 사유로 release, released: N 반환", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({ id: MEAL_PLAN_GROUP_ID });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      { id: "mr-1" },
      { id: "mr-2" },
    ]);
    mockPrisma.inventoryReservation.findMany.mockResolvedValueOnce([
      { id: "resv-1" },
      { id: "resv-2" },
      { id: "resv-3" },
    ]);

    const result = await releaseReservationsOnMealPlanCancel(tx, {
      companyId: COMPANY_ID,
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ released: 3 });
    expect(releaseReservation).toHaveBeenCalledTimes(3);
    expect(releaseReservation).toHaveBeenNthCalledWith(
      1,
      {
        reservationId: "resv-1",
        reason: "MANUAL_CANCEL",
        actorUserId: ACTOR_ID,
      },
      tx,
    );
    expect(releaseReservation).toHaveBeenNthCalledWith(
      2,
      {
        reservationId: "resv-2",
        reason: "MANUAL_CANCEL",
        actorUserId: ACTOR_ID,
      },
      tx,
    );
    expect(releaseReservation).toHaveBeenNthCalledWith(
      3,
      {
        reservationId: "resv-3",
        reason: "MANUAL_CANCEL",
        actorUserId: ACTOR_ID,
      },
      tx,
    );
  });

  it("예약 조회 시 companyId 격리 + referenceType='MATERIAL_REQUIREMENT' + referenceId in mrIds + releasedAt=null 필터 적용", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({ id: MEAL_PLAN_GROUP_ID });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      { id: "mr-1" },
      { id: "mr-2" },
    ]);
    mockPrisma.inventoryReservation.findMany.mockResolvedValueOnce([]);

    await releaseReservationsOnMealPlanCancel(tx, {
      companyId: COMPANY_ID,
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      actorUserId: ACTOR_ID,
    });

    expect(mockPrisma.inventoryReservation.findMany).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY_ID,
        referenceType: "MATERIAL_REQUIREMENT",
        referenceId: { in: ["mr-1", "mr-2"] },
        releasedAt: null,
      },
      select: { id: true },
    });
  });

  it("MR 조회 시 companyId 격리 + soft-delete 제외 필터 적용", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({ id: MEAL_PLAN_GROUP_ID });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);

    await releaseReservationsOnMealPlanCancel(tx, {
      companyId: COMPANY_ID,
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      actorUserId: ACTOR_ID,
    });

    expect(mockPrisma.materialRequirement.findMany).toHaveBeenCalledWith({
      where: {
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        companyId: COMPANY_ID,
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it("MealPlanGroup 조회 시 companyId 격리 + soft-delete 제외 필터 적용", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({ id: MEAL_PLAN_GROUP_ID });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);

    await releaseReservationsOnMealPlanCancel(tx, {
      companyId: COMPANY_ID,
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      actorUserId: ACTOR_ID,
    });

    expect(mockPrisma.mealPlanGroup.findFirst).toHaveBeenCalledWith({
      where: {
        id: MEAL_PLAN_GROUP_ID,
        companyId: COMPANY_ID,
        deletedAt: null,
      },
      select: { id: true },
    });
  });
});