import { describe, it, expect } from "vitest";
import { createPurchaseOrdersBatchSchema } from "@/features/purchase-order/services/purchase-order-batch.service";

const baseItem = {
  supplierId: "sup-1",
  supplierItemId: "si-1",
  itemType: "MATERIAL" as const,
  materialMasterId: "mm-1",
  locationId: "loc-1",
  quantity: 10,
  unitPrice: 1000,
};

const baseInput = {
  companyId: "co-1",
  orderDate: new Date("2026-07-15"),
  items: [baseItem],
};

describe("createPurchaseOrdersBatchSchema — purchaseKind 통합 (S4-1-e)", () => {
  describe("WIZARD (default)", () => {
    it("mealPlanGroupId 있으면 통과", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        mealPlanGroupId: "mpg-1",
      });
      expect(r.success).toBe(true);
    });

    it("mealPlanGroupId 없으면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse(baseInput);
      expect(r.success).toBe(false);
    });

    it("isManual=true 이면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        mealPlanGroupId: "mpg-1",
        isManual: true,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("MANUAL_JIT", () => {
    it("outboundDate + item.lineupId + isManual=true 있으면 통과", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "MANUAL_JIT",
        isManual: true,
        outboundDate: new Date("2026-07-16"),
        items: [{ ...baseItem, lineupId: "lu-1" }],
      });
      expect(r.success).toBe(true);
    });

    it("outboundDate 없으면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "MANUAL_JIT",
        isManual: true,
        items: [{ ...baseItem, lineupId: "lu-1" }],
      });
      expect(r.success).toBe(false);
    });

    it("item.lineupId 없으면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "MANUAL_JIT",
        isManual: true,
        outboundDate: new Date("2026-07-16"),
      });
      expect(r.success).toBe(false);
    });

    it("isManual=false 이면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "MANUAL_JIT",
        isManual: false,
        outboundDate: new Date("2026-07-16"),
        items: [{ ...baseItem, lineupId: "lu-1" }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe("STOCK_KEEPING", () => {
    it("mealPlanGroupId/outboundDate/item.lineupId 없이 통과", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "STOCK_KEEPING",
        isManual: true,
      });
      expect(r.success).toBe(true);
    });

    it("mealPlanGroupId 지정하면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "STOCK_KEEPING",
        isManual: true,
        mealPlanGroupId: "mpg-1",
      });
      expect(r.success).toBe(false);
    });

    it("outboundDate 지정하면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "STOCK_KEEPING",
        isManual: true,
        outboundDate: new Date("2026-07-16"),
      });
      expect(r.success).toBe(false);
    });

    it("item.lineupId 지정하면 실패", () => {
      const r = createPurchaseOrdersBatchSchema.safeParse({
        ...baseInput,
        purchaseKind: "STOCK_KEEPING",
        isManual: true,
        items: [{ ...baseItem, lineupId: "lu-1" }],
      });
      expect(r.success).toBe(false);
    });
  });
});
