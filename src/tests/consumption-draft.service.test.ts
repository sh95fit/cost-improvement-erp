import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConsumptionMode,
  ItemType,
  MealCountSource,
  MealPlanStatus,
  ReceivingNoteStatus,
} from "@prisma/client";

import { mockPrisma } from "./mocks/prisma";

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

// ────────────────────────────────────────────────────────────
// Mock 헬퍼 (c-4-2/c-4-3 include 스키마 대응)
// ────────────────────────────────────────────────────────────

type MealCountMock = {
  companyMealSlotId: string;
  lineupId: string;
  estimatedCount: number | null;
  finalCount: number | null;
};

function makeMaterialMasterMock(
  id: string,
  name: string,
  code: string,
  unit = "g",
) {
  return {
    id,
    name,
    code,
    unit,
    defaultSupplierItem: null,
  };
}

function makeSubsidiaryMasterMock(
  id: string,
  name: string,
  code: string,
  unit = "ea",
) {
  return {
    id,
    name,
    code,
    unit,
    defaultSupplierItem: null,
  };
}

function makeMRMock(args: {
  id?: string;
  materialMasterId: string;
  requiredQty: number;
  unit?: string;
  lineupId?: string | null;
  productionLineId?: string | null;
  materialName: string;
  materialCode: string;
}) {
  return {
    id: args.id ?? `mr-${args.materialMasterId}`,
    materialMasterId: args.materialMasterId,
    requiredQty: args.requiredQty,
    unit: args.unit ?? "g",
    lineupId: args.lineupId ?? null,
    productionLineId: args.productionLineId ?? null,
    materialMaster: makeMaterialMasterMock(
      args.materialMasterId,
      args.materialName,
      args.materialCode,
      args.unit ?? "g",
    ),
    lineup:
      args.lineupId != null
        ? { id: args.lineupId, name: `lineup-${args.lineupId}` }
        : null,
    productionLine:
      args.productionLineId != null
        ? { id: args.productionLineId, name: `line-${args.productionLineId}` }
        : null,
  };
}

/**
 * 진입 가드 + 본 조회 두 번의 findFirst 응답을 세팅.
 * c-4-2 이후 mealCounts include 로 조회하므로 companyMealSlotId/lineupId 필수.
 */
function setupCompletedGroup(overrides?: { mealCounts?: MealCountMock[] }) {
  mockPrisma.mealPlanGroup.findFirst
    .mockResolvedValueOnce({ id: GROUP_ID, status: MealPlanStatus.COMPLETED })
    .mockResolvedValueOnce({
      id: GROUP_ID,
      planDate: TARGET_DATE,
      mealCounts:
        overrides?.mealCounts ??
        [
          {
            companyMealSlotId: "cms-1",
            lineupId: "lu-1",
            estimatedCount: 100,
            finalCount: 95,
          },
        ],
    });
}

describe("buildConsumptionDraft (S4-3-c-4-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.materialRequirement.findMany.mockResolvedValue([]);
    mockPrisma.mealPlan.findMany.mockResolvedValue([]);
    mockPrisma.mealCount.findMany.mockResolvedValue([]);
    mockPrisma.inventoryLot.findMany.mockResolvedValue([]);
    mockPrisma.receivingNote.findMany.mockResolvedValue([]);
    (getAvailableQty as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  });

  it("자재 Layer A: MR(FINAL) 행이 자재별로 SUM 되어 반환된다", async () => {
    setupCompletedGroup();

    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeMRMock({
        materialMasterId: "mat-1",
        requiredQty: 300,
        materialName: "양파",
        materialCode: "M001",
      }),
      makeMRMock({
        materialMasterId: "mat-1",
        requiredQty: 200,
        materialName: "양파",
        materialCode: "M001",
      }),
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
      theoreticalQty: 500,
    });

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
      mealCounts: [
        {
          companyMealSlotId: "cms-1",
          lineupId: "lu-1",
          estimatedCount: 100,
          finalCount: 100,
        },
      ],
    });

    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeMRMock({
        materialMasterId: "mat-1",
        requiredQty: 100,
        materialName: "자재A",
        materialCode: "M001",
      }),
    ]);

    mockPrisma.mealPlan.findMany.mockResolvedValue([
      {
        id: "mp-1",
        companyMealSlotId: "cms-1",
        lineupId: "lu-1",
        accessories: [
          {
            id: "acc-1",
            subsidiaryMasterId: "sub-1",
            quantity: 2,
            fixedQuantity: null,
            consumptionMode: ConsumptionMode.PER_MEAL_COUNT,
            subsidiaryMaster: makeSubsidiaryMasterMock(
              "sub-1",
              "젓가락",
              "S001",
              "ea",
            ),
          },
        ],
      },
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
      theoreticalQty: 200, // 100 × 2
      consumptionMode: ConsumptionMode.PER_MEAL_COUNT,
    });
  });

  it("availableQty 는 InventoryLot 별 getAvailableQty 합계로 채워진다", async () => {
    setupCompletedGroup();
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeMRMock({
        materialMasterId: "mat-1",
        requiredQty: 100,
        materialName: "자재A",
        materialCode: "M001",
      }),
    ]);
    mockPrisma.inventoryLot.findMany.mockResolvedValueOnce([
      {
        id: "lot-1",
        materialMasterId: "mat-1",
        subsidiaryMasterId: null,
        remainingQty: 300,
        purchaseKind: null,
        itemType: ItemType.MATERIAL,
      },
      {
        id: "lot-2",
        materialMasterId: "mat-1",
        subsidiaryMasterId: null,
        remainingQty: 200,
        purchaseKind: null,
        itemType: ItemType.MATERIAL,
      },
    ]);
    mockPrisma.inventoryLot.findMany.mockResolvedValueOnce([]);

    (getAvailableQty as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(150);

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);
    expect(draft.layerAItems[0].availableQty).toBe(450);
  });

  it("당일입고: ReceivingNote(status=CONFIRMED, receivedDate=targetDate) 자재별 receivedQty 합계", async () => {
    setupCompletedGroup();
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeMRMock({
        materialMasterId: "mat-1",
        requiredQty: 100,
        materialName: "자재A",
        materialCode: "M001",
      }),
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
    mockPrisma.mealPlanGroup.findFirst
      .mockResolvedValueOnce({ id: GROUP_ID, status: MealPlanStatus.COMPLETED })
      .mockResolvedValueOnce(null);

    await expect(
      buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID),
    ).rejects.toBeInstanceOf(MealPlanGroupNotFoundError);
  });

  it("자재+부자재 혼합 반환은 이름 오름차순으로 정렬된다", async () => {
    setupCompletedGroup({
      mealCounts: [
        {
          companyMealSlotId: "cms-1",
          lineupId: "lu-1",
          estimatedCount: 10,
          finalCount: 10,
        },
      ],
    });

    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeMRMock({
        materialMasterId: "mat-1",
        requiredQty: 100,
        materialName: "양파",
        materialCode: "M001",
      }),
      makeMRMock({
        materialMasterId: "mat-2",
        requiredQty: 50,
        materialName: "감자",
        materialCode: "M002",
      }),
    ]);
    mockPrisma.mealPlan.findMany.mockResolvedValue([
      {
        id: "mp-1",
        companyMealSlotId: "cms-1",
        lineupId: "lu-1",
        accessories: [
          {
            id: "acc-1",
            subsidiaryMasterId: "sub-1",
            quantity: 1,
            fixedQuantity: null,
            consumptionMode: ConsumptionMode.PER_MEAL_COUNT,
            subsidiaryMaster: makeSubsidiaryMasterMock(
              "sub-1",
              "냅킨",
              "S001",
              "ea",
            ),
          },
        ],
      },
    ]);

    const draft = await buildConsumptionDraft(COMPANY_ID, TARGET_DATE, LOCATION_ID);
    const names = draft.layerAItems.map((i) => i.itemName);
    expect(names).toEqual(["감자", "냅킨", "양파"]);   // c-4-3: 자재/부자재 혼합 이름 가나다순
  });
});
