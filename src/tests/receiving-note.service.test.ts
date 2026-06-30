import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiscrepancyType } from "@prisma/client";

import { mockPrisma } from "./mocks/prisma";
import {
  confirmReceivingNote,
  ReceivingNoteNotFoundError,
  ReceivingNoteAlreadyConfirmedError,
  ReceivingNoteCompanyMismatchError,
} from "@/features/receiving-note/services/receiving-note.service";

// withTransaction은 mockPrisma.$transaction과 같은 방식으로 콜백을 즉시 실행
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)),
}));

// transitionPurchaseOrderStatus는 호출 여부만 검증
vi.mock("@/features/purchase-order/services/purchase-order.service", () => ({
  transitionPurchaseOrderStatus: vi.fn().mockResolvedValue({ id: "po-1", status: "RECEIVED" }),
}));

const COMPANY_ID = "company-1";
const ACTOR_ID = "user-1";
const NOTE_ID = "note-1";
const PO_ID = "po-1";

function buildNote(overrides?: Partial<ReturnType<typeof baseNote>>) {
  return { ...baseNote(), ...overrides };
}

function baseNote() {
  return {
    id: NOTE_ID,
    companyId: COMPANY_ID,
    purchaseOrderId: PO_ID,
    status: "DRAFT",
    receivedDate: new Date("2026-06-30"),
    confirmedAt: null,
    confirmedByUserId: null,
    items: [
      {
        id: "rni-1",
        purchaseOrderItemId: "poi-1",
        quantity: 10,
        unitPrice: 1000,
      },
    ],
    purchaseOrder: {
      id: PO_ID,
      companyId: COMPANY_ID,
      locationId: "loc-1",
      items: [
        {
          id: "poi-1",
          purchaseOrderId: PO_ID,
          supplierItemId: "si-1",
          itemType: "MATERIAL",
          materialMasterId: "mm-1",
          subsidiaryMasterId: null,
          quantity: 10,
          unitPrice: 1000,
          receivedQty: 0,
        },
      ],
    },
  };
}

describe("confirmReceivingNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.inventoryLot.create.mockResolvedValue({ id: "lot-1" });
    mockPrisma.inventoryTransaction.create.mockResolvedValue({ id: "tx-1" });
    mockPrisma.purchaseOrderItem.update.mockResolvedValue({});
    mockPrisma.receivingDiscrepancy.create.mockResolvedValue({});
    mockPrisma.receivingNote.update.mockResolvedValue({ id: NOTE_ID, status: "CONFIRMED" });
  });

  it("정상 케이스: 수량·단가 일치 시 Lot/Tx 생성, Discrepancy 없음, PO → RECEIVED", async () => {
    mockPrisma.receivingNote.findUnique.mockResolvedValue(buildNote());

    const result = await confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID);

    expect(mockPrisma.inventoryLot.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "poi-1" },
      data: { receivedQty: { increment: 10 } },
    });
    expect(mockPrisma.receivingDiscrepancy.create).not.toHaveBeenCalled();
    expect(result.status).toBe("CONFIRMED");

    const { transitionPurchaseOrderStatus } = await import(
      "@/features/purchase-order/services/purchase-order.service"
    );
    expect(transitionPurchaseOrderStatus).toHaveBeenCalledWith(
      COMPANY_ID,
      PO_ID,
      "RECEIVED",
      expect.objectContaining({ existingTx: expect.anything() }),
    );
  });

  it("수량 부족: QUANTITY_SHORT 스냅샷 기록", async () => {
    const note = buildNote();
    note.items[0].quantity = 7;
    mockPrisma.receivingNote.findUnique.mockResolvedValue(note);

    await confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID);

    expect(mockPrisma.receivingDiscrepancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: DiscrepancyType.QUANTITY_SHORT,
          expectedQty: 10,
          actualQty: 7,
          diffValue: -3,
        }),
      }),
    );
  });

  it("수량 초과: QUANTITY_OVER 스냅샷 기록", async () => {
    const note = buildNote();
    note.items[0].quantity = 12;
    mockPrisma.receivingNote.findUnique.mockResolvedValue(note);

    await confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID);

    expect(mockPrisma.receivingDiscrepancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: DiscrepancyType.QUANTITY_OVER,
          diffValue: 2,
        }),
      }),
    );
  });

  it("단가 불일치: UNIT_PRICE_DIFF 스냅샷만 기록 (Lot.unitCost는 PO 단가 유지 - P9)", async () => {
    const note = buildNote();
    note.items[0].unitPrice = 1100; // 입고 단가가 다름
    mockPrisma.receivingNote.findUnique.mockResolvedValue(note);

    await confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID);

    // Lot의 unitCost는 PO 단가(1000)로 고정
    expect(mockPrisma.inventoryLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unitCost: 1000 }),
      }),
    );
    // UNIT_PRICE_DIFF 스냅샷 존재
    expect(mockPrisma.receivingDiscrepancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: DiscrepancyType.UNIT_PRICE_DIFF,
          expectedUnitPrice: 1000,
          actualUnitPrice: 1100,
          diffValue: 100,
        }),
      }),
    );
  });

  it("발주에 없는 항목이 입고됨: ITEM_MISSING 스냅샷, Lot 생성 없음", async () => {
    const note = buildNote();
    note.items[0].purchaseOrderItemId = "poi-unknown"; // PO에 없는 ID
    mockPrisma.receivingNote.findUnique.mockResolvedValue(note);

    await confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID);

    expect(mockPrisma.inventoryLot.create).not.toHaveBeenCalled();
    expect(mockPrisma.receivingDiscrepancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: DiscrepancyType.ITEM_MISSING,
          reason: expect.stringContaining("발주에 없는"),
        }),
      }),
    );
  });

  it("발주에 있었지만 입고에 없는 항목: ITEM_MISSING 스냅샷", async () => {
    const note = buildNote();
    // PO에는 poi-1, poi-2 두 항목 있지만 입고서에는 poi-1만
    note.purchaseOrder.items.push({
      id: "poi-2",
      purchaseOrderId: PO_ID,
      supplierItemId: "si-2",
      itemType: "MATERIAL",
      materialMasterId: "mm-2",
      subsidiaryMasterId: null,
      quantity: 5,
      unitPrice: 500,
      receivedQty: 0,
    });
    mockPrisma.receivingNote.findUnique.mockResolvedValue(note);

    await confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID);

    expect(mockPrisma.receivingDiscrepancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: DiscrepancyType.ITEM_MISSING,
          purchaseOrderItemId: "poi-2",
          actualQty: 0,
          diffValue: -5,
        }),
      }),
    );
  });

  it("이미 CONFIRMED 상태: 에러", async () => {
    mockPrisma.receivingNote.findUnique.mockResolvedValue(
      buildNote({ status: "CONFIRMED" }),
    );

    await expect(
      confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID),
    ).rejects.toBeInstanceOf(ReceivingNoteAlreadyConfirmedError);
  });

  it("companyId 불일치: 에러", async () => {
    mockPrisma.receivingNote.findUnique.mockResolvedValue(
      buildNote({ companyId: "other-company" }),
    );

    await expect(
      confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID),
    ).rejects.toBeInstanceOf(ReceivingNoteCompanyMismatchError);
  });

  it("존재하지 않는 입고서: 에러", async () => {
    mockPrisma.receivingNote.findUnique.mockResolvedValue(null);

    await expect(
      confirmReceivingNote(COMPANY_ID, NOTE_ID, ACTOR_ID),
    ).rejects.toBeInstanceOf(ReceivingNoteNotFoundError);
  });
});
