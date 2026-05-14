// src/tests/supplier.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "./mocks/prisma";

// mock 이후에 서비스 import
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/features/supplier/services/supplier.service";

describe("supplier.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getSuppliers ──
  describe("getSuppliers", () => {
    it("should return paginated suppliers", async () => {
      const mockItems = [
        { id: "1", name: "테스트업체", code: "SUP-001", companyId: "company-1" },
      ];
      prismaMock.supplier.findMany.mockResolvedValue(mockItems);
      prismaMock.supplier.count.mockResolvedValue(1);

      const result = await getSuppliers("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result.items).toEqual(mockItems);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("should apply search filter with OR condition", async () => {
      prismaMock.supplier.findMany.mockResolvedValue([]);
      prismaMock.supplier.count.mockResolvedValue(0);

      await getSuppliers("company-1", {
        page: 1,
        limit: 20,
        search: "테스트",
        sortBy: "name",
        sortOrder: "asc",
      });

      const whereArg = prismaMock.supplier.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(3);
    });

    it("should calculate pagination correctly", async () => {
      prismaMock.supplier.findMany.mockResolvedValue([]);
      prismaMock.supplier.count.mockResolvedValue(45);

      const result = await getSuppliers("company-1", {
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

      const findManyArgs = prismaMock.supplier.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(20);
      expect(findManyArgs.take).toBe(20);
    });

    it("should include supplierItems count", async () => {
      prismaMock.supplier.findMany.mockResolvedValue([]);
      prismaMock.supplier.count.mockResolvedValue(0);

      await getSuppliers("company-1", {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const includeArg = prismaMock.supplier.findMany.mock.calls[0][0].include;
      expect(includeArg._count).toBeDefined();
      expect(includeArg._count.select.supplierItems).toBe(true);
    });
  });

  // ── getSupplierById ──
  describe("getSupplierById", () => {
    it("should query with companyId and id", async () => {
      const mockSupplier = { id: "sup-1", name: "테스트업체", companyId: "company-1" };
      prismaMock.supplier.findFirst.mockResolvedValue(mockSupplier);

      const result = await getSupplierById("company-1", "sup-1");

      expect(result).toEqual(mockSupplier);
      const whereArg = prismaMock.supplier.findFirst.mock.calls[0][0].where;
      expect(whereArg).toEqual({ id: "sup-1", companyId: "company-1" });
    });

    it("should return null when not found", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      const result = await getSupplierById("company-1", "non-existent");
      expect(result).toBeNull();
    });
  });

  // ── createSupplier ──
  describe("createSupplier", () => {
    it("should auto-generate code SUP-001 when no suppliers exist", async () => {
      // generateSupplierCode 내부: findFirst로 마지막 코드 조회
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      prismaMock.supplier.create.mockResolvedValue({
        id: "new-id",
        code: "SUP-001",
        name: "신규업체",
      });

      const result = await createSupplier("company-1", {
        name: "신규업체",
        supplierType: "MATERIAL",  // ← 추가
      });

      expect(result.code).toBe("SUP-001");
      const createArg = prismaMock.supplier.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("SUP-001");
      expect(createArg.companyId).toBe("company-1");
    });

    it("should increment code from last existing supplier", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ code: "SUP-005" });
      prismaMock.supplier.create.mockResolvedValue({
        id: "new-id",
        code: "SUP-006",
        name: "추가업체",
      });

      await createSupplier("company-1", {
        name: "추가업체",
        supplierType: "MATERIAL",  // ← 추가
      });

      const createArg = prismaMock.supplier.create.mock.calls[0][0].data;
      expect(createArg.code).toBe("SUP-006");
    });
  });

  // ── updateSupplier ──
  describe("updateSupplier", () => {
    it("should update supplier with given input", async () => {
      prismaMock.supplier.update.mockResolvedValue({
        id: "sup-1",
        name: "수정된업체",
      });

      const result = await updateSupplier("company-1", "sup-1", {
        name: "수정된업체",
      });

      expect(result.name).toBe("수정된업체");
      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { id: "sup-1" },
        data: { name: "수정된업체" },
      });
    });
  });

  // ── deleteSupplier (soft-delete via extension) ──
  describe("deleteSupplier", () => {
    it("should delete supplier when found", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({
        id: "sup-1",
        companyId: "company-1",
      });
      prismaMock.supplier.delete.mockResolvedValue({ id: "sup-1" });

      const result = await deleteSupplier("company-1", "sup-1");

      expect(result).toEqual({ id: "sup-1" });
      expect(prismaMock.supplier.delete).toHaveBeenCalledWith({
        where: { id: "sup-1" },
      });
    });

    it("should return null when supplier not found", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      const result = await deleteSupplier("company-1", "non-existent");
      expect(result).toBeNull();
      expect(prismaMock.supplier.delete).not.toHaveBeenCalled();
    });
  });
});
