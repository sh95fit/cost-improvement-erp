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
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
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
