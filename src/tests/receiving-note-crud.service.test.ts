import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockPrisma } from "./mocks/prisma";
import {
  getReceivingNotes,
  getReceivingNoteById,
  getReceivingDiscrepanciesByPO,
  createReceivingNoteDraft,
  ReceivingNoteAlreadyExistsError,
  PurchaseOrderNotEligibleForReceivingError,
} from "@/features/receiving-note/services/receiving-note.service";

// prisma 인스턴스를 mockPrisma 로 대체
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

const COMPANY_ID = "company-1";

describe("getReceivingNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("페이지네이션 + 필터로 목록 반환", async () => {
    mockPrisma.receivingNote.findMany.mockResolvedValue([{ id: "n-1" }]);
    mockPrisma.receivingNote.count.mockResolvedValue(1);

    const result = await getReceivingNotes(COMPANY_ID, {
      page: 1, limit: 20, sortBy: "receivedDate", sortOrder: "desc",
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
    expect(mockPrisma.receivingNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID }) }),
    );
  });

  it("status 필터 적용", async () => {
    mockPrisma.receivingNote.findMany.mockResolvedValue([]);
    mockPrisma.receivingNote.count.mockResolvedValue(0);

    await getReceivingNotes(COMPANY_ID, {
      page: 1, limit: 20, status: "DRAFT",
      sortBy: "receivedDate", sortOrder: "desc",
    });

    expect(mockPrisma.receivingNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "DRAFT" }) }),
    );
  });
});

describe("createReceivingNoteDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
      );
  });

  it("SUBMITTED PO 에 초안 생성 성공", async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({ id: "po-1", status: "SUBMITTED" });
    mockPrisma.receivingNote.findFirst.mockResolvedValue(null); // 기존 노트 없음
    mockPrisma.receivingNote.create.mockResolvedValue({
      id: "n-1", receiveNumber: "RN-20260701-001", items: [],
    });

    const result = await createReceivingNoteDraft(COMPANY_ID, {
      purchaseOrderId: "po-1",
      receivedDate: new Date("2026-07-01"),
      items: [{ purchaseOrderItemId: "poi-1", receivedQty: 10, unitPrice: 1000 }],
    });

    expect(result.id).toBe("n-1");
    expect(mockPrisma.receivingNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          receiveNumber: expect.stringMatching(/^RN-20260701-\d{3}$/),
        }),
      }),
    );
  });

  it("이미 노트가 있는 PO: ReceivingNoteAlreadyExistsError", async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({ id: "po-1", status: "SUBMITTED" });
    mockPrisma.receivingNote.findFirst.mockResolvedValue({ id: "n-existing" });

    await expect(
      createReceivingNoteDraft(COMPANY_ID, {
        purchaseOrderId: "po-1",
        receivedDate: new Date(),
        items: [{ purchaseOrderItemId: "poi-1", receivedQty: 10, unitPrice: 1000 }],
      }),
    ).rejects.toBeInstanceOf(ReceivingNoteAlreadyExistsError);
  });

  it("PO 가 SUBMITTED 아님: PurchaseOrderNotEligibleForReceivingError", async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({ id: "po-1", status: "DRAFT" });

    await expect(
      createReceivingNoteDraft(COMPANY_ID, {
        purchaseOrderId: "po-1",
        receivedDate: new Date(),
        items: [{ purchaseOrderItemId: "poi-1", receivedQty: 10, unitPrice: 1000 }],
      }),
    ).rejects.toBeInstanceOf(PurchaseOrderNotEligibleForReceivingError);
  });

  it("PO 미존재: NOT_FOUND", async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);

    await expect(
      createReceivingNoteDraft(COMPANY_ID, {
        purchaseOrderId: "po-1",
        receivedDate: new Date(),
        items: [{ purchaseOrderItemId: "poi-1", receivedQty: 10, unitPrice: 1000 }],
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("getReceivingDiscrepanciesByPO", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PO ID 기반으로 discrepancy 목록 반환", async () => {
    mockPrisma.receivingDiscrepancy.findMany.mockResolvedValue([{ id: "d-1" }]);

    const result = await getReceivingDiscrepanciesByPO(COMPANY_ID, "po-1");

    expect(result).toHaveLength(1);
    expect(mockPrisma.receivingDiscrepancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: COMPANY_ID, purchaseOrderId: "po-1" },
      }),
    );
  });
});

import {
    getReceivingDashboardSummary,
    listEligiblePOsForReceiving,
  } from "@/features/receiving-note/services/receiving-note.service";
  
  describe("getReceivingDashboardSummary", () => {
    beforeEach(() => vi.clearAllMocks());
  
    it("모든 카운트/목록/불일치 요약을 병렬 조회하여 반환", async () => {
      // counts
      mockPrisma.receivingNote.count
        .mockResolvedValueOnce(12) // totalNotes
        .mockResolvedValueOnce(3)  // draftNotes
        .mockResolvedValueOnce(7); // confirmedThisMonth
      mockPrisma.purchaseOrder.count.mockResolvedValueOnce(2); // eligiblePOsCount
  
      // recentNotes
      mockPrisma.receivingNote.findMany.mockResolvedValueOnce([{ id: "n-1" }]);
      // eligiblePOs
      mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([{ id: "po-1" }]);
      // discrepancy groupBy
      (mockPrisma.receivingDiscrepancy as unknown as {
        groupBy: ReturnType<typeof vi.fn>;
      }).groupBy = vi.fn().mockResolvedValue([
        { type: "QUANTITY_SHORT", _count: { _all: 2 } },
        { type: "UNIT_PRICE_DIFF", _count: { _all: 3 } },
      ]);
  
      const result = await getReceivingDashboardSummary(COMPANY_ID);
  
      expect(result.counts).toEqual({
        totalNotes: 12,
        draftNotes: 3,
        confirmedThisMonth: 7,
        eligiblePOs: 2,
      });
      expect(result.recentNotes).toHaveLength(1);
      expect(result.eligiblePOs).toHaveLength(1);
      expect(result.discrepancySummary30d.QUANTITY_SHORT).toBe(2);
      expect(result.discrepancySummary30d.UNIT_PRICE_DIFF).toBe(3);
      expect(result.discrepancySummary30d.total).toBe(5);
    });
  });
  
  describe("listEligiblePOsForReceiving", () => {
    beforeEach(() => vi.clearAllMocks());
  
    it("SUBMITTED + 노트 없는 PO 만 조회", async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([{ id: "po-1" }]);
  
      const result = await listEligiblePOsForReceiving(COMPANY_ID);
  
      expect(result).toHaveLength(1);
      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            status: "SUBMITTED",
            receivingNotes: { none: {} },
          }),
          take: 50,
        }),
      );
    });
  
    it("search 옵션 적용", async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
  
      await listEligiblePOsForReceiving(COMPANY_ID, { search: "PO-2026" });
  
      const call = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(2);
    });
  });  

  // ════════════════════════════════════════
// D30 C-3-c: DRAFT 수정/삭제 테스트
// ════════════════════════════════════════

import {
  updateReceivingNoteDraft,
  deleteReceivingNoteDraft,
  ReceivingNoteNotDraftError,
} from "@/features/receiving-note/services/receiving-note.service";

describe("updateReceivingNoteDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DRAFT 상태 입고서를 수정하고 items 를 재생성한다", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockPrisma.receivingNote.findFirst.mockResolvedValue({
      id: "note-1",
      status: "DRAFT",
      purchaseOrderId: "po-1",
    });
    mockPrisma.receivingNoteItem.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.receivingNote.update.mockResolvedValue({
      id: "note-1",
      receiveNumber: "RN-20260703-001",
      receivedDate: new Date("2026-07-03"),
      note: "수정됨",
      items: [{ id: "it-a" }, { id: "it-b" }],
    });

    const result = await updateReceivingNoteDraft(COMPANY_ID, {
      receivingNoteId: "note-1",
      receivedDate: new Date("2026-07-03"),
      note: "수정됨",
      items: [
        { purchaseOrderItemId: "poit-1", receivedQty: 10, unitPrice: 1000 },
        { purchaseOrderItemId: "poit-2", receivedQty: 5, unitPrice: 500 },
      ],
    });

    expect(mockPrisma.receivingNoteItem.deleteMany).toHaveBeenCalledWith({
      where: { receivingNoteId: "note-1" },
    });
    expect(mockPrisma.receivingNote.update).toHaveBeenCalled();
    expect(result.id).toBe("note-1");
  });

  it("CONFIRMED 상태이면 ReceivingNoteNotDraftError 를 throw 한다", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockPrisma.receivingNote.findFirst.mockResolvedValue({
      id: "note-1",
      status: "CONFIRMED",
      purchaseOrderId: "po-1",
    });

    await expect(
      updateReceivingNoteDraft(COMPANY_ID, {
        receivingNoteId: "note-1",
        receivedDate: new Date("2026-07-03"),
        items: [
          { purchaseOrderItemId: "poit-1", receivedQty: 10, unitPrice: 1000 },
        ],
      }),
    ).rejects.toThrow(ReceivingNoteNotDraftError);
  });

  it("노트가 없으면 NOT_FOUND 를 throw 한다", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockPrisma.receivingNote.findFirst.mockResolvedValue(null);

    await expect(
      updateReceivingNoteDraft(COMPANY_ID, {
        receivingNoteId: "note-missing",
        receivedDate: new Date("2026-07-03"),
        items: [
          { purchaseOrderItemId: "poit-1", receivedQty: 10, unitPrice: 1000 },
        ],
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("deleteReceivingNoteDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DRAFT 상태 입고서를 삭제한다", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockPrisma.receivingNote.findFirst.mockResolvedValue({
      id: "note-1",
      status: "DRAFT",
      purchaseOrderId: "po-1",
      receiveNumber: "RN-20260703-001",
    });
    mockPrisma.receivingNote.delete.mockResolvedValue({ id: "note-1" });

    const result = await deleteReceivingNoteDraft(COMPANY_ID, "note-1");

    expect(mockPrisma.receivingNote.delete).toHaveBeenCalledWith({
      where: { id: "note-1" },
    });
    expect(result.id).toBe("note-1");
    expect(result.receiveNumber).toBe("RN-20260703-001");
  });

  it("CONFIRMED 상태이면 ReceivingNoteNotDraftError 를 throw 한다", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockPrisma.receivingNote.findFirst.mockResolvedValue({
      id: "note-1",
      status: "CONFIRMED",
      purchaseOrderId: "po-1",
      receiveNumber: "RN-20260703-001",
    });

    await expect(
      deleteReceivingNoteDraft(COMPANY_ID, "note-1"),
    ).rejects.toThrow(ReceivingNoteNotDraftError);
  });
});
