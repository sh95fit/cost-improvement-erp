import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
}));

import {
  getBOMsBySemiProduct,
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

describe("bom.service (반제품 전용)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getBOMsBySemiProduct ──
  describe("getBOMsBySemiProduct", () => {
    it("반제품별 BOM 목록을 조회한다", async () => {
      const mockBoms = [
        { id: "b1", version: 2, items: [] },
        { id: "b2", version: 1, items: [] },
      ];
      mockPrisma.bOM.findMany.mockResolvedValue(mockBoms);

      const result = await getBOMsBySemiProduct("company1", "sp1");

      expect(result).toHaveLength(2);
      expect(mockPrisma.bOM.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: "company1",
            semiProductId: "sp1",
            deletedAt: null,
          },
        })
      );
    });
  });

  // ── getBOMById ──
  describe("getBOMById", () => {
    it("BOM을 반제품 정보와 항목 함께 조회한다", async () => {
      const mockBom = {
        id: "b1",
        semiProduct: { id: "sp1", name: "양념장" },
        items: [{ id: "bi1", quantity: 10 }],
      };
      mockPrisma.bOM.findFirst.mockResolvedValue(mockBom);

      const result = await getBOMById("company1", "b1");

      expect(result?.semiProduct?.name).toBe("양념장");
    });
  });

  // ── getNextBOMVersion ──
  describe("getNextBOMVersion", () => {
    it("기존 버전이 있으면 +1을 반환한다", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({ version: 3 });

      const result = await getNextBOMVersion("company1", "sp1");

      expect(result).toBe(4);
    });

    it("기존 BOM이 없으면 1을 반환한다", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      const result = await getNextBOMVersion("company1", "sp1");

      expect(result).toBe(1);
    });
  });

  // ── createBOM ──
  describe("createBOM", () => {
    it("BOM을 생성한다", async () => {
      const mockBom = { id: "b1", semiProductId: "sp1", version: 1 };
      mockPrisma.bOM.create.mockResolvedValue(mockBom);

      const result = await createBOM("company1", {
        semiProductId: "sp1",
        version: 1,
        status: "DRAFT" as const,
        baseQuantity: 1,
        baseUnit: "kg",
      });

      expect(result.id).toBe("b1");
    });
  });

  // ── updateBOMStatus ──
  describe("updateBOMStatus", () => {
    it("ACTIVE 전환 시 기존 ACTIVE를 ARCHIVED로 변경한다", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({
        id: "b1",
        companyId: "company1",
        semiProductId: "sp1",
        status: "DRAFT",
        deletedAt: null,
      });
      mockPrisma.bOM.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.bOM.update.mockResolvedValue({ id: "b1", status: "ACTIVE" });

      const result = await updateBOMStatus("company1", "b1", {
        status: "ACTIVE" as const,
      });

      expect(result.status).toBe("ACTIVE");
      expect(mockPrisma.bOM.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            semiProductId: "sp1",
            status: "ACTIVE",
            deletedAt: null,
            id: { not: "b1" },
          }),
        })
      );
    });

    it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      await expect(
        updateBOMStatus("company1", "nonexistent", { status: "ACTIVE" as const })
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  // ── deleteBOM ──
  describe("deleteBOM", () => {
    it("soft-delete를 수행한다", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue({
        id: "b1",
        companyId: "company1",
        deletedAt: null,
      });
      mockPrisma.bOM.update.mockResolvedValue({ id: "b1", deletedAt: new Date() });

      const result = await deleteBOM("company1", "b1");

      expect(result).toBeTruthy();
    });

    it("존재하지 않으면 null을 반환한다", async () => {
      mockPrisma.bOM.findFirst.mockResolvedValue(null);

      const result = await deleteBOM("company1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  // ── BOMItem CRUD ──
  describe("BOMItem CRUD", () => {
    it("addBOMItem - 항목을 추가한다", async () => {
      mockPrisma.bOMItem.create.mockResolvedValue({
        id: "bi1",
        bomId: "b1",
        materialMasterId: "m1",
        quantity: 10,
      });

      const result = await addBOMItem("b1", {
        materialMasterId: "m1",
        quantity: 10,
        unit: "kg",
        sortOrder: 0,
      });

      expect(result.id).toBe("bi1");
    });

    it("updateBOMItem - 항목을 수정한다", async () => {
      mockPrisma.bOMItem.update.mockResolvedValue({ id: "bi1", quantity: 20 });

      const result = await updateBOMItem("bi1", { quantity: 20 });

      expect(result.quantity).toBe(20);
    });

    it("deleteBOMItem - 항목을 삭제한다", async () => {
      mockPrisma.bOMItem.delete.mockResolvedValue({ id: "bi1" });

      const result = await deleteBOMItem("bi1");

      expect(result.id).toBe("bi1");
    });
  });

  // ── replaceBOMItems ──
  describe("replaceBOMItems", () => {
    it("기존 항목을 삭제하고 새 항목을 일괄 생성한다", async () => {
      mockPrisma.bOMItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.bOMItem.createMany.mockResolvedValue({ count: 3 });
      mockPrisma.bOMItem.findMany.mockResolvedValue([
        { id: "bi1", sortOrder: 0 },
        { id: "bi2", sortOrder: 1 },
        { id: "bi3", sortOrder: 2 },
      ]);

      const result = await replaceBOMItems("b1", [
        { materialMasterId: "m1", quantity: 10, unit: "kg", sortOrder: 0 },
        { materialMasterId: "m2", quantity: 5, unit: "kg", sortOrder: 1 },
        { materialMasterId: "m3", quantity: 3, unit: "kg", sortOrder: 2 },
      ]);

      expect(result).toHaveLength(3);
      expect(mockPrisma.bOMItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bomId: "b1" } })
      );
    });
  });
});
