// src/tests/unit-master.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "./mocks/prisma";

// mock 이후에 서비스 import
import {
  getUnitMasters,
  getUnitMasterById,
  createUnitMaster,
  updateUnitMaster,
  deleteUnitMaster,
  getUnitOptionsByItemType,
} from "@/features/unit-master/services/unit-master.service";

describe("unit-master.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getUnitMasters ──
  describe("getUnitMasters", () => {
    it("should return paginated unit masters", async () => {
      const mockItems = [
        { id: "1", code: "kg", name: "킬로그램", itemType: "MATERIAL", unitCategory: "WEIGHT" },
      ];
      prismaMock.unitMaster.findMany.mockResolvedValue(mockItems);
      prismaMock.unitMaster.count.mockResolvedValue(1);

      const result = await getUnitMasters("company-1", {
        page: 1,
        limit: 100,
        itemType: "MATERIAL" as never,
      });

      expect(result.items).toEqual(mockItems);
      expect(result.pagination.total).toBe(1);
    });

    it("should apply unitCategory filter when provided", async () => {
      prismaMock.unitMaster.findMany.mockResolvedValue([]);
      prismaMock.unitMaster.count.mockResolvedValue(0);

      await getUnitMasters("company-1", {
        page: 1,
        limit: 100,
        itemType: "MATERIAL" as never,
        unitCategory: "WEIGHT" as never,
      });

      const whereArg = prismaMock.unitMaster.findMany.mock.calls[0][0].where;
      expect(whereArg.unitCategory).toBe("WEIGHT");
      expect(whereArg.companyId).toBe("company-1");
    });

    it("should calculate pagination correctly", async () => {
      prismaMock.unitMaster.findMany.mockResolvedValue([]);
      prismaMock.unitMaster.count.mockResolvedValue(50);

      const result = await getUnitMasters("company-1", {
        page: 2,
        limit: 20,
        itemType: "MATERIAL" as never,
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 50,
        totalPages: 3,
      });

      const findManyArgs = prismaMock.unitMaster.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(20);
      expect(findManyArgs.take).toBe(20);
    });
  });

  // ── getUnitMasterById ──
  describe("getUnitMasterById", () => {
    it("should query by id", async () => {
      const mockUnit = { id: "unit-1", code: "kg", name: "킬로그램" };
      prismaMock.unitMaster.findFirst.mockResolvedValue(mockUnit);

      const result = await getUnitMasterById("unit-1");

      expect(result).toEqual(mockUnit);
      const whereArg = prismaMock.unitMaster.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({ id: "unit-1" });
    });

    it("should return null when not found", async () => {
      prismaMock.unitMaster.findFirst.mockResolvedValue(null);

      const result = await getUnitMasterById("non-existent");
      expect(result).toBeNull();
    });
  });

  // ── createUnitMaster ──
  describe("createUnitMaster", () => {
    it("should create unit master with companyId", async () => {
      const input = {
        itemType: "MATERIAL" as const,
        unitCategory: "WEIGHT" as const,
        code: "oz",
        name: "온스",
        sortOrder: 5,
      };
      prismaMock.unitMaster.create.mockResolvedValue({
        id: "new-id",
        companyId: "company-1",
        ...input,
      });

      const result = await createUnitMaster("company-1", input);

      expect(result.code).toBe("oz");
      const createArg = prismaMock.unitMaster.create.mock.calls[0][0].data;
      expect(createArg.companyId).toBe("company-1");
      expect(createArg.code).toBe("oz");
      expect(createArg.name).toBe("온스");
    });
  });

  // ── updateUnitMaster ──
  describe("updateUnitMaster", () => {
    it("should update unit master", async () => {
      prismaMock.unitMaster.update.mockResolvedValue({
        id: "unit-1",
        name: "수정된단위",
      });

      const result = await updateUnitMaster("unit-1", { name: "수정된단위" });

      expect(result.name).toBe("수정된단위");
      expect(prismaMock.unitMaster.update).toHaveBeenCalledWith({
        where: { id: "unit-1" },
        data: { name: "수정된단위" },
      });
    });
  });

  // ── deleteUnitMaster ──
  describe("deleteUnitMaster", () => {
    it("should delete when unit exists and is not system/in-use", async () => {
      prismaMock.unitMaster.findFirst.mockResolvedValue({
        id: "unit-1",
        companyId: "company-1",
        code: "oz",
        itemType: "MATERIAL",
        isSystem: false,
      });
      // checkUnitUsage 내부 count 호출들 → 모두 0 (사용 안 함)
      prismaMock.materialMaster.count.mockResolvedValue(0);
      prismaMock.unitConversion.count.mockResolvedValue(0);
      prismaMock.supplierItem.count.mockResolvedValue(0);
      prismaMock.bOMItem.count.mockResolvedValue(0);
      prismaMock.unitMaster.delete.mockResolvedValue({ id: "unit-1" });

      const result = await deleteUnitMaster("company-1", "unit-1");

      expect(result).toEqual({ id: "unit-1" });
      expect(prismaMock.unitMaster.delete).toHaveBeenCalledWith({
        where: { id: "unit-1" },
      });
    });

    it("should throw NOT_FOUND when unit does not exist", async () => {
      prismaMock.unitMaster.findFirst.mockResolvedValue(null);

      await expect(
        deleteUnitMaster("company-1", "non-existent")
      ).rejects.toThrow("NOT_FOUND");
    });

    it("should throw SYSTEM_UNIT_CANNOT_DELETE for system units", async () => {
      prismaMock.unitMaster.findFirst.mockResolvedValue({
        id: "unit-1",
        companyId: "company-1",
        code: "kg",
        itemType: "MATERIAL",
        isSystem: true,
      });

      await expect(
        deleteUnitMaster("company-1", "unit-1")
      ).rejects.toThrow("SYSTEM_UNIT_CANNOT_DELETE");
    });

    it("should throw UNIT_IN_USE when unit is referenced", async () => {
      prismaMock.unitMaster.findFirst.mockResolvedValue({
        id: "unit-1",
        companyId: "company-1",
        code: "kg",
        itemType: "MATERIAL",
        isSystem: false,
      });
      // materialMaster에서 사용 중
      prismaMock.materialMaster.count.mockResolvedValue(3);
      prismaMock.unitConversion.count.mockResolvedValue(0);
      prismaMock.supplierItem.count.mockResolvedValue(0);
      prismaMock.bOMItem.count.mockResolvedValue(0);

      await expect(
        deleteUnitMaster("company-1", "unit-1")
      ).rejects.toThrow("UNIT_IN_USE");
    });
  });

  // ── getUnitOptionsByItemType ──
  describe("getUnitOptionsByItemType", () => {
    it("should return options for select box", async () => {
      const mockOptions = [
        { id: "1", code: "kg", name: "킬로그램", unitCategory: "WEIGHT" },
        { id: "2", code: "g", name: "그램", unitCategory: "WEIGHT" },
      ];
      prismaMock.unitMaster.findMany.mockResolvedValue(mockOptions);

      const result = await getUnitOptionsByItemType("company-1", "MATERIAL" as never);

      expect(result).toEqual(mockOptions);
      const args = prismaMock.unitMaster.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: "company-1", itemType: "MATERIAL" });
      expect(args.select).toEqual({
        id: true,
        code: true,
        name: true,
        unitCategory: true,
      });
    });
  });
});
