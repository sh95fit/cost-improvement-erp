// src/tests/meal-plan.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// ──────────────────────────────────────────────────────────────
// 외부 의존 모듈 mock (mockPrisma는 setup에서 이미 vi.mock 처리됨)
// ──────────────────────────────────────────────────────────────
// findMatchingActiveBom은 외부 import → 별도 vi.mock 필요 (Phase 7-F1 가드용)
vi.mock("@/features/recipe/services/recipe-bom.service", () => ({
  findMatchingActiveBom: vi.fn(),
}));

import {
  // MealPlanAccessory
  getMealPlanAccessories,
  createMealPlanAccessory,
  updateMealPlanAccessory,
  deleteMealPlanAccessory,
  // MealPlanSlot (Phase 7-F1)
  createMealPlanSlot,
  updateMealPlanSlot,
  bulkCreateContainerSlots,
  // MealPlanGroup / MealPlan
  createMealPlanGroup,
  createMealPlan,
  // MealCount
  upsertMealCount,
  // applyMealTemplate
  applyMealTemplate,
} from "@/features/meal-plan/services/meal-plan.service";
import { findMatchingActiveBom } from "@/features/recipe/services/recipe-bom.service";

const COMPANY_ID = "company-1";
const MEAL_PLAN_ID = "mp-1";
const MEAL_PLAN_GROUP_ID = "mpg-1";

// 공통 mock 시드 — assertMealPlanInCompany 통과용
const MEAL_PLAN_RECORD = {
  id: MEAL_PLAN_ID,
  mealPlanGroupId: MEAL_PLAN_GROUP_ID,
  lineupId: "lineup-1",
  companyMealSlotId: "cms-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  // findMatchingActiveBom mock 기본값: 매칭 실패
  vi.mocked(findMatchingActiveBom).mockResolvedValue(null);
});

// ════════════════════════════════════════════════════════════════
// 1. MealPlanAccessory CRUD
// ════════════════════════════════════════════════════════════════
describe("MealPlanAccessory", () => {
  describe("createMealPlanAccessory", () => {
    it("FIXED_QUANTITY 모드에서 fixedQuantity가 null이면 FIXED_QUANTITY_REQUIRED throw", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });

      await expect(
        createMealPlanAccessory(COMPANY_ID, MEAL_PLAN_ID, {
          subsidiaryMasterId: "sub-1",
          consumptionMode: "FIXED_QUANTITY",
          fixedQuantity: null,
          required: true,
        }),
      ).rejects.toThrow("FIXED_QUANTITY_REQUIRED");
    });

    it("FIXED_QUANTITY 모드에서 quantity는 fixedQuantity로 자동 세팅된다", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });
      mockPrisma.mealPlanAccessory.create.mockResolvedValueOnce({
        id: "acc-1",
      });

      await createMealPlanAccessory(COMPANY_ID, MEAL_PLAN_ID, {
        subsidiaryMasterId: "sub-1",
        consumptionMode: "FIXED_QUANTITY",
        fixedQuantity: 50,
        required: true,
      });

      expect(mockPrisma.mealPlanAccessory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consumptionMode: "FIXED_QUANTITY",
            fixedQuantity: 50,
            quantity: 50, // ← 자동 세팅 검증
          }),
        }),
      );
    });

    it("PER_MEAL_COUNT 모드에서 quantity는 0으로 초기화된다", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });
      mockPrisma.mealPlanAccessory.create.mockResolvedValueOnce({
        id: "acc-2",
      });

      await createMealPlanAccessory(COMPANY_ID, MEAL_PLAN_ID, {
        subsidiaryMasterId: "sub-1",
        consumptionMode: "PER_MEAL_COUNT",
        required: true,
      });

      expect(mockPrisma.mealPlanAccessory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consumptionMode: "PER_MEAL_COUNT",
            quantity: 0,
          }),
        }),
      );
    });

    it("subsidiary가 다른 회사 소속이면 SUBSIDIARY_NOT_FOUND throw", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce(null);

      await expect(
        createMealPlanAccessory(COMPANY_ID, MEAL_PLAN_ID, {
          subsidiaryMasterId: "other-company-sub",
          consumptionMode: "PER_MEAL_COUNT",
          required: true,
        }),
      ).rejects.toThrow("SUBSIDIARY_NOT_FOUND");
    });

    it("mealPlan이 다른 회사 소속이면 NOT_FOUND throw", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(null);

      await expect(
        createMealPlanAccessory(COMPANY_ID, MEAL_PLAN_ID, {
          subsidiaryMasterId: "sub-1",
          consumptionMode: "PER_MEAL_COUNT",
          required: true,
        }),
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("updateMealPlanAccessory", () => {
    it("모드를 PER_MEAL_COUNT→FIXED_QUANTITY로 바꿀 때 fixedQuantity 없으면 FIXED_QUANTITY_REQUIRED", async () => {
      mockPrisma.mealPlanAccessory.findFirst.mockResolvedValueOnce({
        id: "acc-1",
        consumptionMode: "PER_MEAL_COUNT",
        fixedQuantity: null,
      });

      await expect(
        updateMealPlanAccessory(COMPANY_ID, "acc-1", {
          consumptionMode: "FIXED_QUANTITY",
        }),
      ).rejects.toThrow("FIXED_QUANTITY_REQUIRED");
    });
  });

  describe("deleteMealPlanAccessory", () => {
    it("soft delete 처리한다 (deletedAt 세팅)", async () => {
      mockPrisma.mealPlanAccessory.findFirst.mockResolvedValueOnce({
        id: "acc-1",
      });
      mockPrisma.mealPlanAccessory.update.mockResolvedValueOnce({
        id: "acc-1",
      });

      await deleteMealPlanAccessory(COMPANY_ID, "acc-1");

      expect(mockPrisma.mealPlanAccessory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "acc-1" },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 2. Phase 7-F1: CONTAINER 슬롯 BOM 매칭 가드
// ════════════════════════════════════════════════════════════════
describe("MealPlanSlot — Phase 7-F1 BOM 가드", () => {
  describe("createMealPlanSlot (CONTAINER)", () => {
    it("ACTIVE BOM 매칭 실패 시 BOM_NOT_MATCHED throw", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });
      mockPrisma.recipe.findFirst.mockResolvedValueOnce({ id: "recipe-1" });
      // findMatchingActiveBom 기본값 null → BOM 없음

      await expect(
        createMealPlanSlot(COMPANY_ID, MEAL_PLAN_ID, {
          kind: "CONTAINER",
          subsidiaryMasterId: "sub-1",
          containerSlotIndex: 0,
          recipeId: "recipe-1",
          quantity: 100,
          sortOrder: 0,
        }),
      ).rejects.toThrow("BOM_NOT_MATCHED");
    });

    it("BOM 매칭 성공 시 recipeBomId가 서버에서 자동으로 채워진다", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });
      mockPrisma.recipe.findFirst.mockResolvedValueOnce({ id: "recipe-1" });
      vi.mocked(findMatchingActiveBom).mockResolvedValueOnce({
        bomId: "bom-1",
        slotId: "bomslot-1",
        totalWeightG: 250,
      });
      mockPrisma.mealPlanSlot.create.mockResolvedValueOnce({ id: "slot-1" });

      await createMealPlanSlot(COMPANY_ID, MEAL_PLAN_ID, {
        kind: "CONTAINER",
        subsidiaryMasterId: "sub-1",
        containerSlotIndex: 0,
        recipeId: "recipe-1",
        quantity: 100,
        sortOrder: 0,
      });

      expect(mockPrisma.mealPlanSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipeBomId: "bom-1", // ← 서버 자동 매핑
          }),
        }),
      );
    });
  });

  describe("bulkCreateContainerSlots", () => {
    it("행 중 하나라도 BOM 매칭 실패 시 전체 abort (BOM_NOT_MATCHED)", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });
      mockPrisma.recipe.findMany.mockResolvedValueOnce([
        { id: "recipe-1" },
        { id: "recipe-2" },
      ]);
      // 첫 행 OK, 둘째 행 실패
      vi.mocked(findMatchingActiveBom)
        .mockResolvedValueOnce({ bomId: "bom-1", slotId: "s", totalWeightG: 100 })
        .mockResolvedValueOnce(null);

      await expect(
        bulkCreateContainerSlots(COMPANY_ID, MEAL_PLAN_ID, {
          subsidiaryMasterId: "sub-1",
          items: [
            { containerSlotIndex: 0, recipeId: "recipe-1", quantity: 100 },
            { containerSlotIndex: 1, recipeId: "recipe-2", quantity: 100 },
          ],
        }),
      ).rejects.toThrow("BOM_NOT_MATCHED");

      // createMany는 호출되지 않아야 함 (전체 abort)
      expect(mockPrisma.mealPlanSlot.createMany).not.toHaveBeenCalled();
    });

    it("recipeId가 null인 행은 BOM 검증을 건너뛰고 정상 생성한다", async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValueOnce({
        id: "sub-1",
      });
      mockPrisma.recipe.findMany.mockResolvedValueOnce([]);
      mockPrisma.mealPlanSlot.findFirst.mockResolvedValueOnce(null); // sortOrder 시작점
      mockPrisma.mealPlanSlot.createMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.mealPlanSlot.findMany.mockResolvedValueOnce([]);

      await bulkCreateContainerSlots(COMPANY_ID, MEAL_PLAN_ID, {
        subsidiaryMasterId: "sub-1",
        items: [
          { containerSlotIndex: 0, recipeId: null, quantity: 0 },
          { containerSlotIndex: 1, recipeId: null, quantity: 0 },
        ],
      });

      // findMatchingActiveBom은 호출되지 않아야 함
      expect(findMatchingActiveBom).not.toHaveBeenCalled();
      expect(mockPrisma.mealPlanSlot.createMany).toHaveBeenCalled();
    });
  });

  describe("updateMealPlanSlot (CONTAINER)", () => {
    it("recipeId=null로 설정 시 recipe와 recipeBom이 disconnect된다", async () => {
      mockPrisma.mealPlanSlot.findFirst.mockResolvedValueOnce({
        id: "slot-1",
        kind: "CONTAINER",
        subsidiaryMasterId: "sub-1",
        containerSlotIndex: 0,
      });
      mockPrisma.mealPlanSlot.update.mockResolvedValueOnce({ id: "slot-1" });

      await updateMealPlanSlot(COMPANY_ID, "slot-1", {
        kind: "CONTAINER",
        recipeId: null,
      });

      expect(mockPrisma.mealPlanSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipe: { disconnect: true },
            recipeBom: { disconnect: true },
          }),
        }),
      );
      expect(findMatchingActiveBom).not.toHaveBeenCalled();
    });

    it("recipeId 변경 시 최종 (subsidiary, slotIndex)로 BOM 재검증", async () => {
      mockPrisma.mealPlanSlot.findFirst.mockResolvedValueOnce({
        id: "slot-1",
        kind: "CONTAINER",
        subsidiaryMasterId: "sub-1",
        containerSlotIndex: 0,
      });
      mockPrisma.recipe.findFirst.mockResolvedValueOnce({ id: "recipe-2" });
      vi.mocked(findMatchingActiveBom).mockResolvedValueOnce({
        bomId: "bom-2",
        slotId: "s",
        totalWeightG: 300,
      });
      mockPrisma.mealPlanSlot.update.mockResolvedValueOnce({ id: "slot-1" });

      await updateMealPlanSlot(COMPANY_ID, "slot-1", {
        kind: "CONTAINER",
        recipeId: "recipe-2",
      });

      expect(findMatchingActiveBom).toHaveBeenCalledWith("recipe-2", "sub-1", 0);
      expect(mockPrisma.mealPlanSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipeBom: { connect: { id: "bom-2" } },
          }),
        }),
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 3. MealPlanGroup / MealPlan
// ════════════════════════════════════════════════════════════════
describe("MealPlanGroup / MealPlan", () => {
  it("createMealPlanGroup 중복 날짜 시 DUPLICATE_PLAN_DATE", async () => {
    // Prisma.PrismaClientKnownRequestError P2002 시뮬레이트
    const { Prisma } = await import("@prisma/client");
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "5.0.0" },
    );
    mockPrisma.mealPlanGroup.create.mockRejectedValueOnce(p2002);

    await expect(
      createMealPlanGroup(COMPANY_ID, { planDate: "2026-06-10" }),
    ).rejects.toThrow("DUPLICATE_PLAN_DATE");
  });

  // createMealPlan DUPLICATE_MEAL_PLAN, LINEUP_NOT_FOUND 등 추가 케이스는
  // 위 패턴을 그대로 따라 확장하시면 됩니다.
});

// ════════════════════════════════════════════════════════════════
// 4. MealCount upsert (간단 케이스 1개만 — 확장 자율)
// ════════════════════════════════════════════════════════════════
describe("MealCount", () => {
  it("upsertMealCount는 (group, slot, lineup) 키로 upsert한다", async () => {
    mockPrisma.mealPlanGroup.findFirst.mockResolvedValueOnce({
      id: MEAL_PLAN_GROUP_ID,
    });
    mockPrisma.lineup.findFirst.mockResolvedValueOnce({ id: "lineup-1" });
    mockPrisma.companyMealSlot.findUnique.mockResolvedValueOnce({
      id: "cms-1",
      companyId: COMPANY_ID,
      deletedAt: null,
    });
    mockPrisma.mealCount.upsert.mockResolvedValueOnce({ id: "mc-1" });

    await upsertMealCount(COMPANY_ID, MEAL_PLAN_GROUP_ID, {
      companyMealSlotId: "cms-1",
      lineupId: "lineup-1",
      estimatedCount: 100,
      finalCount: 95,
    });

    expect(mockPrisma.mealCount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mealPlanGroupId_companyMealSlotId_lineupId: {
            mealPlanGroupId: MEAL_PLAN_GROUP_ID,
            companyMealSlotId: "cms-1",
            lineupId: "lineup-1",
          },
        },
      }),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// 5. applyMealTemplate (간단 케이스 1개 — 이름 매핑 검증)
// ════════════════════════════════════════════════════════════════
describe("applyMealTemplate", () => {
  it("MealTemplateAccessory의 consumptionType/isRequired를 MealPlanAccessory의 consumptionMode/required로 매핑", async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValueOnce(MEAL_PLAN_RECORD);
    mockPrisma.mealTemplate.findFirst.mockResolvedValueOnce({
      id: "tmpl-1",
      containers: [],
      accessories: [
        {
          subsidiaryMasterId: "sub-acc-1",
          consumptionType: "FIXED_QUANTITY",
          fixedQuantity: 30,
          isRequired: true,
        },
      ],
    });
    mockPrisma.mealPlanSlot.findFirst.mockResolvedValueOnce(null);
    mockPrisma.mealPlanSlot.createMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.mealPlanAccessory.createMany.mockResolvedValueOnce({ count: 1 });

    await applyMealTemplate(COMPANY_ID, MEAL_PLAN_ID, {
      mealTemplateId: "tmpl-1",
      replaceExisting: true,
    });

    expect(mockPrisma.mealPlanAccessory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            consumptionMode: "FIXED_QUANTITY", // ← 매핑 확인
            required: true,                    // ← 매핑 확인
          }),
        ]),
      }),
    );
  });
});
