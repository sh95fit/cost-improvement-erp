import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// withTransaction mock
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

import {
  getSemiProducts,
  getSemiProductById,
  getSemiProductByCode,
  createSemiProduct,
  updateSemiProduct,
  deleteSemiProduct,
} from "@/features/recipe/services/semi-product.service";

describe("semi-product.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getSemiProducts ──
  describe("getSemiProducts", () => {
    it("should include deletedAt: null in where clause", async () => {
      mockPrisma.semiProduct.findMany.mockResolvedValue([]);
      mockPrisma.semiProduct.count.mockResolvedValue(0);

      await getSemiProducts("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const whereArg = mockPrisma.semiProduct.findMany.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.companyId).toBe("company-1");
    });

    it("should apply search filter with OR condition", async () => {
      mockPrisma.semiProduct.findMany.mockResolvedValue([]);
      mockPrisma.semiProduct.count.mockResolvedValue(0);

      await getSemiProducts("company-1", {
        page: 1,
        limit: 20,
        search: "양념장",
        sortBy: "name",
        sortOrder: "asc",
      });

      const whereArg = mockPrisma.semiProduct.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(2);
    });

    it("should calculate pagination correctly", async () => {
      mockPrisma.semiProduct.findMany.mockResolvedValue([]);
      mockPrisma.semiProduct.count.mockResolvedValue(30);

      const result = await getSemiProducts("company-1", {
        page: 2,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 30,
        totalPages: 3,
      });

      const findManyArgs = mockPrisma.semiProduct.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(10);
      expect(findManyArgs.take).toBe(10);
    });

    it("should include only ACTIVE BOMs with deletedAt: null", async () => {
      mockPrisma.semiProduct.findMany.mockResolvedValue([]);
      mockPrisma.semiProduct.count.mockResolvedValue(0);

      await getSemiProducts("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const includeArg = mockPrisma.semiProduct.findMany.mock.calls[0][0].include;
      expect(includeArg.boms.where.status).toBe("ACTIVE");
      expect(includeArg.boms.where.deletedAt).toBeNull();
    });
  });

  // ── getSemiProductById ──
  describe("getSemiProductById", () => {
    it("should query with companyId, id, and deletedAt: null", async () => {
      const mockSP = { id: "sp-1", name: "양념장", companyId: "company-1" };
      mockPrisma.semiProduct.findFirst.mockResolvedValue(mockSP);

      const result = await getSemiProductById("company-1", "sp-1");

      expect(result).toEqual(mockSP);
      const whereArg = mockPrisma.semiProduct.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({ id: "sp-1", companyId: "company-1", deletedAt: null });
    });

    it("should include boms with deletedAt: null", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue(null);

      await getSemiProductById("company-1", "sp-1");

      const includeArg = mockPrisma.semiProduct.findFirst.mock.calls[0][0].include;
      expect(includeArg.boms.where.deletedAt).toBeNull();
    });

    it("should return null when not found", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue(null);

      const result = await getSemiProductById("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── getSemiProductByCode ──
  describe("getSemiProductByCode", () => {
    it("should query with deletedAt: null", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue(null);

      await getSemiProductByCode("company-1", "SP-001");

      const whereArg = mockPrisma.semiProduct.findFirst.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
      expect(whereArg.code).toBe("SP-001");
    });
  });

  // ── createSemiProduct ──
  describe("createSemiProduct", () => {
    it("should auto-generate code SP-001 when no semi-products exist", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue(null);
      mockPrisma.semiProduct.create.mockResolvedValue({
        id: "new-id",
        code: "SP-001",
        name: "양념장",
      });

      const result = await createSemiProduct("company-1", { name: "양념장", unit: "kg" });

      expect(result.code).toBe("SP-001");
      const createArg = mockPrisma.semiProduct.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("SP-001");
      expect(createArg.companyId).toBe("company-1");
    });

    it("should increment code from last existing semi-product", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue({ code: "SP-003" });
      mockPrisma.semiProduct.create.mockResolvedValue({
        id: "new-id",
        code: "SP-004",
        name: "고추장",
      });

      await createSemiProduct("company-1", { name: "고추장", unit: "kg" });

      const createArg = mockPrisma.semiProduct.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("SP-004");
    });
  });

  // ── updateSemiProduct ──
  describe("updateSemiProduct", () => {
    it("should update semi-product fields", async () => {
      mockPrisma.semiProduct.update.mockResolvedValue({
        id: "sp-1",
        name: "수정된 반제품",
      });

      const result = await updateSemiProduct("company-1", "sp-1", { name: "수정된 반제품" });

      expect(result.name).toBe("수정된 반제품");
      expect(mockPrisma.semiProduct.update).toHaveBeenCalledWith({
        where: { id: "sp-1" },
        data: { name: "수정된 반제품" },
      });
    });
  });

  // ── deleteSemiProduct ──
  describe("deleteSemiProduct", () => {
    it("should soft-delete semi-product and cascade BOM soft-delete", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue({
        id: "sp-1",
        companyId: "company-1",
        deletedAt: null,
      });
      mockPrisma.bOM.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.semiProduct.update.mockResolvedValue({ id: "sp-1" });

      await deleteSemiProduct("company-1", "sp-1");

      // BOM cascade soft-delete
      expect(mockPrisma.bOM.updateMany).toHaveBeenCalledWith({
        where: { semiProductId: "sp-1", deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });

      // Semi-product soft-delete
      expect(mockPrisma.semiProduct.update).toHaveBeenCalledWith({
        where: { id: "sp-1" },
        data: { deletedAt: expect.any(Date) },
      });

      // hard delete가 호출되지 않았는지 확인
      expect(mockPrisma.semiProduct.delete).not.toHaveBeenCalled();
    });

    it("should return null when semi-product not found", async () => {
      mockPrisma.semiProduct.findFirst.mockResolvedValue(null);

      const result = await deleteSemiProduct("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });
});
