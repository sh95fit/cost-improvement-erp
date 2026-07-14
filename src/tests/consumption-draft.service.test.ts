import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConsumptionMode,
  ItemType,
  MealCountSource,
  MealPlanStatus,
  ReceivingNoteStatus,
} from "@prisma/client";

import { mockPrisma } from "./mocks/prisma";

// getAvailableQty 모킹 (실 lot 조회 후 각 lot 잔량을 그대로 반환하도록)
vi.mock("@/features/inventory/services/reservation.service", () => ({
  getAvailableQty: vi.fn(),
}));

import {
  buildConsumptionDraft,
  MaterialRequirementNotGeneratedError,
  MealPlanGroupNotFoundError,
} from "@/features/consumption/services/consumption-draft.service";
import { getAvailableQty } from "@/features/inventory/services/reservation.service";

const COMPANY_ID = "company-1";
const LOCATION_ID = "loc-1";
const TARGET_DATE = new Date("2026-07-15T00:00:00.000Z");
const GROUP_ID = "mpg-1";

// 진입 가드는 이미 STEP-a 에서 검증됨. 여기서는 mockPrisma.mealPlanGroup.findFirst
// 를 통해 통과시킨다 (assertMealPlanCompletedForConsumption 이 내부에서 호출).

function setupCompletedGroup(overrides?: {
  mealCounts?: Array<{ estimatedCount: number | null; finalCount: number | null }>;
}) {
  // 진입 가드에서 호출되는 findFirst 는 select { id, status } 만 조회
  // 이후 buildConsumptionDraft 가 다시 findFirst 를 호출 (mealCounts include)
  // → 두 번 응답해야 하므로 mockResolvedValueOnce 를 두 번 세팅
  mockPrisma.mealPlanGroup.findFirst
    .mockResolvedValueOnce({ id: GROUP_ID, status: MealPlanStatus.COMPLETED })
    .mockResolvedValueOnce({
      id: GROUP_ID,
      planDate: TARGET_DATE,
      mealCounts: overrides?.mealCounts ?? [
        { estimatedCount: 100, finalCount: 95 },
      ],
    });
}

describe("buildConsumptionDraft (S4-3-b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본: 모든 사이드 조회를 빈 값으로
    mockPrisma.materialRequirement.findMany.mockResolvedValue([]);
    mockPrisma.mealPlan.findMany.mockResolvedValue([]);
    mockPrisma.mealCount.findMany.mockResolvedValue([]);
    mockPrisma.inventoryLot.findMany.mockResolvedValue([]);
    mockPrisma.receivingNote.findMany.mockResolvedValue([]);
    (getAvailableQty as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  });

  it("자재 Layer A: MR(FINAL) 행이 자재별로 SUM 되어 반환된다", async () => {
    setupCompletedGroup();

    // 동일 자재 mat-1 이 두 productionLine 에 걸쳐 있음 → 300 + 200 = 500 g
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        materialMasterId: "mat-1",
        requiredQty: 300,
        unit: "g",
        materialMaster: { id: "mat-1", name: "양파", code: "M001" },
      },
      {
        materialMasterId: "mat-1",
        requiredQty: 200,
        unit: "g",
        materialMaster: { id: "mat-1", name: "양파", code: "M001" },
      },
    ]);

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);

    expect(draft.header).toEqual({
      mealPlanGroupId: GROUP_ID,
      planDate: TARGET_DATE,
      totalEstimatedCount: 100,
      totalFinalCount: 95,
    });
    expect(draft.layerAItems).toHaveLength(1);
    expect(draft.layerAItems[0]).toMatchObject({
      itemType: ItemType.MATERIAL,
      itemId: "mat-1",
      itemName: "양파",
      unit: "g",
      expectedQty: 500,
    });

    // MR 조회는 (companyId, mealPlanGroupId, countSource=FINAL, locationId, deletedAt=null)
    expect(mockPrisma.materialRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          mealPlanGroupId: GROUP_ID,
          countSource: MealCountSource.FINAL,
          locationId: LOCATION_ID,
          deletedAt: null,
        }),
      }),
    );
  });

  it("부자재 Layer A: MealPlanAccessory(PER_MEAL_COUNT) × finalCount 로 산출", async () => {
    setupCompletedGroup({
      mealCounts: [{ estimatedCount: 100, finalCount: 100 }],
    });

    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      // 최소 1건 필요 (MR 부재 방어 통과용)
      {
        materialMasterId: "mat-1",
        requiredQty: 100,
        unit: "g",
        materialMaster: { id: "mat-1", name: "자재A", code: "M001" },
      },
    ]);

    mockPrisma.mealPlan.findMany.mockResolvedValue([
      {
        id: "mp-1",
        companyMealSlotId: "cms-1",
        lineupId: "lu-1",
        accessories: [
          {
            subsidiaryMasterId: "sub-1",
            quantity: 2, // 1인분당 2개
            subsidiaryMaster: {
              id: "sub-1",
              name: "젓가락",
              code: "S001",
              unit: "ea",
            },
          },
        ],
      },
    ]);

    mockPrisma.mealCount.findMany.mockResolvedValue([
      { companyMealSlotId: "cms-1", lineupId: "lu-1", finalCount: 100 },
    ]);

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);

    const subsidiary = draft.layerAItems.find(
      (i) => i.itemType === ItemType.SUBSIDIARY,
    );
    expect(subsidiary).toMatchObject({
      itemType: ItemType.SUBSIDIARY,
      itemId: "sub-1",
      itemName: "젓가락",
      unit: "ea",
      expectedQty: 200, // 100 × 2
    });
  });

  it("availableQty 는 InventoryLot 별 getAvailableQty 합계로 채워진다", async () => {
    setupCompletedGroup();
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        materialMasterId: "mat-1",
        requiredQty: 100,
        unit: "g",
        materialMaster: { id: "mat-1", name: "자재A", code: "M001" },
      },
    ]);
    // computeAvailability(MATERIAL, [mat-1]) 에 응답
    mockPrisma.inventoryLot.findMany.mockResolvedValueOnce([
      { id: "lot-1", materialMasterId: "mat-1", subsidiaryMasterId: null, remainingQty: 300, purchaseKind: null, itemType: ItemType.MATERIAL },
      { id: "lot-2", materialMasterId: "mat-1", subsidiaryMasterId: null, remainingQty: 200, purchaseKind: null, itemType: ItemType.MATERIAL },
    ]);
    // SUBSIDIARY 조회 응답 (빈)
    mockPrisma.inventoryLot.findMany.mockResolvedValueOnce([]);

    (getAvailableQty as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(300) // lot-1
      .mockResolvedValueOnce(150); // lot-2 (50 예약)

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);
    expect(draft.layerAItems[0].availableQty).toBe(450);
  });

  it("당일입고: ReceivingNote(status=CONFIRMED, receivedDate=targetDate) 자재별 receivedQty 합계", async () => {
    setupCompletedGroup();
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        materialMasterId: "mat-1",
        requiredQty: 100,
        unit: "g",
        materialMaster: { id: "mat-1", name: "자재A", code: "M001" },
      },
    ]);

    mockPrisma.receivingNote.findMany.mockResolvedValue([
      {
        items: [
          {
            receivedQty: 80,
            purchaseOrderItem: {
              itemType: ItemType.MATERIAL,
              materialMasterId: "mat-1",
              subsidiaryMasterId: null,
            },
          },
          {
            receivedQty: 20,
            purchaseOrderItem: {
              itemType: ItemType.MATERIAL,
              materialMasterId: "mat-1",
              subsidiaryMasterId: null,
            },
          },
        ],
      },
    ]);

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);
    expect(draft.layerAItems[0].inboundQtyOnDate).toBe(100);

    // 조회 조건 검증
    expect(mockPrisma.receivingNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          status: ReceivingNoteStatus.CONFIRMED,
          purchaseOrder: { locationId: LOCATION_ID },
        }),
      }),
    );
  });

  it("MR(FINAL) 부재 시 MaterialRequirementNotGeneratedError", async () => {
    setupCompletedGroup();
    mockPrisma.materialRequirement.findMany.mockResolvedValue([]);

    await expect(
      buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MaterialRequirementNotGeneratedError);
  });

  it("MealPlanGroup(status=COMPLETED) 부재 시 MealPlanGroupNotFoundError", async () => {
    // 진입 가드는 통과, buildConsumptionDraft 내부 findFirst 에서 미발견
    mockPrisma.mealPlanGroup.findFirst
      .mockResolvedValueOnce({ id: GROUP_ID, status: MealPlanStatus.COMPLETED }) // 가드
      .mockResolvedValueOnce(null); // 내부 조회

    await expect(
      buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanGroupNotFoundError);
  });

  it("자재+부자재 혼합 반환은 이름 오름차순으로 정렬된다", async () => {
    setupCompletedGroup();

    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        materialMasterId: "mat-1",
        requiredQty: 100,
        unit: "g",
        materialMaster: { id: "mat-1", name: "양파", code: "M001" },
      },
      {
        materialMasterId: "mat-2",
        requiredQty: 50,
        unit: "g",
        materialMaster: { id: "mat-2", name: "감자", code: "M002" },
      },
    ]);
    mockPrisma.mealPlan.findMany.mockResolvedValue([
      {
        id: "mp-1",
        companyMealSlotId: "cms-1",
        lineupId: "lu-1",
        accessories: [
          {
            subsidiaryMasterId: "sub-1",
            quantity: 1,
            subsidiaryMaster: { id: "sub-1", name: "냅킨", code: "S001", unit: "ea" },
          },
        ],
      },
    ]);
    mockPrisma.mealCount.findMany.mockResolvedValue([
      { companyMealSlotId: "cms-1", lineupId: "lu-1", finalCount: 10 },
    ]);

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);
    const names = draft.layerAItems.map((i) => i.itemName);
    expect(names).toEqual(["감자", "냅킨", "양파"]);
  });
});
