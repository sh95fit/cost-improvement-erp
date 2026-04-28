import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getSupplierItemsByMaterialId,
  getSupplierItemsBySubsidiaryId,
  getPriceHistory,
} from "@/features/supplier/services/supplier-item.service";

// withTransaction mock
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn) => fn(mockPrisma)),
}));

describe("supplier-item.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getSupplierItemsByMaterialId ──
  describe("getSupplierItemsByMaterialId", () => {
    it("should filter by materialMasterId and itemType MATERIAL", async () => {
      mockPrisma.supplierItem.findMany.mockResolvedValue([]);

      await getSupplierItemsByMaterialId("mat-1");

      const args = mockPrisma.supplierItem.findMany.mock.calls[0][0];
      expect(args.where.materialMasterId).toBe("mat-1");
      expect(args.where.itemType).toBe("MATERIAL");
    });

    it("should filter out soft-deleted suppliers", async () => {
      mockPrisma.supplierItem.findMany.mockResolvedValue([]);

      await getSupplierItemsByMaterialId("mat-1");

      const args = mockPrisma.supplierItem.findMany.mock.calls[0][0];
      expect(args.where.supplier).toEqual({ deletedAt: null });
    });

    it("should order by currentPrice ascending", async () => {
      mockPrisma.supplierItem.findMany.mockResolvedValue([]);

      await getSupplierItemsByMaterialId("mat-1");

      const args = mockPrisma.supplierItem.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ currentPrice: "asc" });
    });

    it("should include supplier select fields", async () => {
      mockPrisma.supplierItem.findMany.mockResolvedValue([]);

      await getSupplierItemsByMaterialId("mat-1");

      const args = mockPrisma.supplierItem.findMany.mock.calls[0][0];
      expect(args.include.supplier.select).toEqual({
        id: true,
        name: true,
        code: true,
      });
    });
  });

  // ── getSupplierItemsBySubsidiaryId ──
  describe("getSupplierItemsBySubsidiaryId", () => {
    it("should filter by subsidiaryMasterId and itemType SUBSIDIARY", async () => {
      mockPrisma.supplierItem.findMany.mockResolvedValue([]);

      await getSupplierItemsBySubsidiaryId("sub-1");

      const args = mockPrisma.supplierItem.findMany.mock.calls[0][0];
      expect(args.where.subsidiaryMasterId).toBe("sub-1");
      expect(args.where.itemType).toBe("SUBSIDIARY");
    });

    it("should filter out soft-deleted suppliers", async () => {
      mockPrisma.supplierItem.findMany.mockResolvedValue([]);

      await getSupplierItemsBySubsidiaryId("sub-1");

      const args = mockPrisma.supplierItem.findMany.mock.calls[0][0];
      expect(args.where.supplier).toEqual({ deletedAt: null });
    });
  });

  // ── getPriceHistory ──
  describe("getPriceHistory", () => {
    it("should return latest 20 price history entries", async () => {
      const mockHistory = [
        { id: "ph-1", price: 5000, effectiveFrom: new Date() },
      ];
      mockPrisma.supplierItemPriceHistory.findMany.mockResolvedValue(mockHistory);

      const result = await getPriceHistory("si-1");

      expect(result).toEqual(mockHistory);
      const args = mockPrisma.supplierItemPriceHistory.findMany.mock.calls[0][0];
      expect(args.where.supplierItemId).toBe("si-1");
      expect(args.orderBy).toEqual({ effectiveFrom: "desc" });
      expect(args.take).toBe(20);
    });
  });
});
