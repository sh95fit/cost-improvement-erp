// src/tests/material-requirement.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  generateMaterialRequirements,
  listMaterialRequirements,
  getMaterialRequirementById,
} from "@/features/material-requirement/services/material-requirement.service";
import { MATERIAL_REQUIREMENT_ERRORS } from "@/features/material-requirement/schemas/material-requirement.schema";

// ──────────────────────────────────────────────────────────────
// 공통 상수
// ──────────────────────────────────────────────────────────────
const COMPANY_ID = "company-1";
const GROUP_ID = "mpg-1";
const LINE_ID = "line-1";
const LOCATION_ID = "loc-1";
const MAT_ID = "mat-1";
const MAT_ID_2 = "mat-2";
const RECIPE_BOM_ID = "rb-1";
const SLOT_ID = "cms-1";
const LINEUP_ID = "lineup-1";

const GROUP_RECORD = { id: GROUP_ID, companyId: COMPANY_ID };

/** 기본 MealCount: estimated=100, final=95 */
const MEAL_COUNT_BASIC = {
  companyMealSlotId: SLOT_ID,
  lineupId: LINEUP_ID,
  estimatedCount: 100,
  finalCount: 95,
};

/** 정상 CONTAINER 슬롯: weightG=10g 자재 1종 */
function makeContainerSlot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "slot-1",
    kind: "CONTAINER",
    productionLineId: LINE_ID,
    recipeBomId: RECIPE_BOM_ID,
    mealPlan: { companyMealSlotId: SLOT_ID, lineupId: LINEUP_ID },
    productionLine: { id: LINE_ID, locationId: LOCATION_ID },
    recipeBom: {
      id: RECIPE_BOM_ID,
      status: "ACTIVE",
      slots: [
        {
          id: "bs-1",
          items: [
            {
              ingredientType: "MATERIAL",
              materialMasterId: MAT_ID,
              semiProductId: null,
              weightG: 10,
              unit: "g",
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════
// 1. generateMaterialRequirements — 정상 경로
// ════════════════════════════════════════════════════════════════
describe("generateMaterialRequirements — 정상 산출", () => {
  it("CONTAINER 슬롯 1개 → inserted=1, requiredQty = weightG × mealCount", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.create.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 1,
    });

    const result = await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(result.stats.inserted).toBe(1);
    expect(result.stats.recipeContainerSlots).toBe(1);
    expect(result.stats.directSlotsSkipped).toBe(0);
    expect(mockPrisma.materialRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: COMPANY_ID,
          mealPlanGroupId: GROUP_ID,
          productionLineId: LINE_ID,
          locationId: LOCATION_ID,
          materialMasterId: MAT_ID,
          requiredQty: 1000, // 10g × 100인분
          unit: "g",
          countSource: "ESTIMATED",
          generationVersion: 1,
        }),
      }),
    );
  });

  it("같은 (라인, 자재) 키가 2개 슬롯에서 등장하면 합산된다", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([
      makeContainerSlot({ id: "slot-A" }),
      makeContainerSlot({ id: "slot-B" }),
    ]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.create.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 1,
    });

    const result = await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(result.stats.inserted).toBe(1); // 같은 키 → 행 1개
    expect(mockPrisma.materialRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiredQty: 2000, // (10g + 10g) × 100인분
        }),
      }),
    );
  });

  it("countSource=FINAL이면 finalCount 사용 (95인분)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.create.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 1,
    });

    await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "FINAL",
    });

    expect(mockPrisma.materialRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiredQty: 950, // 10g × 95인분 (final)
          countSource: "FINAL",
        }),
      }),
    );
  });

  it("DIRECT 슬롯은 directSlotsSkipped 카운트만 증가하고 산출 행은 0건이며 GROUP_EMPTY", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([
      { id: "d-1", kind: "DIRECT", productionLineId: null, recipeBomId: null,
        mealPlan: { companyMealSlotId: SLOT_ID, lineupId: LINEUP_ID },
        productionLine: null, recipeBom: null },
    ]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);

    await expect(
      generateMaterialRequirements(COMPANY_ID, {
        mealPlanGroupId: GROUP_ID,
        countSource: "ESTIMATED",
      }),
    ).rejects.toThrow(MATERIAL_REQUIREMENT_ERRORS.GROUP_EMPTY);
  });
});

// ════════════════════════════════════════════════════════════════
// 2. generateMaterialRequirements — 에러 케이스
// ════════════════════════════════════════════════════════════════
describe("generateMaterialRequirements — 에러 분기", () => {
  it("그룹 미존재 → GROUP_NOT_FOUND", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(null);

    await expect(
      generateMaterialRequirements(COMPANY_ID, {
        mealPlanGroupId: "nope",
        countSource: "ESTIMATED",
      }),
    ).rejects.toThrow(MATERIAL_REQUIREMENT_ERRORS.GROUP_NOT_FOUND);
  });

  it("CONTAINER 슬롯의 productionLineId가 NULL → MISSING_PRODUCTION_LINE", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([
      makeContainerSlot({ productionLineId: null, productionLine: null }),
    ]);

    await expect(
      generateMaterialRequirements(COMPANY_ID, {
        mealPlanGroupId: GROUP_ID,
        countSource: "ESTIMATED",
      }),
    ).rejects.toThrow(MATERIAL_REQUIREMENT_ERRORS.MISSING_PRODUCTION_LINE);
  });

  it("recipeBom이 DRAFT 상태 → MISSING_RECIPE_BOM", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    const slot = makeContainerSlot();
    slot.recipeBom = { ...slot.recipeBom, status: "DRAFT" };
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([slot]);

    await expect(
      generateMaterialRequirements(COMPANY_ID, {
        mealPlanGroupId: GROUP_ID,
        countSource: "ESTIMATED",
      }),
    ).rejects.toThrow(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
  });

  it("MealCount.estimatedCount가 NULL → MISSING_MEAL_COUNT", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([
      { ...MEAL_COUNT_BASIC, estimatedCount: null },
    ]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);

    await expect(
      generateMaterialRequirements(COMPANY_ID, {
        mealPlanGroupId: GROUP_ID,
        countSource: "ESTIMATED",
      }),
    ).rejects.toThrow(MATERIAL_REQUIREMENT_ERRORS.MISSING_MEAL_COUNT);
  });

  it("자재 단위가 'kg'/'g'가 아니고 UnitConversion도 없으면 INVALID_UNIT", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    const slot = makeContainerSlot();
    slot.recipeBom.slots[0].items[0] = {
      ...slot.recipeBom.slots[0].items[0],
      unit: "ml",
    };
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([slot]);
    // 자재별 환산표 없음
    mockPrisma.unitConversion.findFirst.mockResolvedValueOnce(null);
    // 일반 환산표(materialMasterId IS NULL) 도 없음
    mockPrisma.unitConversion.findFirst.mockResolvedValueOnce(null);

    await expect(
      generateMaterialRequirements(COMPANY_ID, {
        mealPlanGroupId: GROUP_ID,
        countSource: "ESTIMATED",
      }),
    ).rejects.toThrow(MATERIAL_REQUIREMENT_ERRORS.INVALID_UNIT);
  });
});

// ════════════════════════════════════════════════════════════════
// 3. 단위 환산
// ════════════════════════════════════════════════════════════════
describe("generateMaterialRequirements — 단위 환산", () => {
  it("kg 단위 자재는 ×1000 자동 환산된다", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    const slot = makeContainerSlot();
    slot.recipeBom.slots[0].items[0] = {
      ...slot.recipeBom.slots[0].items[0],
      weightG: 0.01, // 0.01kg = 10g
      unit: "kg",
    };
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([slot]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.create.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 1,
    });

    await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(mockPrisma.materialRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiredQty: 1000, // 0.01kg × 1000 × 100인분
        }),
      }),
    );
  });

  it("자재별 UnitConversion이 있으면 factor를 적용한다", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    const slot = makeContainerSlot();
    slot.recipeBom.slots[0].items[0] = {
      ...slot.recipeBom.slots[0].items[0],
      weightG: 1, // 1개
      unit: "ea",
    };
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([slot]);
    // 자재별 환산표: 1ea = 5g
    mockPrisma.unitConversion.findFirst.mockResolvedValueOnce({ factor: 5 });
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.create.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 1,
    });

    await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(mockPrisma.materialRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiredQty: 500, // 1ea × 5(factor) × 100인분
        }),
      }),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// 4. Diff 동작 (UPSERT / UNDELETE / SOFT-DELETE / unchanged)
// ════════════════════════════════════════════════════════════════
describe("generateMaterialRequirements — diff 동작", () => {
  it("재실행 시 값이 동일하면 unchanged++ (idempotency)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);
    // 이미 동일 값으로 활성 행 존재
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      {
        id: "mr-1",
        productionLineId: LINE_ID,
        locationId: LOCATION_ID,
        materialMasterId: MAT_ID,
        requiredQty: 1000,
        unit: "g",
        countSource: "ESTIMATED",
        generationVersion: 3,
        deletedAt: null,
      },
    ]);

    const result = await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(result.stats.unchanged).toBe(1);
    expect(result.stats.inserted).toBe(0);
    expect(result.stats.updated).toBe(0);
    expect(result.generationVersion).toBe(3); // 변경 없음 → 기존 max
    expect(mockPrisma.materialRequirement.update).not.toHaveBeenCalled();
    expect(mockPrisma.materialRequirement.create).not.toHaveBeenCalled();
  });

  it("기존 활성 행과 수량이 다르면 UPDATE되고 generationVersion이 +1된다", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      {
        id: "mr-1",
        productionLineId: LINE_ID,
        locationId: LOCATION_ID,
        materialMasterId: MAT_ID,
        requiredQty: 500, // 다름
        unit: "g",
        countSource: "ESTIMATED",
        generationVersion: 2,
        deletedAt: null,
      },
    ]);
    mockPrisma.materialRequirement.update.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 3,
    });

    const result = await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(result.stats.updated).toBe(1);
    expect(mockPrisma.materialRequirement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mr-1" },
        data: expect.objectContaining({
          requiredQty: 1000,
          generationVersion: 3,
        }),
      }),
    );
  });

  it("soft-deleted 행이 다시 등장하면 UNDELETE (deletedAt=null, generationVersion+1)", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      {
        id: "mr-1",
        productionLineId: LINE_ID,
        locationId: LOCATION_ID,
        materialMasterId: MAT_ID,
        requiredQty: 500,
        unit: "g",
        countSource: "ESTIMATED",
        generationVersion: 2,
        deletedAt: new Date("2026-06-01"),
      },
    ]);
    mockPrisma.materialRequirement.update.mockResolvedValueOnce({
      id: "mr-1",
      generationVersion: 3,
    });

    const result = await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(result.stats.undeleted).toBe(1);
    expect(mockPrisma.materialRequirement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mr-1" },
        data: expect.objectContaining({
          requiredQty: 1000,
          deletedAt: null,
          generationVersion: 3,
        }),
      }),
    );
  });

  it("산출 결과에서 사라진 활성 행은 SOFT-DELETE된다", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce(GROUP_RECORD);
    mockPrisma.mealCount.findMany.mockResolvedValueOnce([MEAL_COUNT_BASIC]);
    // 슬롯에서는 MAT_ID만 등장
    mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([makeContainerSlot()]);
    // 기존에는 MAT_ID, MAT_ID_2 둘 다 활성
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      {
        id: "mr-1",
        productionLineId: LINE_ID,
        locationId: LOCATION_ID,
        materialMasterId: MAT_ID,
        requiredQty: 1000,
        unit: "g",
        countSource: "ESTIMATED",
        generationVersion: 1,
        deletedAt: null,
      },
      {
        id: "mr-2",
        productionLineId: LINE_ID,
        locationId: LOCATION_ID,
        materialMasterId: MAT_ID_2, // 이번 산출에 없음
        requiredQty: 500,
        unit: "g",
        countSource: "ESTIMATED",
        generationVersion: 1,
        deletedAt: null,
      },
    ]);
    mockPrisma.materialRequirement.update.mockResolvedValueOnce({
      id: "mr-2",
      generationVersion: 2,
    });

    const result = await generateMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "ESTIMATED",
    });

    expect(result.stats.unchanged).toBe(1); // mr-1
    expect(result.stats.softDeleted).toBe(1); // mr-2
    expect(mockPrisma.materialRequirement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mr-2" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          generationVersion: 2,
        }),
      }),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// 5. listMaterialRequirements / getById
// ════════════════════════════════════════════════════════════════
describe("listMaterialRequirements", () => {
  it("activeOnly=true (default)면 deletedAt: null 필터를 적용한다", async () => {
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.count.mockResolvedValueOnce(0);

    await listMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      activeOnly: true,
      page: 1,
      limit: 50,
    });

    expect(mockPrisma.materialRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mealPlanGroupId: GROUP_ID,
          deletedAt: null,
        }),
        include: expect.objectContaining({
          materialMaster: expect.any(Object),
          productionLine: expect.any(Object),
          location: expect.any(Object),
        }),
      }),
    );
  });

  it("응답에 materialMaster/productionLine/location 관계가 포함된다", async () => {
    const mockRow = {
      id: "mr-1",
      companyId: COMPANY_ID,
      mealPlanGroupId: GROUP_ID,
      productionLineId: LINE_ID,
      locationId: LOCATION_ID,
      materialMasterId: MAT_ID,
      requiredQty: 1000,
      unit: "g",
      countSource: "ESTIMATED",
      generationVersion: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      materialMaster: {
        id: MAT_ID,
        code: "MAT-001",
        name: "양파",
        unit: "kg",
        unitCategory: "WEIGHT",
        materialType: "RAW",
      },
      productionLine: {
        id: LINE_ID,
        code: "PL-1",
        name: "1라인",
        locationId: LOCATION_ID,
      },
      location: {
        id: LOCATION_ID,
        code: "LOC-1",
        name: "본사창고",
      },
    };
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([
      mockRow,
    ] as never);
    mockPrisma.materialRequirement.count.mockResolvedValueOnce(1);

    const result = await listMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      activeOnly: true,
      page: 1,
      limit: 50,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].materialMaster.name).toBe("양파");
    expect(result.items[0].productionLine.name).toBe("1라인");
    expect(result.items[0].location.name).toBe("본사창고");
  });

  it("countSource 필터를 전달하면 where에 반영된다", async () => {
    mockPrisma.materialRequirement.findMany.mockResolvedValueOnce([]);
    mockPrisma.materialRequirement.count.mockResolvedValueOnce(0);

    await listMaterialRequirements(COMPANY_ID, {
      mealPlanGroupId: GROUP_ID,
      countSource: "FINAL",
      activeOnly: true,
      page: 1,
      limit: 50,
    });

    expect(mockPrisma.materialRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countSource: "FINAL" }),
      }),
    );
  });
});

describe("getMaterialRequirementById", () => {
  it("id로 단건 조회 (없으면 null)", async () => {
    mockPrisma.materialRequirement.findFirst.mockResolvedValueOnce(null);

    const result = await getMaterialRequirementById(COMPANY_ID, { id: "nope" });

    expect(result).toBeNull();
    expect(mockPrisma.materialRequirement.findFirst).toHaveBeenCalledWith({
      where: { id: "nope", companyId: COMPANY_ID },
    });
  });
});
