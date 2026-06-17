// src/tests/material-fix-r1.test.ts
// M-Fix-R1 (D14-7 ~ D14-11): MaterialMaster 의존성 가드 + 활성/비활성 토글 테스트
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getMaterialDependencies,
  setMaterialActive,
  MATERIAL_ERRORS,
} from "@/features/material/services/material.service";

// withTransaction mock — mockPrisma를 그대로 tx로 주입
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

describe("material.service — M-Fix-R1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════
  // getMaterialDependencies (D14-9)
  // ════════════════════════════════════════
  describe("getMaterialDependencies", () => {
    it("should return null when material not found", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);

      const result = await getMaterialDependencies("company-1", "non-existent");

      expect(result).toBeNull();
    });

    it("should return all zero counts → canHardDelete=true, canDeactivate=true", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({ id: "mat-1" });
      // 모든 의존성 0건
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.materialRequirement.count.mockResolvedValue(0);
      mockPrisma.recipeIngredient.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlotItem.count.mockResolvedValue(0);
      mockPrisma.bOMItem.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);

      const result = await getMaterialDependencies("company-1", "mat-1");

      expect(result).not.toBeNull();
      expect(result!.canHardDelete).toBe(true);
      expect(result!.canDeactivate).toBe(true);
      expect(result!.blockingReasonForDelete).toBeUndefined();
      expect(result!.blockingReasonForDeactivate).toBeUndefined();
    });

    it("should set canHardDelete=false when SupplierItem exists", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({ id: "mat-1" });
      // supplierItem.count는 두 번 호출됨 (active + total). 두 번 모두 1을 반환
      mockPrisma.supplierItem.count.mockResolvedValue(1);
      mockPrisma.materialRequirement.count.mockResolvedValue(0);
      mockPrisma.recipeIngredient.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlotItem.count.mockResolvedValue(0);
      mockPrisma.bOMItem.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);

      const result = await getMaterialDependencies("company-1", "mat-1");

      expect(result!.canHardDelete).toBe(false);
      expect(result!.blockingReasonForDelete).toContain("공급품목 1");
    });

    it("should set canDeactivate=false when active meal plan slots exist", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({ id: "mat-1" });
      mockPrisma.supplierItem.count.mockResolvedValue(0);
      mockPrisma.materialRequirement.count.mockResolvedValue(0);
      mockPrisma.recipeIngredient.count.mockResolvedValue(0);
      mockPrisma.recipeBOMSlotItem.count.mockResolvedValue(0);
      mockPrisma.bOMItem.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);
      // mealPlanSlot.count: 첫 번째 호출(total) 5, 두 번째 호출(active) 5
      mockPrisma.mealPlanSlot.count.mockResolvedValue(5);

      const result = await getMaterialDependencies("company-1", "mat-1");

      expect(result!.canDeactivate).toBe(false);
      expect(result!.blockingReasonForDeactivate).toContain("진행 중인 식단 5건");
    });
  });

  // ════════════════════════════════════════
  // setMaterialActive (D14-10)
  // ════════════════════════════════════════
  describe("setMaterialActive", () => {
    it("should return null when material not found", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue(null);

      const result = await setMaterialActive("company-1", "non-existent", false);

      expect(result).toBeNull();
      expect(mockPrisma.materialMaster.update).not.toHaveBeenCalled();
    });

    it("should activate (isActive=true) without dependency check", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: false,
      });
      mockPrisma.materialMaster.update.mockResolvedValue({
        id: "mat-1",
        isActive: true,
      });

      const result = await setMaterialActive("company-1", "mat-1", true);

      expect(result).toEqual({ id: "mat-1", isActive: true });
      expect(mockPrisma.materialMaster.update).toHaveBeenCalledWith({
        where: { id: "mat-1" },
        data: { isActive: true },
      });
      // 활성화 시 의존성 검사 안 함
      expect(mockPrisma.mealPlanSlot.count).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseOrderItem.count).not.toHaveBeenCalled();
    });

    it("should deactivate when no active meal plan / PO → also auto-deactivate SupplierItems", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: true,
      });
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);
      mockPrisma.supplierItem.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.materialMaster.update.mockResolvedValue({
        id: "mat-1",
        isActive: false,
      });

      const result = await setMaterialActive("company-1", "mat-1", false);

      expect(result).toEqual({ id: "mat-1", isActive: false });
      // 산하 SupplierItem 자동 비활성화 호출 확인
      expect(mockPrisma.supplierItem.updateMany).toHaveBeenCalledWith({
        where: { materialMasterId: "mat-1", deletedAt: null, isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.materialMaster.update).toHaveBeenCalledWith({
        where: { id: "mat-1" },
        data: { isActive: false },
      });
    });

    it("should throw IN_USE_BY_ACTIVE_MEAL_PLAN when active meal plan slots exist", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: true,
      });
      mockPrisma.mealPlanSlot.count.mockResolvedValue(3); // 활성 식단 3건
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(0);

      await expect(
        setMaterialActive("company-1", "mat-1", false),
      ).rejects.toThrow(MATERIAL_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);

      expect(mockPrisma.materialMaster.update).not.toHaveBeenCalled();
      expect(mockPrisma.supplierItem.updateMany).not.toHaveBeenCalled();
    });

    it("should throw IN_USE_BY_ACTIVE_MEAL_PLAN when active PO items exist", async () => {
      mockPrisma.materialMaster.findFirst.mockResolvedValue({
        id: "mat-1",
        companyId: "company-1",
        deletedAt: null,
        isActive: true,
      });
      mockPrisma.mealPlanSlot.count.mockResolvedValue(0);
      mockPrisma.purchaseOrderItem.count.mockResolvedValue(1); // 진행 중 PO 1건

      await expect(
        setMaterialActive("company-1", "mat-1", false),
      ).rejects.toThrow(MATERIAL_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);

      expect(mockPrisma.materialMaster.update).not.toHaveBeenCalled();
    });
  });
});