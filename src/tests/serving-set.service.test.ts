import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

import {
  getServingSetsByVariant,
  getServingSetById,
  getNextServingSetVersion,
  createServingSet,
  updateServingSetStatus,
  deleteServingSet,
  addServingSetItem,
  updateServingSetItem,
  deleteServingSetItem,
  updateVariantBaseWeight,
} from "@/features/recipe/services/serving-set.service";

describe("serving-set.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getServingSetsByVariant", () => {
    it("should filter by companyId, recipeVariantId, and deletedAt: null", async () => {
      mockPrisma.servingSet.findMany.mockResolvedValue([]);

      await getServingSetsByVariant("company-1", "var-1");

      const args = mockPrisma.servingSet.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBe("company-1");
      expect(args.where.recipeVariantId).toBe("var-1");
      expect(args.where.deletedAt).toBeNull();
    });

    it("should include items with containerGroup and slots", async () => {
      mockPrisma.servingSet.findMany.mockResolvedValue([]);

      await getServingSetsByVariant("company-1", "var-1");

      const args = mockPrisma.servingSet.findMany.mock.calls[0][0];
      expect(args.include.items).toBeDefined();
      expect(args.include.items.include.containerGroup).toBeDefined();
    });
  });

  describe("getServingSetById", () => {
    it("should query with id, companyId, and deletedAt: null", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue(null);

      await getServingSetById("company-1", "ss-1");

      const args = mockPrisma.servingSet.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: "ss-1", companyId: "company-1", deletedAt: null });
    });
  });

  describe("getNextServingSetVersion", () => {
    it("should return 1 when no sets exist", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue(null);

      const version = await getNextServingSetVersion("company-1", "var-1");
      expect(version).toBe(1);
    });

    it("should return latest version + 1", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue({ version: 3 });

      const version = await getNextServingSetVersion("company-1", "var-1");
      expect(version).toBe(4);
    });
  });

  describe("createServingSet", () => {
    it("should create with companyId", async () => {
      const input = { recipeVariantId: "var-1", version: 1, status: "DRAFT" as const };
      mockPrisma.servingSet.create.mockResolvedValue({ id: "ss-new", ...input, companyId: "company-1" });

      const result = await createServingSet("company-1", input);
      expect(result.companyId).toBe("company-1");
    });
  });

  describe("updateServingSetStatus", () => {
    it("should throw NOT_FOUND when set does not exist", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue(null);

      await expect(
        updateServingSetStatus("company-1", "non-existent", { status: "ACTIVE" as const })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("should archive existing ACTIVE sets when activating", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue({
        id: "ss-2",
        companyId: "company-1",
        recipeVariantId: "var-1",
        status: "DRAFT",
        deletedAt: null,
      });
      mockPrisma.servingSet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.servingSet.update.mockResolvedValue({ id: "ss-2", status: "ACTIVE" });

      await updateServingSetStatus("company-1", "ss-2", { status: "ACTIVE" as const });

      expect(mockPrisma.servingSet.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          recipeVariantId: "var-1",
          status: "ACTIVE",
          deletedAt: null,
          id: { not: "ss-2" },
        },
        data: { status: "ARCHIVED" },
      });
    });

    it("should not archive when changing to non-ACTIVE status", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue({
        id: "ss-1",
        companyId: "company-1",
        recipeVariantId: "var-1",
        status: "ACTIVE",
        deletedAt: null,
      });
      mockPrisma.servingSet.update.mockResolvedValue({ id: "ss-1", status: "ARCHIVED" });

      await updateServingSetStatus("company-1", "ss-1", { status: "ARCHIVED" as const });

      expect(mockPrisma.servingSet.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("deleteServingSet", () => {
    it("should soft-delete by setting deletedAt", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue({
        id: "ss-1", companyId: "company-1", deletedAt: null,
      });
      mockPrisma.servingSet.update.mockResolvedValue({ id: "ss-1" });

      await deleteServingSet("company-1", "ss-1");

      expect(mockPrisma.servingSet.update).toHaveBeenCalledWith({
        where: { id: "ss-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should return null when not found", async () => {
      mockPrisma.servingSet.findFirst.mockResolvedValue(null);

      const result = await deleteServingSet("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  describe("addServingSetItem", () => {
    it("should create item with servingSetId", async () => {
      const input = {
        containerGroupId: "cg-1",
        slotIndex: 1,
        servingWeightG: 40,
        sortOrder: 0,
      };
      mockPrisma.servingSetItem.create.mockResolvedValue({
        id: "ssi-1", servingSetId: "ss-1", ...input,
      });

      const result = await addServingSetItem("ss-1", input);
      expect(result.servingSetId).toBe("ss-1");
      expect(result.servingWeightG).toBe(40);
    });
  });

  describe("updateServingSetItem", () => {
    it("should update weight", async () => {
      mockPrisma.servingSetItem.update.mockResolvedValue({
        id: "ssi-1", servingWeightG: 45,
      });

      const result = await updateServingSetItem("ssi-1", { servingWeightG: 45 });
      expect(result.servingWeightG).toBe(45);
    });
  });

  describe("deleteServingSetItem", () => {
    it("should hard-delete item", async () => {
      mockPrisma.servingSetItem.delete.mockResolvedValue({ id: "ssi-1" });

      await deleteServingSetItem("ssi-1");

      expect(mockPrisma.servingSetItem.delete).toHaveBeenCalledWith({
        where: { id: "ssi-1" },
      });
    });
  });

  describe("updateVariantBaseWeight", () => {
    it("should update baseWeightG on RecipeVariant", async () => {
      mockPrisma.recipeVariant.update.mockResolvedValue({
        id: "var-1", baseWeightG: 300,
      });

      const result = await updateVariantBaseWeight("var-1", 300);
      expect(result.baseWeightG).toBe(300);
      expect(mockPrisma.recipeVariant.update).toHaveBeenCalledWith({
        where: { id: "var-1" },
        data: { baseWeightG: 300 },
      });
    });

    it("should allow null for clearing base weight", async () => {
      mockPrisma.recipeVariant.update.mockResolvedValue({
        id: "var-1", baseWeightG: null,
      });

      await updateVariantBaseWeight("var-1", null);

      expect(mockPrisma.recipeVariant.update).toHaveBeenCalledWith({
        where: { id: "var-1" },
        data: { baseWeightG: null },
      });
    });
  });
});
