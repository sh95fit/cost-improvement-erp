import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  transitionPurchaseOrderStatus,
  deletePurchaseOrder,
} from "@/features/purchase-order/services/purchase-order.service";

describe("purchase-order.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getPurchaseOrders ──
  describe("getPurchaseOrders", () => {
    it("should apply companyId, status, supplierId filters", async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);

      await getPurchaseOrders("c1", {
        page: 2,
        limit: 20,
        status: "DRAFT" as never,
        supplierId: "s1",
        sortBy: "orderDate",
        sortOrder: "desc",
      } as never);

      const args = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBe("c1");
      expect(args.where.status).toBe("DRAFT");
      expect(args.where.supplierId).toBe("s1");
      expect(args.skip).toBe(20);
      expect(args.take).toBe(20);
      expect(args.orderBy).toEqual({ orderDate: "desc" });
    });

    it("should apply search filter as OR (orderNumber/note)", async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);

      await getPurchaseOrders("c1", {
        page: 1,
        limit: 10,
        search: "PO-2026",
        sortBy: "orderDate",
        sortOrder: "desc",
      } as never);

      const args = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { orderNumber: { contains: "PO-2026", mode: "insensitive" } },
        { note: { contains: "PO-2026", mode: "insensitive" } },
      ]);
    });

    it("should calculate totalPages correctly", async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(45);

      const result = await getPurchaseOrders("c1", {
        page: 1,
        limit: 20,
        sortBy: "orderDate",
        sortOrder: "desc",
      } as never);

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });
  });

  // ── getPurchaseOrderById ──
  describe("getPurchaseOrderById", () => {
    it("should query with id + companyId", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await getPurchaseOrderById("c1", "po1");
      const args = mockPrisma.purchaseOrder.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: "po1", companyId: "c1" });
    });
  });

  // ── createPurchaseOrder ──
  describe("createPurchaseOrder", () => {
    // ★ Phase 1.5: assertLocationAndLine 헬퍼가 호출하는 mock 응답 기본값 설정
    beforeEach(() => {
      mockPrisma.location.findFirst.mockResolvedValue({ id: "loc_1" });
      mockPrisma.productionLine.findFirst.mockResolvedValue(null);
    });

    it("should auto-generate PO-YYYYMMDD-001 when first of the day", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: "po1" });

      await createPurchaseOrder("c1", {
        supplierId: "s1",
        locationId: "loc_1",                 
        orderDate: new Date("2026-06-15T00:00:00"),
        isManual: true,
        items: [
          {
            supplierItemId: "si1",
            itemType: "MATERIAL",
            materialMasterId: "m1",
            quantity: 10,
            unitPrice: 100,
          },
        ],
      } as never);

      const data = mockPrisma.purchaseOrder.create.mock.calls[0][0].data;
      expect(data.orderNumber).toBe("PO-20260615-001");
      expect(data.status).toBe("DRAFT");
    });

    it("should increment sequence from last PO of the day (005 → 006)", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        orderNumber: "PO-20260615-005",
      });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: "po1" });

      await createPurchaseOrder("c1", {
        supplierId: "s1",
        orderDate: new Date("2026-06-15T00:00:00"),
        isManual: true,
        items: [
          {
            supplierItemId: "si1",
            itemType: "MATERIAL",
            materialMasterId: "m1",
            quantity: 1,
            unitPrice: 1,
          },
        ],
      } as never);

      const data = mockPrisma.purchaseOrder.create.mock.calls[0][0].data;
      expect(data.orderNumber).toBe("PO-20260615-006");
    });

    it("should auto-calculate totalAmount and per-item totalPrice", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: "po1" });

      await createPurchaseOrder("c1", {
        supplierId: "s1",
        orderDate: new Date("2026-06-15T00:00:00"),
        isManual: true,
        items: [
          {
            supplierItemId: "si1",
            itemType: "MATERIAL",
            materialMasterId: "m1",
            quantity: 10,
            unitPrice: 100,
          },
          {
            supplierItemId: "si2",
            itemType: "MATERIAL",
            materialMasterId: "m2",
            quantity: 5,
            unitPrice: 200,
          },
        ],
      } as never);

      const data = mockPrisma.purchaseOrder.create.mock.calls[0][0].data;
      expect(data.totalAmount).toBe(2000); // 1000 + 1000
      expect(data.items.create[0].totalPrice).toBe(1000);
      expect(data.items.create[1].totalPrice).toBe(1000);
    });

    it("should throw LOCATION_NOT_FOUND when location does not exist", async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null);
  
      await expect(
        createPurchaseOrder("c1", {
          supplierId: "s1",
          locationId: "missing",
          orderDate: new Date("2026-06-15T00:00:00"),
          isManual: true,
          items: [
            {
              supplierItemId: "si1",
              itemType: "MATERIAL",
              materialMasterId: "m1",
              quantity: 1,
              unitPrice: 1,
            },
          ],
        } as never),
      ).rejects.toThrow("LOCATION_NOT_FOUND");
    });
  
    it("should throw PRODUCTION_LINE_NOT_FOUND when line does not exist", async () => {
      mockPrisma.location.findFirst.mockResolvedValue({ id: "loc_1" });
      mockPrisma.productionLine.findFirst.mockResolvedValue(null);
  
      await expect(
        createPurchaseOrder("c1", {
          supplierId: "s1",
          locationId: "loc_1",
          productionLineId: "missing",
          orderDate: new Date("2026-06-15T00:00:00"),
          isManual: true,
          items: [
            {
              supplierItemId: "si1",
              itemType: "MATERIAL",
              materialMasterId: "m1",
              quantity: 1,
              unitPrice: 1,
            },
          ],
        } as never),
      ).rejects.toThrow("PRODUCTION_LINE_NOT_FOUND");
    });
  
    it("should throw LINE_LOCATION_MISMATCH when line belongs to different location", async () => {
      mockPrisma.location.findFirst.mockResolvedValue({ id: "loc_1" });
      mockPrisma.productionLine.findFirst.mockResolvedValue({
        locationId: "loc_OTHER",
      });
  
      await expect(
        createPurchaseOrder("c1", {
          supplierId: "s1",
          locationId: "loc_1",
          productionLineId: "pl_X",
          orderDate: new Date("2026-06-15T00:00:00"),
          isManual: true,
          items: [
            {
              supplierItemId: "si1",
              itemType: "MATERIAL",
              materialMasterId: "m1",
              quantity: 1,
              unitPrice: 1,
            },
          ],
        } as never),
      ).rejects.toThrow("LINE_LOCATION_MISMATCH");
    });  
  });

  // ── updatePurchaseOrder ──
  describe("updatePurchaseOrder", () => {
    it("should throw PO_LOCKED for RECEIVED status", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "RECEIVED",
      });
      await expect(
        updatePurchaseOrder("c1", "po1", { note: "edit" } as never),
      ).rejects.toThrow("PO_LOCKED");
    });

    it("should throw PO_LOCKED for CANCELLED status", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "CANCELLED",
      });
      await expect(
        updatePurchaseOrder("c1", "po1", { note: "edit" } as never),
      ).rejects.toThrow("PO_LOCKED");
    });

    it("should throw NOT_FOUND when PO does not exist", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(
        updatePurchaseOrder("c1", "po1", { note: "x" } as never),
      ).rejects.toThrow("NOT_FOUND");
    });

    it("should delete existing items and recalc totalAmount when items provided", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "DRAFT",
      });
      mockPrisma.purchaseOrderItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ id: "po1" });

      await updatePurchaseOrder("c1", "po1", {
        items: [
          {
            supplierItemId: "si1",
            itemType: "MATERIAL",
            materialMasterId: "m1",
            quantity: 3,
            unitPrice: 500,
          },
        ],
      } as never);

      expect(mockPrisma.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
        where: { purchaseOrderId: "po1" },
      });
      const updateData = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(updateData.totalAmount).toBe(1500);
    });
  });

  // ── transitionPurchaseOrderStatus ──
  describe("transitionPurchaseOrderStatus", () => {
    it("DRAFT → SUBMITTED records submittedAt", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "DRAFT",
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ id: "po1" });

      await transitionPurchaseOrderStatus("c1", "po1", {
        toStatus: "SUBMITTED",
      } as never);

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.status).toBe("SUBMITTED");
      expect(data.submittedAt).toBeInstanceOf(Date);
    });

    it("SUBMITTED → APPROVED records approvedAt and approvedByUser", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "SUBMITTED",
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ id: "po1" });

      await transitionPurchaseOrderStatus("c1", "po1", {
        toStatus: "APPROVED",
        actorUserId: "u1",
      } as never);

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.approvedAt).toBeInstanceOf(Date);
      expect(data.approvedByUser).toEqual({ connect: { id: "u1" } });
    });

    it("SUBMITTED → DRAFT (recall) clears submittedAt", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "SUBMITTED",
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ id: "po1" });

      await transitionPurchaseOrderStatus("c1", "po1", {
        toStatus: "DRAFT",
      } as never);

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.submittedAt).toBeNull();
    });

    it("* → CANCELLED records cancelledAt, reason, and user", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "APPROVED",
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ id: "po1" });

      await transitionPurchaseOrderStatus("c1", "po1", {
        toStatus: "CANCELLED",
        cancelReason: "공급업체 결품",
        actorUserId: "u9",
      } as never);

      const data = mockPrisma.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.cancelledAt).toBeInstanceOf(Date);
      expect(data.cancelReason).toBe("공급업체 결품");
      expect(data.cancelledByUser).toEqual({ connect: { id: "u9" } });
    });

    it("should reject DRAFT → APPROVED (must go through SUBMITTED)", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "DRAFT",
      });
      await expect(
        transitionPurchaseOrderStatus("c1", "po1", {
          toStatus: "APPROVED",
        } as never),
      ).rejects.toThrow("INVALID_TRANSITION");
    });

    it("should reject any transition from RECEIVED (locked)", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "RECEIVED",
      });
      await expect(
        transitionPurchaseOrderStatus("c1", "po1", {
          toStatus: "CANCELLED",
          cancelReason: "x",
        } as never),
      ).rejects.toThrow("INVALID_TRANSITION");
    });

    it("should throw NOT_FOUND when PO does not exist", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(
        transitionPurchaseOrderStatus("c1", "po1", {
          toStatus: "SUBMITTED",
        } as never),
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  // ── deletePurchaseOrder ──
  describe("deletePurchaseOrder", () => {
    it("should reject deletion for non-DRAFT statuses", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "SUBMITTED",
      });
      await expect(deletePurchaseOrder("c1", "po1")).rejects.toThrow(
        "PO_NOT_DRAFT",
      );
    });

    it("should delete items and PO when status is DRAFT", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: "po1",
        status: "DRAFT",
      });
      mockPrisma.purchaseOrderItem.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.purchaseOrder.delete.mockResolvedValue({ id: "po1" });

      await deletePurchaseOrder("c1", "po1");

      expect(mockPrisma.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
        where: { purchaseOrderId: "po1" },
      });
      expect(mockPrisma.purchaseOrder.delete).toHaveBeenCalledWith({
        where: { id: "po1" },
      });
    });

    it("should throw NOT_FOUND when PO does not exist", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(deletePurchaseOrder("c1", "po1")).rejects.toThrow("NOT_FOUND");
    });
  });
});