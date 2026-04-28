import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// mock 이후에 서비스 import
import {
  getMaterials,
  getMaterialById,
  getMaterialByCode,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  setDefaultSupplierItem,
} from "@/features/material/services/material.service";

describe("material.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getMaterials ──
  describe("getMaterials", () => {
    it("should include deletedAt: null in where clause", async () => {
      const mockItems = [
        { id: "1", name: "양배추", code: "MAT-001", deletedAt: null },
      ];
      mockPrisma.materialMaster.findMany.mockResolvedValue(mockItems);
      mockPrisma.materialMaster.count.mockResolvedValue(1);

      const result = await getMaterials("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result.items).toEqual(mockItems);
      expect(result.pagination.total).toBe(1);

      // deletedAt: null 조건 확인
      const whereArg = mockPrisma.materialMaster.findMany.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.companyId).toBe("company-1");
    });

    it("should apply search filter with OR condition", async () => {
      mockPrisma.materialMaster.findMany.mockResolvedValue([]);
      mockPrisma.materialMaster.count.mockResolvedValue(0);

      await getMaterials("company-1", {
        page: 1,
        limit: 20,
        search: "양배추",
        sortBy: "name",
        sortOrder: "asc",
      });

      const whereArg = mockPrisma.materialMaster.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(2);
    });

    it("should apply materialType and stockGrade filters", async () => {
      mockPrisma.materialMaster.findMany.mockResolvedValue([]);
      mockPrisma.materialMaster.count.mockResolvedValue(0);

      await getMaterials("company-1", {
        page: 1,
        limit: 20,
        materialType: "RAW" as never,
        stockGrade: "A" as never,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const whereArg = mockPrisma.materialMaster.findMany.mock.calls[0][0].where;
      expect(whereArg.materialType).toBe("RAW");
      expect(whereArg.stockGrade).toBe("A");
    });

    it("should calculate pagination correctly", async () => {
      mockPrisma.materialMaster.findMany.mockResolvedValue([]);
      mockPrisma.materialMaster.count.mockResolvedValue(45);

      const result = await getMaterials("company-1", {
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

      const findManyArgs = mockPrisma.materialMaster.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(20);
      expect(findManyArgs.take).toBe(20);
    });

    it("should include defaultSupplierItem with supplier", async () => {
      mockPrisma.materialMaster.findMany.mockResolvedValue([]);
      mockPrisma.materialMaster.count.mockResolvedValue(0);

      await getMaterials("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const includeArg = mockPrisma.materialMaster.findMany.mock.calls[0][0].include;
      expect(includeArg.defaultSupplierItem).toBeDefined();
      expect(includeArg.defaultSupplierItem.include.supplier).toBeDefined();
    });
  });

  // ── getMaterialById ──
  describe("getMaterialById", () => {
    it("should query with companyId, id, and deletedAt: null", async () => {
      const mockMaterial = { id: "mat-1", name: "양배추", companyId: "company-1" };
      mockPrisma.materialMaster.findFirst.mockResolvedValue(mockMaterial);

      const result = await getMaterialById("company-1", "mat-1");

      expect(result).toEqual(mockMaterial);
      const whereArg = mockPrisma.materialMaster.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({ id: "mat-1", companyId: "company-1", deletedAt: null });
    });

    it("should return null when not found", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);

      const result = await getMaterialById("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── getMaterialByCode ──
  describe("getMaterialByCode", () => {
    it("should query with deletedAt: null", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);

      await getMaterialByCode("company-1", "MAT-001");

      const whereArg = mockPrisma.materialMaster.findFirst.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.code).toBe("MAT-001");
    });
  });

  // ── createMaterial ──
  describe("createMaterial", () => {
    it("should auto-generate code MAT-001 when no materials exist", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);
      mockPrisma.materialMaster.create.mockResolvedValue({
        id: "new-id",
        code: "MAT-001",
        name: "양배추",
      });

      const result = await createMaterial("company-1", {
        name: "양배추",
        materialType: "RAW" as never,
        unit: "kg",
        unitCategory: "WEIGHT" as never,
      });

      expect(result.code).toBe("MAT-001");
      const createArg = mockPrisma.materialMaster.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("MAT-001");
      expect(createArg.companyId).toBe("company-1");
    });

    it("should increment code from last existing material", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({ code: "MAT-005" });
      mockPrisma.materialMaster.create.mockResolvedValue({
        id: "new-id",
        code: "MAT-006",
        name: "당근",
      });

      await createMaterial("company-1", {
        name: "당근",
        materialType: "RAW" as never,
        unit: "kg",
        unitCategory: "WEIGHT" as never,
      });

      const createArg = mockPrisma.materialMaster.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("MAT-006");
    });
  });

  // ── deleteMaterial (soft-delete) ──
  describe("deleteMaterial", () => {
    it("should set deletedAt instead of hard-deleting", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
        deletedAt: null,
      });
      mockPrisma.materialMaster.update.mockResolvedValue({ id: "mat-1" });

      await deleteMaterial("company-1", "mat-1");

      expect(mockPrisma.materialMaster.update).toHaveBeenCalledWith({
        where: { id: "mat-1" },
        data: { deletedAt: expect.any(Date) },
      });
      // hard delete가 호출되지 않았는지 확인
      expect(mockPrisma.materialMaster.delete).not.toHaveBeenCalled();
    });

    it("should return null when material not found", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);

      const result = await deleteMaterial("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── setDefaultSupplierItem ──
  describe("setDefaultSupplierItem", () => {
    it("should update defaultSupplierItemId", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
      });
      mockPrisma.materialMaster.update.mockResolvedValue({ id: "mat-1" });

      await setDefaultSupplierItem("company-1", "mat-1", "si-1");

      expect(mockPrisma.materialMaster.update).toHaveBeenCalledWith({
        where: { id: "mat-1" },
        data: { defaultSupplierItemId: "si-1" },
      });
    });

    it("should allow clearing default (null)", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
      });
      mockPrisma.materialMaster.update.mockResolvedValue({ id: "mat-1" });

      await setDefaultSupplierItem("company-1", "mat-1", null);

      expect(mockPrisma.materialMaster.update).toHaveBeenCalledWith({
        where: { id: "mat-1" },
        data: { defaultSupplierItemId: null },
      });
    });

    it("should throw NOT_FOUND when material does not exist", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);

      await expect(
        setDefaultSupplierItem("company-1", "non-existent", "si-1")
      ).rejects.toThrow("NOT_FOUND");
    });
  });
});
