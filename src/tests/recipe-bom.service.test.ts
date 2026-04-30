import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
}));

import {
  getRecipeBOMsByRecipeId,
  getRecipeBOMById,
  getNextRecipeBOMVersion,
  createRecipeBOM,
  updateRecipeBOMStatus,
  updateRecipeBOMBaseWeight,
  deleteRecipeBOM,
  addRecipeBOMSlot,
  updateRecipeBOMSlot,
  deleteRecipeBOMSlot,
  addRecipeBOMSlotItem,
  updateRecipeBOMSlotItem,
  deleteRecipeBOMSlotItem,
} from "@/features/recipe/services/recipe-bom.service";

describe("recipe-bom.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getRecipeBOMsByRecipeId ──
  describe("getRecipeBOMsByRecipeId", () => {
    it("레시피별 BOM 목록을 조회한다", async () => {
      const mockBoms = [
        { id: "rb1", version: 2, status: "ACTIVE", slots: [] },
        { id: "rb2", version: 1, status: "ARCHIVED", slots: [] },
      ];
      mockPrisma.recipeBOM.findMany.mockResolvedValue(mockBoms);

      const result = await getRecipeBOMsByRecipeId("company1", "r1");

      expect(result).toHaveLength(2);
      expect(mockPrisma.recipeBOM.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: "company1", recipeId: "r1", deletedAt: null },
          orderBy: { version: "desc" },
        })
      );
    });
  });

  // ── getRecipeBOMById ──
  describe("getRecipeBOMById", () => {
    it("BOM을 슬롯/아이템과 함께 조회한다", async () => {
      const mockBom = {
        id: "rb1",
        version: 1,
        recipe: { id: "r1", name: "김치찌개" },
        slots: [
          {
            id: "s1",
            containerGroup: { id: "cg1", name: "도시락" },
            items: [{ id: "si1", weightG: 100 }],
          },
        ],
      };
      mockPrisma.recipeBOM.findFirst.mockResolvedValue(mockBom);

      const result = await getRecipeBOMById("company1", "rb1");

      expect(result.id).toBe("rb1");
      expect(result.slots).toHaveLength(1);
    });

    it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue(null);

      await expect(getRecipeBOMById("company1", "nonexistent")).rejects.toThrow(
        "NOT_FOUND"
      );
    });
  });

  // ── getNextRecipeBOMVersion ──
  describe("getNextRecipeBOMVersion", () => {
    it("기존 버전이 있으면 +1을 반환한다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({ version: 3 });

      const result = await getNextRecipeBOMVersion("company1", "r1");

      expect(result).toBe(4);
    });

    it("기존 BOM이 없으면 1을 반환한다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue(null);

      const result = await getNextRecipeBOMVersion("company1", "r1");

      expect(result).toBe(1);
    });
  });

  // ── createRecipeBOM ──
  describe("createRecipeBOM", () => {
    it("RecipeBOM을 생성한다", async () => {
      const mockBom = { id: "rb1", recipeId: "r1", version: 1, status: "DRAFT" };
      mockPrisma.recipeBOM.create.mockResolvedValue(mockBom);

      const result = await createRecipeBOM("company1", {
        recipeId: "r1",
        version: 1,
        status: "DRAFT" as const,
        baseWeightG: 500,
      });

      expect(result.id).toBe("rb1");
      expect(mockPrisma.recipeBOM.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: "company1",
            recipeId: "r1",
            baseWeightG: 500,
          }),
        })
      );
    });
  });

  // ── updateRecipeBOMStatus ──
  describe("updateRecipeBOMStatus", () => {
    it("ACTIVE 전환 시 기존 ACTIVE를 ARCHIVED로 변경한다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        recipeId: "r1",
        status: "DRAFT",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.recipeBOM.update.mockResolvedValue({
        id: "rb1",
        status: "ACTIVE",
      });

      const result = await updateRecipeBOMStatus("company1", "rb1", {
        status: "ACTIVE" as const,
      });

      expect(result.status).toBe("ACTIVE");
      expect(mockPrisma.recipeBOM.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipeId: "r1",
            status: "ACTIVE",
            deletedAt: null,
            id: { not: "rb1" },
          }),
          data: { status: "ARCHIVED" },
        })
      );
    });

    // ★ 신규 테스트: ARCHIVED → ACTIVE 복원
    it("ARCHIVED에서 ACTIVE로 전환할 수 있다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        recipeId: "r1",
        status: "ARCHIVED",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.recipeBOM.update.mockResolvedValue({
        id: "rb1",
        status: "ACTIVE",
      });

      const result = await updateRecipeBOMStatus("company1", "rb1", {
        status: "ACTIVE" as const,
      });

      expect(result.status).toBe("ACTIVE");
    });

    // ★ 신규 테스트: 마지막 ACTIVE 보관 차단
    it("마지막 ACTIVE BOM을 ARCHIVED로 전환하면 LAST_ACTIVE_BOM 에러를 던진다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        recipeId: "r1",
        status: "ACTIVE",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.count.mockResolvedValue(1); // 마지막 1개

      await expect(
        updateRecipeBOMStatus("company1", "rb1", { status: "ARCHIVED" as const })
      ).rejects.toThrow("LAST_ACTIVE_BOM");
    });

    // ★ 신규 테스트: ACTIVE가 2개 이상이면 보관 가능
    it("ACTIVE BOM이 2개 이상이면 ARCHIVED로 전환할 수 있다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        recipeId: "r1",
        status: "ACTIVE",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.count.mockResolvedValue(2);
      mockPrisma.recipeBOM.update.mockResolvedValue({
        id: "rb1",
        status: "ARCHIVED",
      });

      const result = await updateRecipeBOMStatus("company1", "rb1", {
        status: "ARCHIVED" as const,
      });

      expect(result.status).toBe("ARCHIVED");
    });

    it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue(null);

      await expect(
        updateRecipeBOMStatus("company1", "nonexistent", { status: "ACTIVE" as const })
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  // ── updateRecipeBOMBaseWeight ──
  describe("updateRecipeBOMBaseWeight", () => {
    it("기준 중량을 변경한다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.update.mockResolvedValue({
        id: "rb1",
        baseWeightG: 600,
      });

      const result = await updateRecipeBOMBaseWeight("company1", "rb1", {
        baseWeightG: 600,
      });

      expect(result.baseWeightG).toBe(600);
    });
  });

  // ── deleteRecipeBOM ──
  describe("deleteRecipeBOM", () => {
    it("soft-delete를 수행한다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        status: "DRAFT",
        deletedAt: null,
      });
      mockPrisma.recipeBOM.update.mockResolvedValue({
        id: "rb1",
        deletedAt: new Date(),
      });

      const result = await deleteRecipeBOM("company1", "rb1");

      expect(result).toBeTruthy();
      expect(mockPrisma.recipeBOM.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rb1" },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });

    // ★ 신규 테스트: ACTIVE 삭제 차단
    it("ACTIVE 상태의 BOM은 삭제할 수 없다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue({
        id: "rb1",
        companyId: "company1",
        status: "ACTIVE",
        deletedAt: null,
      });

      await expect(deleteRecipeBOM("company1", "rb1")).rejects.toThrow(
        "CANNOT_DELETE_ACTIVE"
      );
    });

    it("존재하지 않으면 null을 반환한다", async () => {
      mockPrisma.recipeBOM.findFirst.mockResolvedValue(null);

      const result = await deleteRecipeBOM("company1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ── RecipeBOMSlot ──
  describe("RecipeBOMSlot CRUD", () => {
    it("addRecipeBOMSlot - 슬롯을 추가한다", async () => {
      const mockSlot = {
        id: "s1",
        recipeBomId: "rb1",
        containerGroupId: "cg1",
        slotIndex: 0,
        totalWeightG: 200,
      };
      mockPrisma.recipeBOMSlot.create.mockResolvedValue(mockSlot);

      const result = await addRecipeBOMSlot("rb1", {
        containerGroupId: "cg1",
        slotIndex: 0,
        totalWeightG: 200,
        sortOrder: 0,
      });

      expect(result.id).toBe("s1");
    });

    it("updateRecipeBOMSlot - 슬롯을 수정한다", async () => {
      mockPrisma.recipeBOMSlot.update.mockResolvedValue({
        id: "s1",
        totalWeightG: 250,
      });

      const result = await updateRecipeBOMSlot("s1", { totalWeightG: 250 });

      expect(result.totalWeightG).toBe(250);
    });

    it("deleteRecipeBOMSlot - 하위 아이템과 함께 슬롯을 삭제한다", async () => {
      mockPrisma.recipeBOMSlotItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.recipeBOMSlot.delete.mockResolvedValue({ id: "s1" });

      const result = await deleteRecipeBOMSlot("s1");

      expect(result.id).toBe("s1");
      expect(mockPrisma.recipeBOMSlotItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipeBomSlotId: "s1" },
        })
      );
    });
  });

  // ── RecipeBOMSlotItem ──
  describe("RecipeBOMSlotItem CRUD", () => {
    it("addRecipeBOMSlotItem - 슬롯 아이템을 추가한다", async () => {
      const mockItem = {
        id: "si1",
        recipeBomSlotId: "s1",
        ingredientType: "MATERIAL",
        materialMasterId: "m1",
        weightG: 100,
      };
      mockPrisma.recipeBOMSlotItem.create.mockResolvedValue(mockItem);

      const result = await addRecipeBOMSlotItem("s1", {
        ingredientType: "MATERIAL" as const,
        materialMasterId: "m1",
        weightG: 100,
        unit: "g",
        sortOrder: 0,
      });

      expect(result.weightG).toBe(100);
    });

    it("updateRecipeBOMSlotItem - 슬롯 아이템을 수정한다", async () => {
      mockPrisma.recipeBOMSlotItem.update.mockResolvedValue({
        id: "si1",
        weightG: 150,
      });

      const result = await updateRecipeBOMSlotItem("si1", { weightG: 150 });

      expect(result.weightG).toBe(150);
    });

    it("deleteRecipeBOMSlotItem - 슬롯 아이템을 삭제한다", async () => {
      mockPrisma.recipeBOMSlotItem.delete.mockResolvedValue({ id: "si1" });

      const result = await deleteRecipeBOMSlotItem("si1");

      expect(result.id).toBe("si1");
    });
  });
});
