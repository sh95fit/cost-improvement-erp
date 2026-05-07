import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getUnitConversions,
  getUnitConversionById,
  findDuplicateConversion,
  createUnitConversion,
  updateUnitConversion,
  deleteUnitConversion,
} from "@/features/unit-conversion/services/unit-conversion.service";

describe("unit-conversion.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getUnitConversions ──
  describe("getUnitConversions", () => {
    it("should filter by companyId", async () => {
      mockPrisma.unitConversion.findMany.mockResolvedValue([]);
      mockPrisma.unitConversion.count.mockResolvedValue(0);

      await getUnitConversions("company-1", {
        page: 1,
        limit: 20,
        scope: "all",
      });

      const whereArg = mockPrisma.unitConversion.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toBe("company-1");
    });

    it("should filter global scope (materialMasterId = null)", async () => {
      mockPrisma.unitConversion.findMany.mockResolvedValue([]);
      mockPrisma.unitConversion.count.mockResolvedValue(0);

      await getUnitConversions("company-1", {
        page: 1,
        limit: 20,
        scope: "global",
      });

      const whereArg = mockPrisma.unitConversion.findMany.mock.calls[0][0].where;
      expect(whereArg.materialMasterId).toBeNull();
    });

    it("should filter material scope (materialMasterId not null)", async () => {
      mockPrisma.unitConversion.findMany.mockResolvedValue([]);
      mockPrisma.unitConversion.count.mockResolvedValue(0);

      await getUnitConversions("company-1", {
        page: 1,
        limit: 20,
        scope: "material",
      });

      const whereArg = mockPrisma.unitConversion.findMany.mock.calls[0][0].where;
      expect(whereArg.materialMasterId).toEqual({ not: null });
    });

    it("should filter by specific materialId", async () => {
      mockPrisma.unitConversion.findMany.mockResolvedValue([]);
      mockPrisma.unitConversion.count.mockResolvedValue(0);

      await getUnitConversions("company-1", {
        page: 1,
        limit: 20,
        scope: "all",
        materialId: "mat-1",
      });

      const whereArg = mockPrisma.unitConversion.findMany.mock.calls[0][0].where;
      expect(whereArg.materialMasterId).toBe("mat-1");
    });

    it("should include materialMaster in result", async () => {
      mockPrisma.unitConversion.findMany.mockResolvedValue([]);
      mockPrisma.unitConversion.count.mockResolvedValue(0);

      await getUnitConversions("company-1", { page: 1, limit: 20, scope: "all" });

      const includeArg = mockPrisma.unitConversion.findMany.mock.calls[0][0].include;
      expect(includeArg.materialMaster).toBeDefined();
    });
  });

  // ── findDuplicateConversion ──
  describe("findDuplicateConversion", () => {
    it("should check for global duplicate", async () => {
      mockPrisma.unitConversion.findFirst.mockResolvedValue(null);

      await findDuplicateConversion("company-1", null, null, "kg", "g");

      const whereArg = mockPrisma.unitConversion.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({
        companyId: "company-1",
        materialMasterId: null,
        subsidiaryMasterId: null,
        fromUnit: "kg",
        toUnit: "g",
      });
    });

    it("should check for material-specific duplicate", async () => {
      mockPrisma.unitConversion.findFirst.mockResolvedValue({ id: "uc-1" });

      const result = await findDuplicateConversion("company-1", "mat-1", null, "팩", "개");

      expect(result).toEqual({ id: "uc-1" });
      const whereArg = mockPrisma.unitConversion.findFirst.mock.calls[0][0].where;
      expect(whereArg.materialMasterId).toBe("mat-1");
      expect(whereArg.subsidiaryMasterId).toBeNull();
    });
  });

  // ── createUnitConversion ──
  describe("createUnitConversion", () => {
    it("should create with companyId and input fields", async () => {
      const mockResult = { id: "uc-new", fromUnit: "kg", toUnit: "g", factor: 1000 };
      mockPrisma.unitConversion.create.mockResolvedValue(mockResult);

      const result = await createUnitConversion("company-1", {
        materialMasterId: null,
        subsidiaryMasterId: null,
        fromUnit: "kg",
        toUnit: "g",
        factor: 1000,
        unitCategory: "WEIGHT" as never,
      });

      expect(result).toEqual(mockResult);
      const dataArg = mockPrisma.unitConversion.create.mock.calls[0][0].data;
      expect(dataArg.companyId).toBe("company-1");
      expect(dataArg.factor).toBe(1000);
    });
  });

  // ── deleteUnitConversion ──
  describe("deleteUnitConversion", () => {
    it("should delete when found", async () => {
      mockPrisma.unitConversion.findFirst.mockResolvedValue({ id: "uc-1" });
      mockPrisma.unitConversion.delete.mockResolvedValue({ id: "uc-1" });

      const result = await deleteUnitConversion("uc-1");

      expect(result).toEqual({ id: "uc-1" });
      expect(mockPrisma.unitConversion.delete).toHaveBeenCalledWith({
        where: { id: "uc-1" },
      });
    });

    it("should return null when not found", async () => {
      mockPrisma.unitConversion.findFirst.mockResolvedValue(null);

      const result = await deleteUnitConversion("non-existent");

      expect(result).toBeNull();
      expect(mockPrisma.unitConversion.delete).not.toHaveBeenCalled();
    });
  });
});
