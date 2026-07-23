import { describe, it, expect, beforeEach, vi } from "vitest";
import { MealCountSource } from "@prisma/client";

import { mockPrisma } from "./mocks/prisma";
import {
  autoReserveFromMaterialRequirements,
  MealPlanGroupNotFoundForReserveError,
} from "@/features/inventory/services/auto-reserve-from-material-requirements.service";
import { InsufficientAvailableQtyError } from "@/features/inventory/services/reservation.service";

const COMPANY_ID = "company-1";
const MEAL_PLAN_GROUP_ID = "mpg-1";
const ACTOR_USER_ID = "user-1";
const PLAN_DATE = new Date("2026-08-01T00:00:00.000Z");
const LOC_A = "loc-factory-A";
const MAT_X = "mat-X";

// createReservation / releaseReservation 은 실제 로직이 아닌 스파이로 대체.
// reservation.service 는 mockPrisma.inventoryReservation 을 통해 간접 동작.
vi.mock("@/features/inventory/services/reservation.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/inventory/services/reservation.service")>();
  return {
    ...actual,
    createReservation: vi.fn(),
    releaseReservation: vi.fn(),
  };
});

import {
  createReservation,
  releaseReservation,
} from "@/features/inventory/services/reservation.service";

describe("autoReserveFromMaterialRequirements (S4-3-c R5-R1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) eligible lot 만 FIFO 순으로 예약, requiredQty 충족", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
    });
    // release 대상 조회 — 기존 예약 없음
    mockPrisma.materialRequirement.findMany
      .mockResolvedValueOnce([{ id: "mr-1" }]) // Phase 1: release 대상 MR id
      .mockResolvedValueOnce([
        {
          id: "mr-1",
          materialMasterId: MAT_X,
          requiredQty: 150,
          locationId: LOC_A,
        },
      ]); // Phase 2: 예약 대상
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([]); // release 대상 0건
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
      { id: "lot-2", remainingQty: 80, purchaseKind: "MANUAL_JIT", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });

    const result = await autoReserveFromMaterialRequirements(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        countSource: MealCountSource.ESTIMATED,
        actorUserId: ACTOR_USER_ID,
      },
    );

    expect(result).toEqual({ reserved: 2, skipped: 0, released: 0 });
    expect(createReservation).toHaveBeenCalledTimes(2);
    // lot-1 100, lot-2 50 (150 채움)
    expect(createReservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ inventoryLotId: "lot-1", quantity: 100, referenceType: "MATERIAL_REQUIREMENT", referenceId: "mr-1" }),
      expect.anything(),
    );
    expect(createReservation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ inventoryLotId: "lot-2", quantity: 50 }),
      expect.anything(),
    );
  });

  it("(b) 전체 lot 이 STOCK_KEEPING → skip (에러 없음)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
    });
    mockPrisma.materialRequirement.findMany
      .mockResolvedValueOnce([{ id: "mr-1" }])
      .mockResolvedValueOnce([
        { id: "mr-1", materialMasterId: MAT_X, requiredQty: 50, locationId: LOC_A },
      ]);
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([]);
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-sk", remainingQty: 100, purchaseKind: "STOCK_KEEPING", itemType: "MATERIAL" },
    ]);

    const result = await autoReserveFromMaterialRequirements(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        countSource: MealCountSource.ESTIMATED,
        actorUserId: ACTOR_USER_ID,
      },
    );

    expect(result).toEqual({ reserved: 0, skipped: 1, released: 0 });
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("(c) eligible lot 존재하나 합산 부족 → InsufficientAvailableQtyError throw (P4/§9-11)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
    });
    mockPrisma.materialRequirement.findMany
      .mockResolvedValueOnce([{ id: "mr-1" }])
      .mockResolvedValueOnce([
        { id: "mr-1", materialMasterId: MAT_X, requiredQty: 200, locationId: LOC_A },
      ]);
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([]);
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 150, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });

    await expect(
      autoReserveFromMaterialRequirements(mockPrisma as never, {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        countSource: MealCountSource.ESTIMATED,
        actorUserId: ACTOR_USER_ID,
      }),
    ).rejects.toBeInstanceOf(InsufficientAvailableQtyError);
  });

  it("(d) 재산출 시나리오 — 기존 예약 release 후 재예약 (α 정책)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
    });
    mockPrisma.materialRequirement.findMany
      .mockResolvedValueOnce([{ id: "mr-1" }, { id: "mr-2" }])
      .mockResolvedValueOnce([
        { id: "mr-1", materialMasterId: MAT_X, requiredQty: 50, locationId: LOC_A },
      ]);
    // 기존 예약 3건 존재
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      { id: "res-1" },
      { id: "res-2" },
      { id: "res-3" },
    ]);
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });

    const result = await autoReserveFromMaterialRequirements(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        countSource: MealCountSource.FINAL,
        actorUserId: ACTOR_USER_ID,
      },
    );

    expect(result).toEqual({ reserved: 1, skipped: 0, released: 3 });
    expect(releaseReservation).toHaveBeenCalledTimes(3);
    expect(releaseReservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ reservationId: "res-1", reason: "MANUAL_CANCEL", actorUserId: ACTOR_USER_ID }),
      expect.anything(),
    );
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("(e) MealPlanGroup 미존재 시 MealPlanGroupNotFoundForReserveError throw", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue(null);

    await expect(
      autoReserveFromMaterialRequirements(mockPrisma as never, {
        companyId: COMPANY_ID,
        mealPlanGroupId: "nonexistent",
        countSource: MealCountSource.ESTIMATED,
        actorUserId: ACTOR_USER_ID,
      }),
    ).rejects.toBeInstanceOf(MealPlanGroupNotFoundForReserveError);

    expect(createReservation).not.toHaveBeenCalled();
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it("(f) MR 이 하나도 없는 그룹 → 전부 0 (에러 없음)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValue({
      id: MEAL_PLAN_GROUP_ID,
      planDate: PLAN_DATE,
    });
    mockPrisma.materialRequirement.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await autoReserveFromMaterialRequirements(
      mockPrisma as never,
      {
        companyId: COMPANY_ID,
        mealPlanGroupId: MEAL_PLAN_GROUP_ID,
        countSource: MealCountSource.ESTIMATED,
        actorUserId: ACTOR_USER_ID,
      },
    );

    expect(result).toEqual({ reserved: 0, skipped: 0, released: 0 });
  });
});
