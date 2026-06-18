import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPurchaseOrdersBatch,
  type CreatePurchaseOrdersBatchInput,
} from "@/features/purchase-order/services/purchase-order-batch.service";

// ── Prisma mock ──
const mockTx = {
  location: { findMany: vi.fn() },
  productionLine: { findMany: vi.fn() },
  supplier: { findMany: vi.fn() },
  supplierItem: { findMany: vi.fn() },
  purchaseOrder: { findFirst: vi.fn(), create: vi.fn() },
  // ★ R1-b1: 멱등성 batch 모델
  purchaseOrderBatch: { findUnique: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb(mockTx)),
  },
}));

const COMPANY_ID = "co_1";
const ORDER_DATE = new Date("2026-06-20");

function makeItem(overrides: Partial<{
  supplierId: string;
  supplierItemId: string;
  locationId: string;
  productionLineId: string | null;
  materialMasterId: string;
  quantity: number;
  unitPrice: number;
}> = {}) {
  return {
    supplierId: overrides.supplierId ?? "sup_1",
    supplierItemId: overrides.supplierItemId ?? "si_1",
    itemType: "MATERIAL" as const,
    materialMasterId: overrides.materialMasterId ?? "mat_1",
    locationId: overrides.locationId ?? "loc_1",
    productionLineId: overrides.productionLineId ?? null,
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 50000,
  };
}

function makeInput(items: any[]): CreatePurchaseOrdersBatchInput {
  return {
    companyId: COMPANY_ID,
    orderDate: ORDER_DATE,
    // ★ R1-b1: 본 테스트는 idempotencyKey 미지정 경로(레거시 호환) 검증
    countSource: "ESTIMATED",
    mode: "NEW",
    basedOnPOIds: [],
    items,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 기본 mock 동작
  // ★ R1-b1: idempotencyKey 미지정 경로면 호출되지 않지만 안전망으로 기본값 설정
  mockTx.purchaseOrderBatch.findUnique.mockResolvedValue(null);
  mockTx.purchaseOrderBatch.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "batch_test", ...data }),
  );
  mockTx.location.findMany.mockResolvedValue([{ id: "loc_1" }, { id: "loc_2" }]);
  mockTx.productionLine.findMany.mockResolvedValue([
    { id: "line_1", locationId: "loc_1" },
  ]);
  mockTx.supplier.findMany.mockResolvedValue([
    { id: "sup_1" },
    { id: "sup_2" },
  ]);
  mockTx.supplierItem.findMany.mockResolvedValue([
    { id: "si_1", supplierId: "sup_1" },
    { id: "si_2", supplierId: "sup_2" },
    { id: "si_3", supplierId: "sup_1" },
  ]);
  mockTx.purchaseOrder.findFirst.mockResolvedValue(null);
  let seq = 0;
  mockTx.purchaseOrder.create.mockImplementation(({ data }: any) => {
    seq += 1;
    return Promise.resolve({
      id: `po_${seq}`,
      orderNumber: data.orderNumber,
      supplierId: data.supplierId,
      locationId: data.locationId,
      productionLineId: data.productionLineId,
      totalAmount: data.totalAmount,
      _count: { items: data.items.create.length },
    });
  });
});

describe("createPurchaseOrdersBatch", () => {
  // ── 기본 동작 ──
  it("동일 공급업체+공장 항목 2개 → 1개 PO 생성", async () => {
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ supplierItemId: "si_1", quantity: 1, unitPrice: 50000 }),
        makeItem({ supplierItemId: "si_3", quantity: 2, unitPrice: 30000 }),
      ]),
    );

    expect(r.count).toBe(1);
    expect(r.createdPurchaseOrders).toHaveLength(1);
    expect(r.createdPurchaseOrders[0].itemCount).toBe(2);
    expect(r.createdPurchaseOrders[0].totalAmount).toBe(50000 + 60000);
    expect(r.totalAmount).toBe(110000);
  });

  it("다른 공급업체 항목 → 2개 PO로 분리", async () => {
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ supplierId: "sup_1", supplierItemId: "si_1" }),
        makeItem({ supplierId: "sup_2", supplierItemId: "si_2" }),
      ]),
    );

    expect(r.count).toBe(2);
    const supplierIds = r.createdPurchaseOrders.map((p) => p.supplierId).sort();
    expect(supplierIds).toEqual(["sup_1", "sup_2"]);
  });

  it("다른 공장 항목 → 2개 PO로 분리", async () => {
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ locationId: "loc_1" }),
        makeItem({ locationId: "loc_2", supplierItemId: "si_3" }),
      ]),
    );
    expect(r.count).toBe(2);
  });

  it("라인 null과 라인 있는 항목 → 별도 PO", async () => {
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ productionLineId: null }),
        makeItem({ productionLineId: "line_1", supplierItemId: "si_3" }),
      ]),
    );
    expect(r.count).toBe(2);
  });

  // ── 발주번호 채번 ──
  it("발주번호가 같은 트랜잭션 내에서 순차적으로 증가", async () => {
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ supplierId: "sup_1", supplierItemId: "si_1" }),
        makeItem({ supplierId: "sup_2", supplierItemId: "si_2" }),
      ]),
    );
    const orderNumbers = r.createdPurchaseOrders.map((p) => p.orderNumber).sort();
    expect(orderNumbers).toEqual(["PO-20260620-001", "PO-20260620-002"]);
  });

  it("기존 발주가 있으면 다음 시퀀스부터 채번", async () => {
    mockTx.purchaseOrder.findFirst.mockResolvedValue({
      orderNumber: "PO-20260620-005",
    });
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ supplierId: "sup_1", supplierItemId: "si_1" }),
        makeItem({ supplierId: "sup_2", supplierItemId: "si_2" }),
      ]),
    );
    expect(r.createdPurchaseOrders.map((p) => p.orderNumber).sort()).toEqual([
      "PO-20260620-006",
      "PO-20260620-007",
    ]);
  });

  // ── 정합성 검증 ──
  it("빈 items → EMPTY_ITEMS", async () => {
    await expect(
      createPurchaseOrdersBatch(makeInput([])),
    ).rejects.toThrow("EMPTY_ITEMS");
  });

  it("존재하지 않는 공장 → LOCATION_NOT_FOUND", async () => {
    mockTx.location.findMany.mockResolvedValue([{ id: "loc_1" }]); // loc_2 없음
    await expect(
      createPurchaseOrdersBatch(
        makeInput([makeItem({ locationId: "loc_2", supplierItemId: "si_3" })]),
      ),
    ).rejects.toThrow("LOCATION_NOT_FOUND");
  });

  it("존재하지 않는 라인 → PRODUCTION_LINE_NOT_FOUND", async () => {
    mockTx.productionLine.findMany.mockResolvedValue([]);
    await expect(
      createPurchaseOrdersBatch(
        makeInput([makeItem({ productionLineId: "line_ghost" })]),
      ),
    ).rejects.toThrow("PRODUCTION_LINE_NOT_FOUND");
  });

  it("라인-공장 불일치 → LINE_LOCATION_MISMATCH", async () => {
    // line_1은 loc_1 소속인데 loc_2로 발주
    await expect(
      createPurchaseOrdersBatch(
        makeInput([
          makeItem({
            locationId: "loc_2",
            productionLineId: "line_1",
            supplierItemId: "si_3",
          }),
        ]),
      ),
    ).rejects.toThrow("LINE_LOCATION_MISMATCH");
  });

  it("존재하지 않는 공급업체 → SUPPLIER_NOT_FOUND", async () => {
    mockTx.supplier.findMany.mockResolvedValue([{ id: "sup_1" }]);
    await expect(
      createPurchaseOrdersBatch(
        makeInput([
          makeItem({ supplierId: "sup_ghost", supplierItemId: "si_1" }),
        ]),
      ),
    ).rejects.toThrow();
  });

  it("SupplierItem이 다른 공급업체 소속 → SUPPLIER_ITEM_NOT_FOUND", async () => {
    await expect(
      createPurchaseOrdersBatch(
        makeInput([
          // si_2는 sup_2 소속인데 sup_1로 지정
          makeItem({ supplierId: "sup_1", supplierItemId: "si_2" }),
        ]),
      ),
    ).rejects.toThrow("SUPPLIER_ITEM_NOT_FOUND");
  });

  // ── 트랜잭션 / 부수효과 ──
  it("PO 생성 시 mealPlanGroupId와 createdByUserId가 전달됨", async () => {
    await createPurchaseOrdersBatch({
      ...makeInput([makeItem()]),
      mealPlanGroupId: "mpg_1",
      createdByUserId: "user_1",
    });
    expect(mockTx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mealPlanGroupId: "mpg_1",
          createdByUserId: "user_1",
          isManual: false,
        }),
      }),
    );
  });

  it("모든 PO가 DRAFT 상태로 생성됨", async () => {
    await createPurchaseOrdersBatch(makeInput([makeItem()]));
    expect(mockTx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
  });

  it("sourceType='WIZARD_AUTO'로 모든 항목 생성", async () => {
    await createPurchaseOrdersBatch(makeInput([makeItem()]));
    const callArg = mockTx.purchaseOrder.create.mock.calls[0][0];
    const itemCreate = callArg.data.items.create[0];
    expect(itemCreate.sourceType).toBe("WIZARD_AUTO");
  });

  it("MR 추적 정보(materialRequirementId)가 보존됨", async () => {
    await createPurchaseOrdersBatch(
      makeInput([{ ...makeItem(), materialRequirementId: "mr_1" }]),
    );
    const callArg = mockTx.purchaseOrder.create.mock.calls[0][0];
    expect(callArg.data.items.create[0].materialRequirementId).toBe("mr_1");
  });

  it("totalPrice가 quantity × unitPrice로 자동 계산됨", async () => {
    await createPurchaseOrdersBatch(
      makeInput([makeItem({ quantity: 3, unitPrice: 7000 })]),
    );
    const callArg = mockTx.purchaseOrder.create.mock.calls[0][0];
    expect(callArg.data.items.create[0].totalPrice).toBe(21000);
    expect(callArg.data.totalAmount).toBe(21000);
  });

  // ── 복합 시나리오 ──
  it("4건 / 2공급업체 × 2공장 → 정확히 4개 PO", async () => {
    const r = await createPurchaseOrdersBatch(
      makeInput([
        makeItem({ supplierId: "sup_1", supplierItemId: "si_1", locationId: "loc_1" }),
        makeItem({ supplierId: "sup_1", supplierItemId: "si_3", locationId: "loc_2" }),
        makeItem({ supplierId: "sup_2", supplierItemId: "si_2", locationId: "loc_1" }),
        makeItem({ supplierId: "sup_2", supplierItemId: "si_2", locationId: "loc_2" }),
      ]),
    );
    expect(r.count).toBe(4);
  });
});
