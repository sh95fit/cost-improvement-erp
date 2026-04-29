import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// withTransaction mock
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

import {
  getBOMsByOwner,
  getBOMById,
  getNextBOMVersion,
  createBOM,
  updateBOMStatus,
  deleteBOM,
  addBOMItem,
  updateBOMItem,
  deleteBOMItem,
  replaceBOMItems,
} from "@/features/recipe/services/bom.service";

describe("bom.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getBOMsByOwner ──
  describe("getBOMsByOwner", () => {
    it("should filter by ownerType RECIPE_VARIANT with deletedAt: null", async () => {
      mockPrisma.bOM.findMany.mockResolvedValue([]);

      await getBOMsByOwner("company-1", "RECIPE_VARIANT", "var-1");

      const args = mockPrisma.bOM.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBe("company-1");
      expect(args.where.deletedAt).toBeNull();
      expect(args.where.ownerType).toBe("RECIPE_VARIANT");
      expect(args.where.recipeVariantId).toBe("var-1");
    });

    it("should filter by ownerType SEMI_PRODUCT with deletedAt: null", async () => {
      mockPrisma.bOM.findMany.mockResolvedValue([]);

      await getBOMsByOwner("company-1", "SEMI_PRODUCT", "sp-1");

      const args = mockPrisma.bOM.findMany.mock.calls[0][0];
      expect(args.where.semiProductId).toBe("sp-1");
      expect(args.where.ownerType).toBe("SEMI_PRODUCT");
    });

    it("should order by version descending", async () => {
      mockPrisma.bOM.findMany.mockResolvedValue([]);

      await getBOMsByOwner("company-1", "RECIPE_VARIANT", "var-1");

      const args = mockPrisma.bOM.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ version: "desc" });
    });

    it("should include items with materialMaster and subsidiaryMaster", async () => {
      mockPrisma.bOM.findMany.mockResolvedValue([]);

      await getBOMsByOwner("company-1", "RECIPE_VARIANT", "var-1");

      const args = mockPrisma.bOM.findMany.mock.calls[0][0];
      expect(args.include.items).toBeDefined();
      expect(args.include.items.include.materialMaster).toBeDefined();
      expect(args.include.items.include.subsidiaryMaster).toBeDefined();
    });
  });

  // ── getBOMById ──
  describe("getBOMById", () => {
    it("should query with id, companyId, and deletedAt: null", async () => {
      const mockBOM = { id: "bom-1", companyId: "company-1", version: 1 };
      mockPrisma.bOM.findFirst.mockResolvedValue(mockBOM);

      const result = await getBOMById("company-1", "bom-1");

      expect(result).toEqual(mockBOM);
      const whereArg = mockPrisma.bOM.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({ id: "bom-1", companyId: "company-1", deletedAt: null });
    });

    it("should return null when not found", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      const result = await getBOMById("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── getNextBOMVersion ──
  describe("getNextBOMVersion", () => {
    it("should return 1 when no BOMs exist", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      const version = await getNextBOMVersion("company-1", "RECIPE_VARIANT", "var-1");

      expect(version).toBe(1);
    });

    it("should return latest version + 1", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({ version: 3 });

      const version = await getNextBOMVersion("company-1", "RECIPE_VARIANT", "var-1");

      expect(version).toBe(4);
    });

    it("should filter by deletedAt: null", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      await getNextBOMVersion("company-1", "SEMI_PRODUCT", "sp-1");

      const args = mockPrisma.bOM.findFirst.mock.calls[0][0];
      expect(args.where.deletedAt).toBeNull();
      expect(args.where.semiProductId).toBe("sp-1");
    });
  });

  // ── createBOM ──
  describe("createBOM", () => {
    it("should create BOM with companyId", async () => {
      const input = {
        ownerType: "RECIPE_VARIANT" as const,
        recipeVariantId: "var-1",
        version: 1,
        status: "DRAFT" as const,
      };
      mockPrisma.bOM.create.mockResolvedValue({
        id: "new-bom",
        ...input,
        companyId: "company-1",
      });

      const result = await createBOM("company-1", input);

      expect(result.companyId).toBe("company-1");
      const createArg = mockPrisma.bOM.create.mock.calls[0][0].data;
      expect(createArg.companyId).toBe("company-1");
    });
  });

  // ── updateBOMStatus ──
  describe("updateBOMStatus", () => {
    it("should throw NOT_FOUND when BOM does not exist", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      await expect(
        updateBOMStatus("company-1", "non-existent", { status: "ACTIVE" as const })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("should archive existing ACTIVE BOM when setting new BOM to ACTIVE", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({
        id: "bom-2",
        companyId: "company-1",
        ownerType: "RECIPE_VARIANT",
        recipeVariantId: "var-1",
        semiProductId: null,
        status: "DRAFT",
        deletedAt: null,
      });
      mockPrisma.bOM.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.bOM.update.mockResolvedValue({ id: "bom-2", status: "ACTIVE" });

      await updateBOMStatus("company-1", "bom-2", { status: "ACTIVE" as const });

      // 기존 ACTIVE BOM을 ARCHIVED로 전환
      expect(mockPrisma.bOM.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          recipeVariantId: "var-1",
          status: "ACTIVE",
          deletedAt: null,
          id: { not: "bom-2" },
        },
        data: { status: "ARCHIVED" },
      });

      // 새 BOM을 ACTIVE로 설정
      expect(mockPrisma.bOM.update).toHaveBeenCalledWith({
        where: { id: "bom-2" },
        data: { status: "ACTIVE" },
      });
    });

    it("should not archive others when changing to non-ACTIVE status", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({
        id: "bom-1",
        companyId: "company-1",
        ownerType: "RECIPE_VARIANT",
        recipeVariantId: "var-1",
        status: "ACTIVE",
        deletedAt: null,
      });
      mockPrisma.bOM.update.mockResolvedValue({ id: "bom-1", status: "ARCHIVED" });

      await updateBOMStatus("company-1", "bom-1", { status: "ARCHIVED" as const });

      // updateMany가 호출되지 않아야 함
      expect(mockPrisma.bOM.updateMany).not.toHaveBeenCalled();

      // 직접 update만 호출
      expect(mockPrisma.bOM.update).toHaveBeenCalledWith({
        where: { id: "bom-1" },
        data: { status: "ARCHIVED" },
      });
    });

    it("should handle SEMI_PRODUCT owner type when activating", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({
        id: "bom-3",
        companyId: "company-1",
        ownerType: "SEMI_PRODUCT",
        recipeVariantId: null,
        semiProductId: "sp-1",
        status: "DRAFT",
        deletedAt: null,
      });
      mockPrisma.bOM.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.bOM.update.mockResolvedValue({ id: "bom-3", status: "ACTIVE" });

      await updateBOMStatus("company-1", "bom-3", { status: "ACTIVE" as const });

      expect(mockPrisma.bOM.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          semiProductId: "sp-1",
          status: "ACTIVE",
          deletedAt: null,
          id: { not: "bom-3" },
        },
        data: { status: "ARCHIVED" },
      });
    });
  });

  // ── deleteBOM ──
  describe("deleteBOM", () => {
    it("should soft-delete BOM by setting deletedAt", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({
        id: "bom-1",
        companyId: "company-1",
        deletedAt: null,
      });
      mockPrisma.bOM.update.mockResolvedValue({ id: "bom-1" });

      await deleteBOM("company-1", "bom-1");

      expect(mockPrisma.bOM.update).toHaveBeenCalledWith({
        where: { id: "bom-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should return null when BOM not found", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      const result = await deleteBOM("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── addBOMItem ──
  describe("addBOMItem", () => {
    it("should create BOMItem with bomId", async () => {
      const input = {
        itemType: "MATERIAL" as const,
        materialMasterId: "mat-1",
        quantity: 1.5,
        unit: "kg",
        sortOrder: 0,
      };
      mockPrisma.bOMItem.create.mockResolvedValue({ id: "item-1", bomId: "bom-1", ...input });

      const result = await addBOMItem("bom-1", input);

      expect(result.bomId).toBe("bom-1");
      const createArg = mockPrisma.bOMItem.create.mock.calls[0][0].data;
      expect(createArg.bomId).toBe("bom-1");
      expect(createArg.quantity).toBe(1.5);
    });
  });

  // ── updateBOMItem ──
  describe("updateBOMItem", () => {
    it("should update BOMItem fields", async () => {
      mockPrisma.bOMItem.update.mockResolvedValue({ id: "item-1", quantity: 2.0 });

      const result = await updateBOMItem("item-1", { quantity: 2.0 });

      expect(result.quantity).toBe(2.0);
      expect(mockPrisma.bOMItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { quantity: 2.0 },
      });
    });
  });

  // ── deleteBOMItem ──
  describe("deleteBOMItem", () => {
    it("should hard-delete BOMItem", async () => {
      mockPrisma.bOMItem.delete.mockResolvedValue({ id: "item-1" });

      await deleteBOMItem("item-1");

      expect(mockPrisma.bOMItem.delete).toHaveBeenCalledWith({
        where: { id: "item-1" },
      });
    });
  });

  // ── replaceBOMItems ──
  describe("replaceBOMItems", () => {
    it("should delete existing items and create new ones in transaction", async () => {
      const newItems = [
        { itemType: "MATERIAL" as const, materialMasterId: "mat-1", quantity: 1, unit: "kg", sortOrder: 0 },
        { itemType: "SUBSIDIARY" as const, subsidiaryMasterId: "sub-1", quantity: 0.5, unit: "L", sortOrder: 1 },
      ];
      mockPrisma.bOMItem.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.bOMItem.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.bOMItem.findMany.mockResolvedValue([
        { id: "new-1", bomId: "bom-1", ...newItems[0] },
        { id: "new-2", bomId: "bom-1", ...newItems[1] },
      ]);

      const result = await replaceBOMItems("bom-1", newItems);

      expect(result).toHaveLength(2);

      // 기존 아이템 삭제
      expect(mockPrisma.bOMItem.deleteMany).toHaveBeenCalledWith({
        where: { bomId: "bom-1" },
      });

      // 새 아이템 생성
      expect(mockPrisma.bOMItem.createMany).toHaveBeenCalled();
    });

    it("should handle empty items array", async () => {
      mockPrisma.bOMItem.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.bOMItem.findMany.mockResolvedValue([]);

      const result = await replaceBOMItems("bom-1", []);

      expect(result).toHaveLength(0);
      expect(mockPrisma.bOMItem.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.bOMItem.createMany).not.toHaveBeenCalled();
    });
  });
});
