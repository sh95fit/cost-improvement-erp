import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getSubsidiaries,
  getSubsidiaryById,
  createSubsidiary,
  deleteSubsidiary,
  setDefaultSupplierItem,
} from "@/features/material/services/subsidiary.service";

describe("subsidiary.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getSubsidiaries ──
  describe("getSubsidiaries", () => {
    it("should include deletedAt: null in where clause", async () => {
      mockPrisma.subsidiaryMaster.findMany.mockResolvedValue([]);
      mockPrisma.subsidiaryMaster.count.mockResolvedValue(0);

      await getSubsidiaries("company-1", {
        page: 1,
        limit: 20,
        sortBy: "name",
        sortOrder: "asc",
      });

      const whereArg = mockPrisma.subsidiaryMaster.findMany.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.companyId).toBe("company-1");
    });

    it("should include defaultSupplierItem with supplier", async () => {
      mockPrisma.subsidiaryMaster.findMany.mockResolvedValue([]);
      mockPrisma.subsidiaryMaster.count.mockResolvedValue(0);

      await getSubsidiaries("company-1", {
        page: 1,
        limit: 20,
        sortBy: "name",
        sortOrder: "asc",
      });

      const includeArg = mockPrisma.subsidiaryMaster.findMany.mock.calls[0][0].include;
      expect(includeArg.defaultSupplierItem).toBeDefined();
    });

    it("should apply search filter", async () => {
      mockPrisma.subsidiaryMaster.findMany.mockResolvedValue([]);
      mockPrisma.subsidiaryMaster.count.mockResolvedValue(0);

      await getSubsidiaries("company-1", {
        page: 1,
        limit: 20,
        search: "젓가락",
        sortBy: "name",
        sortOrder: "asc",
      });

      const whereArg = mockPrisma.subsidiaryMaster.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(2);
    });
  });

  // ── getSubsidiaryById ──
  describe("getSubsidiaryById", () => {
    it("should query with deletedAt: null", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue(null);

      await getSubsidiaryById("company-1", "sub-1");

      const whereArg = mockPrisma.subsidiaryMaster.findFirst.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
    });
  });

  // ── createSubsidiary ──
  describe("createSubsidiary", () => {
    it("should auto-generate code SUB-001", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.subsidiaryMaster.create.mockResolvedValue({
        id: "new-id",
        code: "SUB-001",
        name: "젓가락",
      });

      const result = await createSubsidiary("company-1", {
        name: "젓가락",
        subsidiaryType: "CONSUMABLE",
        unit: "개",
        unitCategory: "COUNT",
      });

      expect(result.code).toBe("SUB-001");
    });

    it("should increment code from last existing", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ code: "SUB-003" }]);
      mockPrisma.subsidiaryMaster.create.mockResolvedValue({
        id: "new-id",
        code: "SUB-004",
        name: "물티슈",
      });

      await createSubsidiary("company-1", {
        name: "물티슈",
        subsidiaryType: "CONSUMABLE",
        unit: "개",
        unitCategory: "COUNT",
      });

      const createArg = mockPrisma.subsidiaryMaster.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("SUB-004");
    });
  });

  // ── deleteSubsidiary (soft-delete + ★ M-Fix-R1 의존성 가드) ──
  describe("deleteSubsidiary", () => {
    it("should soft-delete with deletedAt timestamp", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        deletedAt: null,
      });
      mockPrisma.subsidiaryMaster.update.mockResolvedValue({ id: "sub-1" });
      // ★ M-Fix-R1 (D14-8): 의존성 카운트 모두 0 (삭제 가능 경로)
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanAccessory.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.containerSlot.count.mockResolvedValue(0);
      mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
      mockPrisma.mealTemplateAccessory.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      await deleteSubsidiary("company-1", "sub-1");

      expect(mockPrisma.subsidiaryMaster.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { deletedAt: expect.any(Date), isActive: false }, // ★ M-Fix-R1 (D14-8)
      });
      expect(mockPrisma.subsidiaryMaster.delete).not.toHaveBeenCalled();
    });

    it("should return null when not found", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue(null);

      const result = await deleteSubsidiary("company-1", "non-existent");
      expect(result).toBeNull();
    });

    // ★ M-Fix-R1 (D14-8) 신규: 의존성 있으면 HAS_USAGE_HISTORY
    it("should throw HAS_USAGE_HISTORY when ContainerSlot references exist", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        deletedAt: null,
      });
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanAccessory.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.containerSlot.count.mockResolvedValue(2); // 용기 슬롯 2건 보유
      mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
      mockPrisma.mealTemplateAccessory.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      await expect(deleteSubsidiary("company-1", "sub-1")).rejects.toThrow(
        "HAS_USAGE_HISTORY",
      );
      expect(mockPrisma.subsidiaryMaster.update).not.toHaveBeenCalled();
    });

    it("should throw HAS_USAGE_HISTORY when SupplierItem references exist", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        deletedAt: null,
      });
      mockPrisma.supplierItem.count.mockResolvedValue(1); // SupplierItem 1건 보유
      mockPrisma.mealPlanAccessory.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.containerSlot.count.mockResolvedValue(0);
      mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
      mockPrisma.mealTemplateAccessory.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      await expect(deleteSubsidiary("company-1", "sub-1")).rejects.toThrow(
        "HAS_USAGE_HISTORY",
      );
      expect(mockPrisma.subsidiaryMaster.update).not.toHaveBeenCalled();
    });
  });

  // ── setDefaultSupplierItem ──
  describe("setDefaultSupplierItem", () => {
    it("should update defaultSupplierItemId", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        companyId: "company-1",
      });
      mockPrisma.subsidiaryMaster.update.mockResolvedValue({ id: "sub-1" });

      await setDefaultSupplierItem("company-1", "sub-1", "si-1");

      expect(mockPrisma.subsidiaryMaster.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { defaultSupplierItemId: "si-1" },
      });
    });

    it("should throw NOT_FOUND when subsidiary does not exist", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue(null);

      await expect(
        setDefaultSupplierItem("company-1", "non-existent", "si-1")
      ).rejects.toThrow("NOT_FOUND");
    });
  });
});
