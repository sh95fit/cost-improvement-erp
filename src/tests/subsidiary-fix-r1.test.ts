// src/tests/subsidiary-fix-r1.test.ts
// M-Fix-R1 (D14-7 ~ D14-11): SubsidiaryMaster 의존성 가드 + 활성/비활성 토글 테스트
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getSubsidiaryDependencies,
  setSubsidiaryActive,
  SUBSIDIARY_ERRORS,
} from "@/features/material/services/subsidiary.service";

// withTransaction mock — mockPrisma를 그대로 tx로 주입
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

describe("subsidiary.service — M-Fix-R1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════
  // getSubsidiaryDependencies (D14-9)
  // ════════════════════════════════════════
  describe("getSubsidiaryDependencies", () => {
    it("should return null when subsidiary not found", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue(null);

      const result = await getSubsidiaryDependencies("company-1", "non-existent");

      expect(result).toBeNull();
    });

    it("should return all zero counts → canHardDelete=true, canDeactivate=true", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({ id: "sub-1" });
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanAccessory.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.containerSlot.count.mockResolvedValue(0);
      mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
      mockPrisma.mealTemplateAccessory.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      const result = await getSubsidiaryDependencies("company-1", "sub-1");

      expect(result).not.toBeNull();
      expect(result!.canHardDelete).toBe(true);
      expect(result!.canDeactivate).toBe(true);
      expect(result!.blockingReasonForDelete).toBeUndefined();
      expect(result!.blockingReasonForDeactivate).toBeUndefined();
    });

    it("should set canHardDelete=false when ContainerSlot exists", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({ id: "sub-1" });
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanAccessory.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.containerSlot.count.mockResolvedValue(2);
      mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
      mockPrisma.mealTemplateAccessory.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      const result = await getSubsidiaryDependencies("company-1", "sub-1");

      expect(result!.canHardDelete).toBe(false);
      expect(result!.blockingReasonForDelete).toContain("용기/템플릿");
    });

    it("should set canDeactivate=false when active meal plan slots exist", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({ id: "sub-1" });
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanAccessory.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(2); // total / active 모두 2
      mockPrisma.containerSlot.count.mockResolvedValue(0);
      mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
      mockPrisma.mealTemplateAccessory.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      const result = await getSubsidiaryDependencies("company-1", "sub-1");

      expect(result!.canDeactivate).toBe(false);
      expect(result!.blockingReasonForDeactivate).toContain("진행 중인 식단 2건");
    });
  });

  // ════════════════════════════════════════
  // setSubsidiaryActive (D14-10)
  // ════════════════════════════════════════
  describe("setSubsidiaryActive", () => {
    it("should return null when subsidiary not found", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue(null);

      const result = await setSubsidiaryActive("company-1", "non-existent", false);

      expect(result).toBeNull();
      expect(mockPrisma.subsidiaryMaster.update).not.toHaveBeenCalled();
    });

    it("should activate (isActive=true) without dependency check", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: false,
      });
      mockPrisma.subsidiaryMaster.update.mockResolvedValue({
        id: "sub-1",
        isActive: true,
      });

      const result = await setSubsidiaryActive("company-1", "sub-1", true);

      expect(result).toEqual({ id: "sub-1", isActive: true });
      expect(mockPrisma.subsidiaryMaster.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { isActive: true },
      });
      expect(mockPrisma.mealPlanSlot.count).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseOrderItem.count).not.toHaveBeenCalled();
    });

    it("should deactivate when no active meal plan / PO → auto-deactivate SupplierItems", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: true,
      });
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);
      mockPrisma.supplierItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subsidiaryMaster.update.mockResolvedValue({
        id: "sub-1",
        isActive: false,
      });

      const result = await setSubsidiaryActive("company-1", "sub-1", false);

      expect(result).toEqual({ id: "sub-1", isActive: false });
      expect(mockPrisma.supplierItem.updateMany).toHaveBeenCalledWith({
        where: { subsidiaryMasterId: "sub-1", deletedAt: null, isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.subsidiaryMaster.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { isActive: false },
      });
    });

    it("should throw IN_USE_BY_ACTIVE_MEAL_PLAN when active meal plan slots exist", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: true,
      });
      mockPrisma.mealPlanSlot.count.mockResolvedValue(2);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      await expect(
        setSubsidiaryActive("company-1", "sub-1", false),
      ).rejects.toThrow(SUBSIDIARY_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);

      expect(mockPrisma.subsidiaryMaster.update).not.toHaveBeenCalled();
      expect(mockPrisma.supplierItem.updateMany).not.toHaveBeenCalled();
    });

    it("should throw IN_USE_BY_ACTIVE_MEAL_PLAN when active PO items exist", async () => {
      mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
        id: "sub-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: true,
      });
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(1);

      await expect(
        setSubsidiaryActive("company-1", "sub-1", false),
      ).rejects.toThrow(SUBSIDIARY_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);

      expect(mockPrisma.subsidiaryMaster.update).not.toHaveBeenCalled();
    });
  });
});
