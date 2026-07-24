import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockPrisma } from "./mocks/prisma";
import { getAvailableStock } from "@/features/inventory/services/available-stock.service";

const COMPANY_ID = "company-1";
const MAT_X = "mat-X";
const LOC_A = "loc-A";
const LINE_1 = "line-1";
const LINEUP_1 = "lineup-1";
const USE_DATE = new Date("2026-08-01");

/**
 * 공통 입력 팩토리
 */
function baseInput(overrides: Partial<Parameters<typeof getAvailableStock>[1]> = {}) {
  return {
    companyId: COMPANY_ID,
    materialMasterId: MAT_X,
    locationId: LOC_A,
    productionLineId: LINE_1,
    lineupId: LINEUP_1,
    useDate: USE_DATE,
    ...overrides,
  };
}

describe("getAvailableStock (S4-3-c R6-A, P16 정본)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // (a) 순수 freeStock — 예약 없음
  // ─────────────────────────────────────────
  it("(a) 예약 없음: available = freeStock (breakdown 3필드 0)", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    expect(result.available).toBe(100);
    expect(result.breakdown.freeStock).toBe(100);
    expect(result.breakdown.reservedSameAxis).toBe(0);
    expect(result.breakdown.reservedOtherDate).toBe(0);
    expect(result.breakdown.reservedOtherAxis).toBe(0);
    // 예약 조회 결과 0건 → MR findMany 호출 없음
    expect(mockPrisma.materialRequirement.findMany).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────
  // (b) 같은 축 예약 → reservedSameAxis + freeStock
  // ─────────────────────────────────────────
  it("(b) 같은 축 예약: available = reservedSameAxis + freeStock", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    // lot-1 활성 예약 40 → freeStock = 60
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 40 } });
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        quantity: 40,
        useDate: USE_DATE,
        referenceId: "mr-1",
      },
    ]);
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        id: "mr-1",
        locationId: LOC_A,
        productionLineId: LINE_1,
        lineupId: LINEUP_1,
      },
    ]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    expect(result.breakdown.freeStock).toBe(60);
    expect(result.breakdown.reservedSameAxis).toBe(40);
    expect(result.breakdown.reservedOtherDate).toBe(0);
    expect(result.breakdown.reservedOtherAxis).toBe(0);
    expect(result.available).toBe(100);
  });

  // ─────────────────────────────────────────
  // (c) 다른 useDate → reservedOtherDate 차감
  // ─────────────────────────────────────────
  it("(c) 다른 useDate 예약: reservedOtherDate 차감", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 30 } });
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: "res-other-date",
        quantity: 30,
        useDate: new Date("2026-08-05"), // ≠ USE_DATE
        referenceId: "mr-1",
      },
    ]);
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        id: "mr-1",
        locationId: LOC_A,
        productionLineId: LINE_1,
        lineupId: LINEUP_1,
      },
    ]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    expect(result.breakdown.freeStock).toBe(70);
    expect(result.breakdown.reservedSameAxis).toBe(0);
    expect(result.breakdown.reservedOtherDate).toBe(30);
    expect(result.breakdown.reservedOtherAxis).toBe(0);
    // available = max(0, 0 + 70 - 30 - 0) = 40
    expect(result.available).toBe(40);
  });

  // ─────────────────────────────────────────
  // (d) 다른 axis (다른 lineup) → reservedOtherAxis 차감
  // ─────────────────────────────────────────
  it("(d) 다른 lineup 예약: reservedOtherAxis 차감", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 20 } });
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: "res-other-axis",
        quantity: 20,
        useDate: USE_DATE,
        referenceId: "mr-other",
      },
    ]);
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        id: "mr-other",
        locationId: LOC_A,
        productionLineId: LINE_1,
        lineupId: "lineup-DIFFERENT",
      },
    ]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    expect(result.breakdown.freeStock).toBe(80);
    expect(result.breakdown.reservedSameAxis).toBe(0);
    expect(result.breakdown.reservedOtherDate).toBe(0);
    expect(result.breakdown.reservedOtherAxis).toBe(20);
    // available = max(0, 0 + 80 - 0 - 20) = 60
    expect(result.available).toBe(60);
  });

  // ─────────────────────────────────────────
  // (e) STOCK_KEEPING lot → freeStock 자연 합산 (aggregate 호출 없음)
  // ─────────────────────────────────────────
  it("(e) STOCK_KEEPING lot: 예약 대상 아님, freeStock 에 자연 합산 (D-R6-f α)", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-jit", remainingQty: 50, purchaseKind: "WIZARD", itemType: "MATERIAL" },
      { id: "lot-sk", remainingQty: 200, purchaseKind: "STOCK_KEEPING", itemType: "MATERIAL" },
    ]);
    // eligible lot(lot-jit)에 대해서만 aggregate 호출됨. SK lot은 aggregate 호출 skip.
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    // freeStock = 50 (eligible) + 200 (SK 자연 합산) = 250
    expect(result.breakdown.freeStock).toBe(250);
    expect(result.available).toBe(250);
    // aggregate 는 eligible lot 1건에 대해서만 호출됨 (SK lot skip)
    expect(mockPrisma.inventoryReservation.aggregate).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────
  // (f) 음수 clamp
  // ─────────────────────────────────────────
  it("(f) 예약 초과 시 음수 clamp: available = 0", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 50, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    // otherDate 100 + otherAxis 100 = 200. sameAxis 0 + freeStock 50 - 200 = -150 → clamp 0.
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: "res-other-date",
        quantity: 100,
        useDate: new Date("2026-08-05"),
        referenceId: "mr-other-date",
      },
      {
        id: "res-other-axis",
        quantity: 100,
        useDate: USE_DATE,
        referenceId: "mr-other-axis",
      },
    ]);
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      {
        id: "mr-other-date",
        locationId: LOC_A,
        productionLineId: LINE_1,
        lineupId: LINEUP_1,
      },
      {
        id: "mr-other-axis",
        locationId: LOC_A,
        productionLineId: LINE_1,
        lineupId: "lineup-DIFFERENT",
      },
    ]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    expect(result.breakdown.freeStock).toBe(50);
    expect(result.breakdown.reservedOtherDate).toBe(100);
    expect(result.breakdown.reservedOtherAxis).toBe(100);
    expect(result.available).toBe(0);
  });

  // ─────────────────────────────────────────
  // (g) MR 미존재 (soft-deleted 잔재 예약)
  // ─────────────────────────────────────────
  it("(g) MR soft-deleted 잔재 예약: 분류 skip, freeStock 만", async () => {
    mockPrisma.inventoryLot.findMany.mockResolvedValue([
      { id: "lot-1", remainingQty: 100, purchaseKind: "WIZARD", itemType: "MATERIAL" },
    ]);
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 30 } });
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      {
        id: "res-orphan",
        quantity: 30,
        useDate: USE_DATE,
        referenceId: "mr-deleted",
      },
    ]);
    // MR soft-deleted → findMany 결과 없음
    mockPrisma.materialRequirement.findMany.mockResolvedValue([]);

    const result = await getAvailableStock(mockPrisma as never, baseInput());

    // MR 없음 → 해당 예약 skip. sameAxis/otherDate/otherAxis 전부 0.
    expect(result.breakdown.freeStock).toBe(70);
    expect(result.breakdown.reservedSameAxis).toBe(0);
    expect(result.breakdown.reservedOtherDate).toBe(0);
    expect(result.breakdown.reservedOtherAxis).toBe(0);
    expect(result.available).toBe(70);
  });
});
