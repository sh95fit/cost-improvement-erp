import { describe, expect, it, vi, beforeEach } from "vitest";
import { stackPriceHistoryForPO } from "@/features/purchase-order/lib/stack-price-history";

const mockTx = {
  purchaseOrderItem: { findMany: vi.fn() },
  supplierItem: { findMany: vi.fn(), update: vi.fn() },
  supplierItemPriceHistory: { create: vi.fn() },
};

const PO_ID = "po_1";
const EFFECTIVE_DATE = new Date("2026-06-20T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.supplierItem.update.mockResolvedValue({});
  mockTx.supplierItemPriceHistory.create.mockResolvedValue({});
});

describe("stackPriceHistoryForPO", () => {
  it("PO에 item이 없으면 적층 없음", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([]);

    const r = await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(r.stackedCount).toBe(0);
    expect(r.changes).toHaveLength(0);
    expect(mockTx.supplierItemPriceHistory.create).not.toHaveBeenCalled();
    expect(mockTx.supplierItem.update).not.toHaveBeenCalled();
  });

  it("모든 단가가 currentPrice와 동일 → 적층 없음", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 50000 },
      { supplierItemId: "si_2", unitPrice: 30000 },
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([
      { id: "si_1", currentPrice: 50000 },
      { id: "si_2", currentPrice: 30000 },
    ]);

    const r = await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(r.stackedCount).toBe(0);
    expect(mockTx.supplierItemPriceHistory.create).not.toHaveBeenCalled();
    expect(mockTx.supplierItem.update).not.toHaveBeenCalled();
  });

  it("일부 단가만 변경 → 변경된 항목만 적층 + 갱신", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 55000 }, // 변경됨
      { supplierItemId: "si_2", unitPrice: 30000 }, // 동일
      { supplierItemId: "si_3", unitPrice: 45000 }, // 변경됨
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([
      { id: "si_1", currentPrice: 50000 },
      { id: "si_2", currentPrice: 30000 },
      { id: "si_3", currentPrice: 40000 },
    ]);

    const r = await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(r.stackedCount).toBe(2);
    expect(r.changes).toEqual(
      expect.arrayContaining([
        { supplierItemId: "si_1", fromPrice: 50000, toPrice: 55000 },
        { supplierItemId: "si_3", fromPrice: 40000, toPrice: 45000 },
      ]),
    );
    expect(mockTx.supplierItemPriceHistory.create).toHaveBeenCalledTimes(2);
    expect(mockTx.supplierItem.update).toHaveBeenCalledTimes(2);
  });

  it("PriceHistory 적층 시 effectiveFrom = 전달받은 날짜", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 55000 },
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([
      { id: "si_1", currentPrice: 50000 },
    ]);

    await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(mockTx.supplierItemPriceHistory.create).toHaveBeenCalledWith({
      data: {
        supplierItemId: "si_1",
        price: 55000,
        effectiveFrom: EFFECTIVE_DATE,
      },
    });
  });

  it("currentPrice가 변경된 값으로 갱신됨", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 55000 },
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([
      { id: "si_1", currentPrice: 50000 },
    ]);

    await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(mockTx.supplierItem.update).toHaveBeenCalledWith({
      where: { id: "si_1" },
      data: { currentPrice: 55000 },
    });
  });

  it("같은 supplierItemId가 여러 행에 있으면 첫 행의 단가 사용", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 55000 }, // 첫 행
      { supplierItemId: "si_1", unitPrice: 60000 }, // 무시
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([
      { id: "si_1", currentPrice: 50000 },
    ]);

    const r = await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(r.stackedCount).toBe(1);
    expect(r.changes[0].toPrice).toBe(55000);
  });

  it("SupplierItem이 삭제된 경우(조회 결과 없음) → 해당 항목 무시", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 55000 },
      { supplierItemId: "si_ghost", unitPrice: 70000 },
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([
      { id: "si_1", currentPrice: 50000 },
      // si_ghost는 조회 결과 없음
    ]);

    const r = await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(r.stackedCount).toBe(1);
    expect(r.changes).toEqual([
      { supplierItemId: "si_1", fromPrice: 50000, toPrice: 55000 },
    ]);
  });

  it("supplierItem 조회 시 모든 supplierItemId가 전달됨 (일괄 조회)", async () => {
    mockTx.purchaseOrderItem.findMany.mockResolvedValue([
      { supplierItemId: "si_1", unitPrice: 100 },
      { supplierItemId: "si_2", unitPrice: 200 },
      { supplierItemId: "si_3", unitPrice: 300 },
    ]);
    mockTx.supplierItem.findMany.mockResolvedValue([]);

    await stackPriceHistoryForPO(mockTx as any, PO_ID, EFFECTIVE_DATE);

    expect(mockTx.supplierItem.findMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["si_1", "si_2", "si_3"]) } },
      select: { id: true, currentPrice: true },
    });
  });
});
