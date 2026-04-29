import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// withTransaction mock
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
}));

import {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getIngredientsByRecipeId,
  addIngredient,
  updateIngredient,
  deleteIngredient,
} from "@/features/recipe/services/recipe.service";

describe("recipe.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getRecipes ──
  describe("getRecipes", () => {
    it("페이지네이션과 검색을 지원한다", async () => {
      const mockItems = [
        { id: "r1", name: "김치찌개", code: "RCP-001", ingredients: [], recipeBoms: [] },
      ];
      mockPrisma.recipe.findMany.mockResolvedValue(mockItems);
      mockPrisma.recipe.count.mockResolvedValue(1);

      const result = await getRecipes("company1", {
        page: 1,
        limit: 20,
        search: "김치",
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result.items).toEqual(mockItems);
      expect(result.pagination.total).toBe(1);
      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: "company1",
            deletedAt: null,
          }),
        })
      );
    });
  });

  // ── getRecipeById ──
  describe("getRecipeById", () => {
    it("레시피를 재료 및 RecipeBOM과 함께 조회한다", async () => {
      const mockRecipe = {
        id: "r1",
        name: "김치찌개",
        ingredients: [{ id: "ing1", ingredientType: "MATERIAL" }],
        recipeBoms: [
          {
            id: "rb1",
            version: 1,
            deletedAt: null,
            slots: [],
          },
        ],
      };
      mockPrisma.recipe.findFirst.mockResolvedValue(mockRecipe);

      const result = await getRecipeById("company1", "r1");

      expect(result).toEqual(mockRecipe);
      expect(mockPrisma.recipe.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r1", companyId: "company1", deletedAt: null },
        })
      );
    });

    it("레시피가 없으면 null을 반환한다", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);

      const result = await getRecipeById("company1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ── createRecipe ──
  describe("createRecipe", () => {
    it("코드를 자동 생성하여 레시피를 만든다", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({ code: "RCP-005" });
      mockPrisma.recipe.create.mockResolvedValue({
        id: "r1",
        name: "된장찌개",
        code: "RCP-006",
      });

      const result = await createRecipe("company1", { name: "된장찌개" });

      expect(result.code).toBe("RCP-006");
      expect(mockPrisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "된장찌개",
            companyId: "company1",
            code: "RCP-006",
          }),
        })
      );
    });

    it("첫 번째 레시피는 RCP-001 코드를 받는다", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);
      mockPrisma.recipe.create.mockResolvedValue({
        id: "r1",
        name: "김치찌개",
        code: "RCP-001",
      });

      await createRecipe("company1", { name: "김치찌개" });

      expect(mockPrisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: "RCP-001" }),
        })
      );
    });
  });

  // ── updateRecipe ──
  describe("updateRecipe", () => {
    it("레시피를 수정한다", async () => {
      mockPrisma.recipe.update.mockResolvedValue({
        id: "r1",
        name: "수정된 김치찌개",
      });

      const result = await updateRecipe("company1", "r1", { name: "수정된 김치찌개" });

      expect(result.name).toBe("수정된 김치찌개");
    });
  });

  // ── deleteRecipe ──
  describe("deleteRecipe", () => {
    it("레시피와 연관된 RecipeBOM을 soft-delete하고 재료를 삭제한다", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({
        id: "r1",
        companyId: "company1",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.recipeIngredient.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.recipe.update.mockResolvedValue({ id: "r1", deletedAt: new Date() });

      const result = await deleteRecipe("company1", "r1");

      expect(result).toBeTruthy();
      expect(mockPrisma.recipeBOM.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipeId: "r1", deletedAt: null },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
      expect(mockPrisma.recipeIngredient.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipeId: "r1" },
        })
      );
    });

    it("존재하지 않는 레시피는 null을 반환한다", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);

      const result = await deleteRecipe("company1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ── RecipeIngredient ──
  describe("RecipeIngredient CRUD", () => {
    it("getIngredientsByRecipeId - 재료 목록을 조회한다", async () => {
      const mockIngredients = [
        { id: "ing1", ingredientType: "MATERIAL", materialMaster: { id: "m1" } },
      ];
      mockPrisma.recipeIngredient.findMany.mockResolvedValue(mockIngredients);

      const result = await getIngredientsByRecipeId("r1");

      expect(result).toEqual(mockIngredients);
      expect(mockPrisma.recipeIngredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipeId: "r1" },
          orderBy: { sortOrder: "asc" },
        })
      );
    });

    it("addIngredient - 재료를 추가한다", async () => {
      const mockIngredient = {
        id: "ing1",
        recipeId: "r1",
        ingredientType: "MATERIAL",
        materialMasterId: "m1",
      };
      mockPrisma.recipeIngredient.create.mockResolvedValue(mockIngredient);

      const result = await addIngredient("r1", {
        ingredientType: "MATERIAL" as const,
        materialMasterId: "m1",
        sortOrder: 0,
      });

      expect(result.id).toBe("ing1");
    });

    it("updateIngredient - 재료를 수정한다", async () => {
      mockPrisma.recipeIngredient.update.mockResolvedValue({
        id: "ing1",
        sortOrder: 5,
      });

      const result = await updateIngredient("ing1", { sortOrder: 5 });

      expect(result.sortOrder).toBe(5);
    });

    it("deleteIngredient - 재료를 삭제한다", async () => {
      mockPrisma.recipeIngredient.delete.mockResolvedValue({ id: "ing1" });

      const result = await deleteIngredient("ing1");

      expect(result.id).toBe("ing1");
    });
  });
});
