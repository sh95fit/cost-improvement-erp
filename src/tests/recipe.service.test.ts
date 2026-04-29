import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// withTransaction mock
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

import {
  getRecipes,
  getRecipeById,
  getRecipeByCode,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getVariantsByRecipeId,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
} from "@/features/recipe/services/recipe.service";

describe("recipe.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getRecipes ──
  describe("getRecipes", () => {
    it("should include deletedAt: null in where clause", async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      await getRecipes("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const whereArg = mockPrisma.recipe.findMany.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.companyId).toBe("company-1");
    });

    it("should apply search filter with OR condition", async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      await getRecipes("company-1", {
        page: 1,
        limit: 20,
        search: "김치찌개",
        sortBy: "name",
        sortOrder: "asc",
      });

      const whereArg = mockPrisma.recipe.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(2);
    });

    it("should calculate pagination correctly", async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(45);

      const result = await getRecipes("company-1", {
        page: 2,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });

      const findManyArgs = mockPrisma.recipe.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(20);
      expect(findManyArgs.take).toBe(20);
    });

    it("should include variants with deletedAt: null filter", async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      await getRecipes("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const includeArg = mockPrisma.recipe.findMany.mock.calls[0][0].include;
      expect(includeArg.variants).toBeDefined();
      expect(includeArg.variants.where.deletedAt).toBeNull();
    });
  });

  // ── getRecipeById ──
  describe("getRecipeById", () => {
    it("should query with companyId, id, and deletedAt: null", async () => {
      const mockRecipe = { id: "rcp-1", name: "김치찌개", companyId: "company-1" };
      mockPrisma.recipe.findFirst.mockResolvedValue(mockRecipe);

      const result = await getRecipeById("company-1", "rcp-1");

      expect(result).toEqual(mockRecipe);
      const whereArg = mockPrisma.recipe.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({ id: "rcp-1", companyId: "company-1", deletedAt: null });
    });

    it("should filter variants and boms by deletedAt: null", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);

      await getRecipeById("company-1", "rcp-1");

      const includeArg = mockPrisma.recipe.findFirst.mock.calls[0][0].include;
      expect(includeArg.variants.where.deletedAt).toBeNull();
      expect(includeArg.variants.include.boms.where.deletedAt).toBeNull();
    });

    it("should return null when not found", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);

      const result = await getRecipeById("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── getRecipeByCode ──
  describe("getRecipeByCode", () => {
    it("should query with deletedAt: null", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);

      await getRecipeByCode("company-1", "RCP-001");

      const whereArg = mockPrisma.recipe.findFirst.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.code).toBe("RCP-001");
    });
  });

  // ── createRecipe ──
  describe("createRecipe", () => {
    it("should auto-generate code RCP-001 when no recipes exist", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);
      mockPrisma.recipe.create.mockResolvedValue({
        id: "new-id",
        code: "RCP-001",
        name: "김치찌개",
      });

      const result = await createRecipe("company-1", { name: "김치찌개" });

      expect(result.code).toBe("RCP-001");
      const createArg = mockPrisma.recipe.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("RCP-001");
      expect(createArg.companyId).toBe("company-1");
    });

    it("should increment code from last existing recipe", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({ code: "RCP-005" });
      mockPrisma.recipe.create.mockResolvedValue({
        id: "new-id",
        code: "RCP-006",
        name: "된장찌개",
      });

      await createRecipe("company-1", { name: "된장찌개" });

      const createArg = mockPrisma.recipe.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("RCP-006");
    });
  });

  // ── updateRecipe ──
  describe("updateRecipe", () => {
    it("should update recipe fields", async () => {
      mockPrisma.recipe.update.mockResolvedValue({
        id: "rcp-1",
        name: "수정된 레시피",
      });

      const result = await updateRecipe("company-1", "rcp-1", { name: "수정된 레시피" });

      expect(result.name).toBe("수정된 레시피");
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: "rcp-1" },
        data: { name: "수정된 레시피" },
      });
    });
  });

  // ── deleteRecipe ──
  describe("deleteRecipe", () => {
    it("should soft-delete recipe and cascade to variants and BOMs", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({
        id: "rcp-1",
        companyId: "company-1",
        deletedAt: null,
        variants: [{ id: "var-1" }, { id: "var-2" }],
      });
      mockPrisma.bOM.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.recipeVariant.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.recipe.update.mockResolvedValue({ id: "rcp-1" });

      await deleteRecipe("company-1", "rcp-1");

      // BOM soft-delete 확인
      expect(mockPrisma.bOM.updateMany).toHaveBeenCalledWith({
        where: {
          recipeVariantId: { in: ["var-1", "var-2"] },
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });

      // Variant soft-delete 확인
      expect(mockPrisma.recipeVariant.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["var-1", "var-2"] },
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });

      // Recipe soft-delete 확인
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: "rcp-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should return null when recipe not found", async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);

      const result = await deleteRecipe("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── getVariantsByRecipeId ──
  describe("getVariantsByRecipeId", () => {
    it("should filter by recipeId and deletedAt: null", async () => {
      mockPrisma.recipeVariant.findMany.mockResolvedValue([]);

      await getVariantsByRecipeId("rcp-1");

      const args = mockPrisma.recipeVariant.findMany.mock.calls[0][0];
      expect(args.where.recipeId).toBe("rcp-1");
      expect(args.where.deletedAt).toBeNull();
    });

    it("should include only ACTIVE BOMs with deletedAt: null", async () => {
      mockPrisma.recipeVariant.findMany.mockResolvedValue([]);

      await getVariantsByRecipeId("rcp-1");

      const args = mockPrisma.recipeVariant.findMany.mock.calls[0][0];
      expect(args.include.boms.where.status).toBe("ACTIVE");
      expect(args.include.boms.where.deletedAt).toBeNull();
    });
  });

  // ── getVariantById ──
  describe("getVariantById", () => {
    it("should query with deletedAt: null", async () => {
      mockPrisma.recipeVariant.findFirst.mockResolvedValue(null);

      await getVariantById("var-1");

      const args = mockPrisma.recipeVariant.findFirst.mock.calls[0][0];
      expect(args.where.id).toBe("var-1");
      expect(args.where.deletedAt).toBeNull();
    });

    it("should include boms with deletedAt: null filter", async () => {
      mockPrisma.recipeVariant.findFirst.mockResolvedValue(null);

      await getVariantById("var-1");

      const args = mockPrisma.recipeVariant.findFirst.mock.calls[0][0];
      expect(args.include.boms.where.deletedAt).toBeNull();
    });
  });

  // ── createVariant ──
  describe("createVariant", () => {
    it("should create variant with recipeId", async () => {
      mockPrisma.recipeVariant.create.mockResolvedValue({
        id: "new-var",
        variantName: "기본",
        servings: 1,
        recipeId: "rcp-1",
      });

      const result = await createVariant("rcp-1", { variantName: "기본", servings: 1 });

      expect(result.recipeId).toBe("rcp-1");
      const createArg = mockPrisma.recipeVariant.create.mock.calls[0][0].data;
      expect(createArg.recipeId).toBe("rcp-1");
      expect(createArg.variantName).toBe("기본");
    });
  });

  // ── updateVariant ──
  describe("updateVariant", () => {
    it("should update variant fields", async () => {
      mockPrisma.recipeVariant.update.mockResolvedValue({
        id: "var-1",
        variantName: "매운맛",
      });

      const result = await updateVariant("var-1", { variantName: "매운맛" });

      expect(result.variantName).toBe("매운맛");
    });
  });

  // ── deleteVariant ──
  describe("deleteVariant", () => {
    it("should soft-delete variant and cascade BOM soft-delete", async () => {
      mockPrisma.bOM.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.recipeVariant.update.mockResolvedValue({ id: "var-1" });

      await deleteVariant("var-1");

      // BOM soft-delete
      expect(mockPrisma.bOM.updateMany).toHaveBeenCalledWith({
        where: { recipeVariantId: "var-1", deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });

      // Variant soft-delete (not hard delete)
      expect(mockPrisma.recipeVariant.update).toHaveBeenCalledWith({
        where: { id: "var-1" },
        data: { deletedAt: expect.any(Date) },
      });

      // hard delete가 호출되지 않았는지 확인
      expect(mockPrisma.recipeVariant.delete).not.toHaveBeenCalled();
    });
  });
});
