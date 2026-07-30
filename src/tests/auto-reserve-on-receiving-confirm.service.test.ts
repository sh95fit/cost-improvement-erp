import type { Prisma } from "@prisma/client";
import { describe, it, expect, beforeEach } from "vitest";

import { mockPrisma } from "./mocks/prisma";
import {
  autoReserveOnReceivingConfirm,
  ReceivingNoteNotFoundForReserveError,
} from "@/features/inventory/services/auto-reserve-on-receiving-confirm.service";

const COMPANY_ID = "company-1";
const ACTOR_ID = "user-1";
const NOTE_ID = "note-1";
const PLAN_DATE = new Date("2026-08-01T00:00:00.000Z");
const MAT_X = "mat-X";

const tx = mockPrisma as unknown as Prisma.TransactionClient;

function buildNoteWithItems(
  items: Array<{
    id: string;
    receivedQty: number;
    materialRequirementId: string | null;
  }>,
) {
  return {
    id: NOTE_ID,
    items: items.map((it) => ({
      id: it.id,
      receivedQty: it.receivedQty,
      purchaseOrderItem: {
        materialRequirementId: it.materialRequirementId,
      },
    })),
  };
}

describe("autoReserveOnReceivingConfirm (R14, §9-14)", () => {
  beforeEach(() => {
    // 기본: 모든 findFirst mock 초기화 (테스트별로 명시 세팅)
    mockPrisma.receivingNote.findFirst.mockReset();
    mockPrisma.materialRequirement.findFirst.mockReset();
    mockPrisma.inventoryLot.findFirst.mockReset();
    mockPrisma.inventoryReservation.create.mockReset();
    mockPrisma.inventoryReservation.create.mockResolvedValue({ id: "resv-1" });
  });

  it("ReceivingNote 미존재 시 ReceivingNoteNotFoundForReserveError throw", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(null);

    await expect(
      autoReserveOnReceivingConfirm(tx, {
        companyId: COMPANY_ID,
        receivingNoteId: NOTE_ID,
        actorUserId: ACTOR_ID,
      }),
    ).rejects.toBeInstanceOf(ReceivingNoteNotFoundForReserveError);

    expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("수동 발주(materialRequirementId=null) 항목은 skip", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 10, materialRequirementId: null },
      ]),
    );

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 0, skipped: 1 });
    expect(mockPrisma.materialRequirement.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("MR soft-delete 등 미조회 시 skip", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 10, materialRequirementId: "mr-1" },
      ]),
    );
    mockPrisma.materialRequirement.findFirst.mockResolvedValueOnce(null);

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 0, skipped: 1 });
    expect(mockPrisma.inventoryLot.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("Lot 미조회 시 skip", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 10, materialRequirementId: "mr-1" },
      ]),
    );
    mockPrisma.materialRequirement.findFirst.mockResolvedValueOnce({
      id: "mr-1",
      mealPlanGroup: { planDate: PLAN_DATE },
    });
    mockPrisma.inventoryLot.findFirst.mockResolvedValueOnce(null);

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 0, skipped: 1 });
    expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("부자재 Lot(materialMasterId=null) 은 skip (§10 D-R6-f α)", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 10, materialRequirementId: "mr-1" },
      ]),
    );
    mockPrisma.materialRequirement.findFirst.mockResolvedValueOnce({
      id: "mr-1",
      mealPlanGroup: { planDate: PLAN_DATE },
    });
    mockPrisma.inventoryLot.findFirst.mockResolvedValueOnce({
      id: "lot-1",
      itemType: "SUBSIDIARY",
      materialMasterId: null,
    });

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 0, skipped: 1 });
    expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("정상 경로: 위저드 발주 항목 → InventoryReservation 1건 생성", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 12.5, materialRequirementId: "mr-1" },
      ]),
    );
    mockPrisma.materialRequirement.findFirst.mockResolvedValueOnce({
      id: "mr-1",
      mealPlanGroup: { planDate: PLAN_DATE },
    });
    mockPrisma.inventoryLot.findFirst.mockResolvedValueOnce({
      id: "lot-1",
      itemType: "MATERIAL",
      materialMasterId: MAT_X,
    });

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 1, skipped: 0 });
    expect(mockPrisma.inventoryReservation.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.inventoryReservation.create).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY_ID,
        inventoryLotId: "lot-1",
        materialMasterId: MAT_X,
        referenceType: "MATERIAL_REQUIREMENT",
        referenceId: "mr-1",
        quantity: 12.5,
        useDate: PLAN_DATE,
      },
    });
  });

  it("동일 MR 대상 다중 ReceivingNoteItem → 독립적으로 누적 예약 (§0 원칙 2)", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 5, materialRequirementId: "mr-1" },
        { id: "ri-2", receivedQty: 7, materialRequirementId: "mr-1" },
      ]),
    );
    // 두 항목 모두 동일 MR 조회 → 두 번 resolve
    mockPrisma.materialRequirement.findFirst
      .mockResolvedValueOnce({
        id: "mr-1",
        mealPlanGroup: { planDate: PLAN_DATE },
      })
      .mockResolvedValueOnce({
        id: "mr-1",
        mealPlanGroup: { planDate: PLAN_DATE },
      });
    // 각각 별도 Lot
    mockPrisma.inventoryLot.findFirst
      .mockResolvedValueOnce({
        id: "lot-1",
        itemType: "MATERIAL",
        materialMasterId: MAT_X,
      })
      .mockResolvedValueOnce({
        id: "lot-2",
        itemType: "MATERIAL",
        materialMasterId: MAT_X,
      });

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 2, skipped: 0 });
    expect(mockPrisma.inventoryReservation.create).toHaveBeenCalledTimes(2);

    // 첫 예약: lot-1, qty=5
    expect(mockPrisma.inventoryReservation.create).toHaveBeenNthCalledWith(1, {
      data: {
        companyId: COMPANY_ID,
        inventoryLotId: "lot-1",
        materialMasterId: MAT_X,
        referenceType: "MATERIAL_REQUIREMENT",
        referenceId: "mr-1",
        quantity: 5,
        useDate: PLAN_DATE,
      },
    });
    // 두 번째 예약: lot-2, qty=7 (수량 상한 없음, 독립 누적)
    expect(mockPrisma.inventoryReservation.create).toHaveBeenNthCalledWith(2, {
      data: {
        companyId: COMPANY_ID,
        inventoryLotId: "lot-2",
        materialMasterId: MAT_X,
        referenceType: "MATERIAL_REQUIREMENT",
        referenceId: "mr-1",
        quantity: 7,
        useDate: PLAN_DATE,
      },
    });
  });

  it("혼합 케이스: 위저드+수동+부자재 → 각 경로별 카운트 정확", async () => {
    mockPrisma.receivingNote.findFirst.mockResolvedValueOnce(
      buildNoteWithItems([
        { id: "ri-1", receivedQty: 3, materialRequirementId: "mr-1" }, // 예약
        { id: "ri-2", receivedQty: 4, materialRequirementId: null },   // 수동 skip
        { id: "ri-3", receivedQty: 5, materialRequirementId: "mr-2" }, // 부자재 skip
      ]),
    );
    // ri-1 → MR + Lot 정상
    mockPrisma.materialRequirement.findFirst
      .mockResolvedValueOnce({
        id: "mr-1",
        mealPlanGroup: { planDate: PLAN_DATE },
      })
      // ri-3 → MR 조회는 성공하지만 Lot이 부자재
      .mockResolvedValueOnce({
        id: "mr-2",
        mealPlanGroup: { planDate: PLAN_DATE },
      });
    mockPrisma.inventoryLot.findFirst
      .mockResolvedValueOnce({
        id: "lot-1",
        itemType: "MATERIAL",
        materialMasterId: MAT_X,
      })
      .mockResolvedValueOnce({
        id: "lot-3",
        itemType: "SUBSIDIARY",
        materialMasterId: null,
      });

    const result = await autoReserveOnReceivingConfirm(tx, {
      companyId: COMPANY_ID,
      receivingNoteId: NOTE_ID,
      actorUserId: ACTOR_ID,
    });

    expect(result).toEqual({ reserved: 1, skipped: 2 });
    expect(tx.inventoryReservation.create).toHaveBeenCalledTimes(1);
  });
});
