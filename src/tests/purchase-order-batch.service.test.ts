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
  purchaseOrder: {
    findFirst: vi.fn(),
    create: vi.fn(),
    // ★ R1-b3: DELTA 모드용
    findMany: vi.fn(),
    update: vi.fn(),
  },
  // ★ R1-b3: DELTA 모드용
  purchaseOrderItem: {
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  pOAdjustmentLog: { create: vi.fn() },
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

  // ★ R1-b3: DELTA 모드 mock 기본값 (각 테스트에서 필요시 덮어씀)
  mockTx.purchaseOrder.findMany.mockResolvedValue([]);
  mockTx.purchaseOrder.update.mockImplementation(({ where, data }: any) =>
    Promise.resolve({ id: where.id, totalAmount: data.totalAmount }),
  );
  let itemSeq = 0;
  mockTx.purchaseOrderItem.update.mockImplementation(({ where, data }: any) =>
    Promise.resolve({ id: where.id, ...data }),
  );
  mockTx.purchaseOrderItem.create.mockImplementation(({ data }: any) => {
    itemSeq += 1;
    return Promise.resolve({ id: `poi_new_${itemSeq}`, ...data });
  });
  mockTx.purchaseOrderItem.findMany.mockResolvedValue([]);
  mockTx.pOAdjustmentLog.create.mockResolvedValue({ id: "log_1" });
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

  
  // ════════════════════════════════════════════════════════
  // ★ R1-b3: DELTA 모드 통합 테스트
  // ════════════════════════════════════════════════════════
  describe("DELTA mode (R1-b3)", () => {
    const IDEMPOTENCY_KEY = "wiz-session-abc12345";

    function makeDeltaInput(
      items: any[],
      basedOnPOIds: string[],
    ): CreatePurchaseOrdersBatchInput {
      return {
        companyId: COMPANY_ID,
        orderDate: ORDER_DATE,
        idempotencyKey: IDEMPOTENCY_KEY,
        countSource: "ESTIMATED",
        mode: "DELTA",
        basedOnPOIds,
        items,
      };
    }

    /** 기존 DRAFT PO 1건 + item 1건 mock */
    function mockExistingDraftPO(opts: {
      poId?: string;
      itemId?: string;
      materialMasterId?: string;
      quantity?: number;
      unitPrice?: number;
      status?: "DRAFT" | "SUBMITTED";
    } = {}) {
      mockTx.purchaseOrder.findMany.mockImplementation(({ where }: any) => {
        // 단계 1: basedOnPOIds 조회 vs 단계 11: affectedPOSummaries 집계
        if (where.id?.in && where.companyId) {
          return Promise.resolve([
            {
              id: opts.poId ?? "po_existing_1",
              status: opts.status ?? "DRAFT",
              supplierId: "sup_1",
              locationId: "loc_1",
              productionLineId: null,
              orderDate: ORDER_DATE,
              deliveryDate: null,
              items: [
                {
                  id: opts.itemId ?? "poi_existing_1",
                  materialMasterId: opts.materialMasterId ?? "mat_1",
                  supplierItemId: "si_1",
                  quantity: opts.quantity ?? 1,
                  unitPrice: opts.unitPrice ?? 50000,
                  systemQuantity: null,
                },
              ],
            },
          ]);
        }
        // 단계 11: affectedPOSummaries
        return Promise.resolve([
          {
            id: opts.poId ?? "po_existing_1",
            orderNumber: "PO-20260620-001",
            supplierId: "sup_1",
            locationId: "loc_1",
            productionLineId: null,
            totalAmount: 100000,
            _count: { items: 1 },
          },
        ]);
      });
    }

    // ── 입력 검증 ──
    it("basedOnPOIds 가 비어있으면 DELTA_MISSING_BASED_ON_POS", async () => {
      await expect(
        createPurchaseOrdersBatch(makeDeltaInput([makeItem()], [])),
      ).rejects.toThrow("DELTA_MISSING_BASED_ON_POS");
    });

    it("APPROVED 상태 PO 포함 시 DELTA_BLOCKED_BY_APPROVED_PO", async () => {
      mockTx.purchaseOrder.findMany.mockResolvedValue([
        {
          id: "po_locked",
          status: "APPROVED",
          supplierId: "sup_1",
          locationId: "loc_1",
          productionLineId: null,
          orderDate: ORDER_DATE,
          deliveryDate: null,
          items: [],
        },
      ]);
      await expect(
        createPurchaseOrdersBatch(
          makeDeltaInput([makeItem()], ["po_locked"]),
        ),
      ).rejects.toThrow("DELTA_BLOCKED_BY_APPROVED_PO");
    });

    it("RECEIVED 상태 PO 포함 시도 DELTA_BLOCKED_BY_APPROVED_PO", async () => {
      mockTx.purchaseOrder.findMany.mockResolvedValue([
        {
          id: "po_received",
          status: "RECEIVED",
          supplierId: "sup_1",
          locationId: "loc_1",
          productionLineId: null,
          orderDate: ORDER_DATE,
          deliveryDate: null,
          items: [],
        },
      ]);
      await expect(
        createPurchaseOrdersBatch(
          makeDeltaInput([makeItem()], ["po_received"]),
        ),
      ).rejects.toThrow("DELTA_BLOCKED_BY_APPROVED_PO");
    });

    // ── 수량 변경 ──
    it("DRAFT PO 수량 증가 → item.update + UPDATE_QUANTITY 로그", async () => {
      mockExistingDraftPO({ quantity: 1, unitPrice: 50000 });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 2, unitPrice: 50000 })],
          ["po_existing_1"],
        ),
      );

      // item.update 호출 검증
      expect(mockTx.purchaseOrderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "poi_existing_1" },
          data: expect.objectContaining({
            quantity: 2,
            unitPrice: 50000,
            totalPrice: 100000,
          }),
        }),
      );

      // POAdjustmentLog (UPDATE_QUANTITY) 1회만 적층
      const logCalls = mockTx.pOAdjustmentLog.create.mock.calls;
      const qtyLogs = logCalls.filter(
        ([arg]: any) => arg.data.action === "UPDATE_QUANTITY",
      );
      const priceLogs = logCalls.filter(
        ([arg]: any) => arg.data.action === "UPDATE_UNIT_PRICE",
      );
      expect(qtyLogs).toHaveLength(1);
      expect(priceLogs).toHaveLength(0);
      expect(qtyLogs[0][0].data.reason).toContain("+1박스");

      // adjustmentSummary 검증
      expect(r.adjustmentSummary).toBeDefined();
      expect(r.adjustmentSummary!.increased).toBe(1);
      expect(r.adjustmentSummary!.decreased).toBe(0);
      expect(r.adjustmentSummary!.added).toBe(0);
      expect(r.adjustmentSummary!.totalDeltaAmount).toBe(50000);
      expect(r.adjustmentSummary!.affectedPurchaseOrderIds).toEqual([
        "po_existing_1",
      ]);
    });

    it("DRAFT PO 수량 감소 → -delta 로그 + totalDeltaAmount 음수", async () => {
      mockExistingDraftPO({ quantity: 3, unitPrice: 50000 });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 1, unitPrice: 50000 })],
          ["po_existing_1"],
        ),
      );

      expect(r.adjustmentSummary!.decreased).toBe(1);
      expect(r.adjustmentSummary!.totalDeltaAmount).toBe(-100000);
      const qtyLogs = mockTx.pOAdjustmentLog.create.mock.calls.filter(
        ([arg]: any) => arg.data.action === "UPDATE_QUANTITY",
      );
      expect(qtyLogs[0][0].data.reason).toContain("-2박스");
    });

    // ── 단가 변경 ──
    it("단가만 변경 → UPDATE_UNIT_PRICE 로그만 적층", async () => {
      mockExistingDraftPO({ quantity: 2, unitPrice: 50000 });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 2, unitPrice: 55000 })],
          ["po_existing_1"],
        ),
      );

      const logCalls = mockTx.pOAdjustmentLog.create.mock.calls;
      const qtyLogs = logCalls.filter(
        ([arg]: any) => arg.data.action === "UPDATE_QUANTITY",
      );
      const priceLogs = logCalls.filter(
        ([arg]: any) => arg.data.action === "UPDATE_UNIT_PRICE",
      );
      expect(qtyLogs).toHaveLength(0);
      expect(priceLogs).toHaveLength(1);
      expect(r.adjustmentSummary!.priceChanged).toBe(1);
      expect(r.adjustmentSummary!.totalDeltaAmount).toBe(10000); // 2 × 5000
    });

    it("수량+단가 동시 변경 → 두 로그 모두 적층", async () => {
      mockExistingDraftPO({ quantity: 1, unitPrice: 50000 });

      await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 2, unitPrice: 55000 })],
          ["po_existing_1"],
        ),
      );

      const logCalls = mockTx.pOAdjustmentLog.create.mock.calls;
      expect(
        logCalls.filter(([arg]: any) => arg.data.action === "UPDATE_QUANTITY"),
      ).toHaveLength(1);
      expect(
        logCalls.filter(
          ([arg]: any) => arg.data.action === "UPDATE_UNIT_PRICE",
        ),
      ).toHaveLength(1);
    });

    // ── SUBMITTED 도 허용 ──
    it("SUBMITTED 상태 PO 도 DELTA 가능 (변경됨)", async () => {
      mockExistingDraftPO({
        status: "SUBMITTED",
        quantity: 1,
        unitPrice: 50000,
      });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 3, unitPrice: 50000 })],
          ["po_existing_1"],
        ),
      );

      expect(mockTx.purchaseOrderItem.update).toHaveBeenCalled();
      expect(r.adjustmentSummary!.increased).toBe(1);
    });

    // ── 변경 없음 ──
    it("수량·단가 모두 동일 → unchanged, DB 호출 없음", async () => {
      mockExistingDraftPO({ quantity: 2, unitPrice: 50000 });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 2, unitPrice: 50000 })],
          ["po_existing_1"],
        ),
      );

      expect(mockTx.purchaseOrderItem.update).not.toHaveBeenCalled();
      expect(mockTx.purchaseOrderItem.create).not.toHaveBeenCalled();
      expect(mockTx.pOAdjustmentLog.create).not.toHaveBeenCalled();
      expect(r.adjustmentSummary!.unchanged).toBe(1);
      expect(r.adjustmentSummary!.totalDeltaAmount).toBe(0);
    });

    // ── 신규 자재 추가 (같은 그룹) ──
    it("같은 그룹 신규 자재 → item.create + ADD 로그", async () => {
      mockExistingDraftPO({
        materialMasterId: "mat_1",
        quantity: 1,
        unitPrice: 50000,
      });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [
            // 기존 mat_1 그대로 + 신규 mat_2 (같은 supplier/loc/line)
            makeItem({
              materialMasterId: "mat_1",
              supplierItemId: "si_1",
              quantity: 1,
              unitPrice: 50000,
            }),
            makeItem({
              materialMasterId: "mat_2",
              supplierItemId: "si_3",
              quantity: 2,
              unitPrice: 30000,
            }),
          ],
          ["po_existing_1"],
        ),
      );

      expect(mockTx.purchaseOrderItem.create).toHaveBeenCalledTimes(1);
      const addLogs = mockTx.pOAdjustmentLog.create.mock.calls.filter(
        ([arg]: any) => arg.data.action === "ADD",
      );
      expect(addLogs).toHaveLength(1);
      expect(r.adjustmentSummary!.added).toBe(1);
    });

    // ── 신규 그룹 (다른 supplier) ──
    it("다른 supplier 신규 자재 → 신규 PO 생성", async () => {
      mockExistingDraftPO({
        materialMasterId: "mat_1",
        quantity: 1,
        unitPrice: 50000,
      });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [
            makeItem({
              materialMasterId: "mat_1",
              supplierItemId: "si_1",
              quantity: 1,
              unitPrice: 50000,
            }),
            // 다른 supplier → 신규 그룹
            makeItem({
              supplierId: "sup_2",
              supplierItemId: "si_2",
              materialMasterId: "mat_2",
              quantity: 1,
              unitPrice: 30000,
            }),
          ],
          ["po_existing_1"],
        ),
      );

      // 신규 PO 1건 생성됐는지 확인
      expect(mockTx.purchaseOrder.create).toHaveBeenCalledTimes(1);
      expect(r.adjustmentSummary!.added).toBe(1);
      // 결과에는 영향받은 PO(없음, mat_1 변경없음) + 신규 PO 1건 = 1건
      expect(r.count).toBeGreaterThanOrEqual(1);
    });

    // ── 영향받은 PO totalAmount 재계산 ──
    it("기존 PO 의 totalAmount 재계산 호출", async () => {
      mockExistingDraftPO({ quantity: 1, unitPrice: 50000 });
      mockTx.purchaseOrderItem.findMany.mockResolvedValue([
        { quantity: 2, unitPrice: 50000 },
      ]);

      await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 2, unitPrice: 50000 })],
          ["po_existing_1"],
        ),
      );

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "po_existing_1" },
          data: { totalAmount: 100000 },
        }),
      );
    });

    // ── 멱등성 (DELTA 도 적용) ──
    it("같은 idempotencyKey 재실행 → 기존 batch 결과 반환 (DELTA 분기 진입 안 함)", async () => {
      mockTx.purchaseOrderBatch.findUnique.mockResolvedValue({
        id: "batch_existing",
        purchaseOrders: [
          {
            id: "po_existing_1",
            orderNumber: "PO-20260620-001",
            supplierId: "sup_1",
            locationId: "loc_1",
            productionLineId: null,
            totalAmount: 50000,
            _count: { items: 1 },
          },
        ],
      });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput([makeItem()], ["po_existing_1"]),
      );

      expect(r.isIdempotentReplay).toBe(true);
      expect(r.batchId).toBe("batch_existing");
      // DELTA 분기 진입하지 않으므로 update/create 호출 없음
      expect(mockTx.purchaseOrderItem.update).not.toHaveBeenCalled();
      expect(mockTx.pOAdjustmentLog.create).not.toHaveBeenCalled();
    });

    // ── adjustmentSummary 구조 ──
    it("adjustmentSummary 가 영향받은 PO id 목록을 포함", async () => {
      mockExistingDraftPO({ quantity: 1, unitPrice: 50000 });

      const r = await createPurchaseOrdersBatch(
        makeDeltaInput(
          [makeItem({ quantity: 2 })],
          ["po_existing_1"],
        ),
      );

      expect(r.adjustmentSummary).toBeDefined();
      expect(r.adjustmentSummary!.affectedPurchaseOrderIds).toEqual([
        "po_existing_1",
      ]);
    });
  });

    // ════════════════════════════════════════════════════════
  // ★ R1-b4: REPLACE 모드 통합 테스트
  // ════════════════════════════════════════════════════════
  describe("REPLACE mode (R1-b4)", () => {
    const IDEMPOTENCY_KEY = "wiz-session-replace-xyz98765";

    function makeReplaceInput(
      items: any[],
      basedOnPOIds: string[],
    ): CreatePurchaseOrdersBatchInput {
      return {
        companyId: COMPANY_ID,
        orderDate: ORDER_DATE,
        idempotencyKey: IDEMPOTENCY_KEY,
        countSource: "ESTIMATED",
        mode: "REPLACE",
        basedOnPOIds,
        items,
      };
    }

    /** 기존 PO N건을 status 별로 mock (executeReplaceMode 의 1단계 조회용) */
    function mockExistingPOsForReplace(
      pos: Array<{
        id: string;
        status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RECEIVED" | "CANCELLED";
        orderNumber?: string;
      }>,
    ) {
      mockTx.purchaseOrder.findMany.mockResolvedValue(
        pos.map((p) => ({
          id: p.id,
          status: p.status,
          orderNumber: p.orderNumber ?? `PO-OLD-${p.id}`,
        })),
      );
    }

    // ── 입력 검증 ──
    it("basedOnPOIds 가 비어있으면 REPLACE_MISSING_BASED_ON_POS", async () => {
      await expect(
        createPurchaseOrdersBatch(makeReplaceInput([makeItem()], [])),
      ).rejects.toThrow("REPLACE_MISSING_BASED_ON_POS");
    });

    // ── 차단 가드 ──
    it("APPROVED 상태 PO 포함 시 REPLACE_BLOCKED_BY_LOCKED_PO", async () => {
      mockExistingPOsForReplace([
        { id: "po_draft_1", status: "DRAFT" },
        { id: "po_locked", status: "APPROVED" },
      ]);
      await expect(
        createPurchaseOrdersBatch(
          makeReplaceInput([makeItem()], ["po_draft_1", "po_locked"]),
        ),
      ).rejects.toThrow("REPLACE_BLOCKED_BY_LOCKED_PO");
    });

    it("RECEIVED 상태 PO 포함 시도 REPLACE_BLOCKED_BY_LOCKED_PO", async () => {
      mockExistingPOsForReplace([{ id: "po_received", status: "RECEIVED" }]);
      await expect(
        createPurchaseOrdersBatch(
          makeReplaceInput([makeItem()], ["po_received"]),
        ),
      ).rejects.toThrow("REPLACE_BLOCKED_BY_LOCKED_PO");
    });

    // ── 정상 흐름: DRAFT 만 ──
    it("DRAFT PO 1건 → CANCELLED 전이 + 신규 PO 생성 + REMOVE 로그", async () => {
      mockExistingPOsForReplace([
        { id: "po_draft_1", status: "DRAFT", orderNumber: "PO-20260601-001" },
      ]);

      const r = await createPurchaseOrdersBatch(
        makeReplaceInput([makeItem({ quantity: 2, unitPrice: 50000 })], [
          "po_draft_1",
        ]),
      );

      // 1) 기존 PO 가 CANCELLED 로 전이됐는지
      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "po_draft_1" },
          data: expect.objectContaining({
            status: "CANCELLED",
            cancelReason: expect.stringContaining(
              "REGENERATED_FROM_WIZARD_REPLACE",
            ),
          }),
        }),
      );

      // 2) POAdjustmentLog 가 REMOVE + fieldName="po_status" 로 적층됐는지
      const removeLogs = mockTx.pOAdjustmentLog.create.mock.calls.filter(
        ([arg]: any) => arg.data.action === "REMOVE",
      );
      expect(removeLogs).toHaveLength(1);
      expect(removeLogs[0][0].data.fieldName).toBe("po_status");
      expect(removeLogs[0][0].data.beforeValue).toContain("DRAFT");
      expect(removeLogs[0][0].data.afterValue).toContain("CANCELLED");

      // 3) 신규 PO 1건이 생성됐는지
      expect(mockTx.purchaseOrder.create).toHaveBeenCalledTimes(1);
      expect(r.createdPurchaseOrders).toHaveLength(1);
      expect(r.count).toBe(1);
      expect(r.totalAmount).toBe(100000);

      // 4) adjustmentSummary 에 취소된 PO id 가 들어있는지
      expect(r.adjustmentSummary).toBeDefined();
      expect(r.adjustmentSummary!.affectedPurchaseOrderIds).toEqual([
        "po_draft_1",
      ]);
    });

    // ── 정상 흐름: SUBMITTED 도 허용 ──
    it("SUBMITTED PO 도 CANCELLED 로 전이 가능 (R1-b4 핵심 정책)", async () => {
      mockExistingPOsForReplace([
        { id: "po_sub_1", status: "SUBMITTED", orderNumber: "PO-20260601-002" },
      ]);

      const r = await createPurchaseOrdersBatch(
        makeReplaceInput([makeItem()], ["po_sub_1"]),
      );

      // SUBMITTED 도 CANCELLED 로 전이
      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "po_sub_1" },
          data: expect.objectContaining({ status: "CANCELLED" }),
        }),
      );
      // beforeValue 에 "SUBMITTED" 가 기록됐는지
      const removeLog = mockTx.pOAdjustmentLog.create.mock.calls.find(
        ([arg]: any) => arg.data.action === "REMOVE",
      );
      expect(removeLog![0].data.beforeValue).toContain("SUBMITTED");
      expect(r.adjustmentSummary!.affectedPurchaseOrderIds).toEqual([
        "po_sub_1",
      ]);
    });

    // ── DRAFT + SUBMITTED 혼합 ──
    it("DRAFT + SUBMITTED 혼합 → 둘 다 취소 + 새 PO 생성", async () => {
      mockExistingPOsForReplace([
        { id: "po_draft_1", status: "DRAFT", orderNumber: "PO-20260601-001" },
        { id: "po_sub_1", status: "SUBMITTED", orderNumber: "PO-20260601-002" },
      ]);

      const r = await createPurchaseOrdersBatch(
        makeReplaceInput([makeItem()], ["po_draft_1", "po_sub_1"]),
      );

      // 2건 모두 update 호출 (각각 CANCELLED 로)
      const cancelUpdates = mockTx.purchaseOrder.update.mock.calls.filter(
        ([arg]: any) => arg.data.status === "CANCELLED",
      );
      expect(cancelUpdates).toHaveLength(2);

      // REMOVE 로그도 2건
      const removeLogs = mockTx.pOAdjustmentLog.create.mock.calls.filter(
        ([arg]: any) => arg.data.action === "REMOVE",
      );
      expect(removeLogs).toHaveLength(2);

      // 영향받은 PO id 두 개 모두 기록
      expect(r.adjustmentSummary!.affectedPurchaseOrderIds.sort()).toEqual([
        "po_draft_1",
        "po_sub_1",
      ]);
    });

    // ── note 에 원본 PO 번호 기록 ──
    it("새 PO 의 note 에 취소된 원본 PO 번호가 기록됨", async () => {
      mockExistingPOsForReplace([
        { id: "po_draft_1", status: "DRAFT", orderNumber: "PO-20260601-001" },
        { id: "po_draft_2", status: "DRAFT", orderNumber: "PO-20260601-002" },
      ]);

      await createPurchaseOrdersBatch({
        ...makeReplaceInput([makeItem()], ["po_draft_1", "po_draft_2"]),
        note: "식수 재산정",
      });

      const newPOCall = mockTx.purchaseOrder.create.mock.calls[0][0];
      expect(newPOCall.data.note).toContain("식수 재산정");
      expect(newPOCall.data.note).toContain("[REPLACE]");
      expect(newPOCall.data.note).toContain("PO-20260601-001");
      expect(newPOCall.data.note).toContain("PO-20260601-002");
    });

    // ── 신규 PO 는 DRAFT 상태 ──
    it("새 PO 는 DRAFT 상태로 생성됨 (SUBMITTED 로 바로 가지 않음)", async () => {
      mockExistingPOsForReplace([{ id: "po_draft_1", status: "DRAFT" }]);

      await createPurchaseOrdersBatch(
        makeReplaceInput([makeItem()], ["po_draft_1"]),
      );

      const newPOCall = mockTx.purchaseOrder.create.mock.calls[0][0];
      expect(newPOCall.data.status).toBe("DRAFT");
      expect(newPOCall.data.isManual).toBe(false);
    });
  });
});
