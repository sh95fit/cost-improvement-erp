import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockPrisma } from "./mocks/prisma";
import {
  getAvailableQty,
  createReservation,
  releaseReservation,
  detectStaleReservations,
  LotNotFoundError,
  LotNotEligibleForReservationError,
  InsufficientAvailableQtyError,
  ReservationNotFoundError,
  ReservationAlreadyReleasedError,
} from "@/features/inventory/services/reservation.service";

// withTransaction은 mockPrisma를 콜백에 즉시 전달
vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)),
}));

const COMPANY_ID = "company-1";
const LOT_ID = "lot-1";
const MM_ID = "mm-1";
const RES_ID = "res-1";

function baseLot() {
  return {
    id: LOT_ID,
    companyId: COMPANY_ID,
    remainingQty: 100,
    purchaseKind: "WIZARD",
    itemType: "MATERIAL",
    materialMasterId: MM_ID,
  };
}

function baseCreateInput() {
  return {
    companyId: COMPANY_ID,
    inventoryLotId: LOT_ID,
    materialMasterId: MM_ID,
    quantity: 10,
    useDate: new Date("2026-07-15"),
    referenceType: "MEAL_PLAN_SLOT",
    referenceId: "slot-1",
  };
}

describe("getAvailableQty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상: remainingQty - 활성 예약 합계 반환", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(baseLot());
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 30 },
    });

    const available = await getAvailableQty(LOT_ID);
    expect(available).toBe(70);
  });

  it("활성 예약 없음(합계 null): remainingQty 그대로", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(baseLot());
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });

    const available = await getAvailableQty(LOT_ID);
    expect(available).toBe(100);
  });

  it("음수 방지: 예약 합계가 remainingQty 초과 시 0 반환", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(baseLot());
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 150 },
    });

    const available = await getAvailableQty(LOT_ID);
    expect(available).toBe(0);
  });

  it("STOCK_KEEPING lot: aggregate 호출 없이 remainingQty 반환", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      purchaseKind: "STOCK_KEEPING",
    });

    const available = await getAvailableQty(LOT_ID);
    expect(available).toBe(100);
    expect(mockPrisma.inventoryReservation.aggregate).not.toHaveBeenCalled();
  });

  it("SUBSIDIARY lot: remainingQty 그대로 반환 (예약 대상 아님)", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      itemType: "SUBSIDIARY",
      materialMasterId: null,
    });

    const available = await getAvailableQty(LOT_ID);
    expect(available).toBe(100);
    expect(mockPrisma.inventoryReservation.aggregate).not.toHaveBeenCalled();
  });

  it("purchaseKind=null lot: remainingQty 그대로", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      purchaseKind: null,
    });

    const available = await getAvailableQty(LOT_ID);
    expect(available).toBe(100);
  });

  it("존재하지 않는 lot: LotNotFoundError", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(null);

    await expect(getAvailableQty(LOT_ID)).rejects.toBeInstanceOf(LotNotFoundError);
  });
});

describe("createReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.inventoryReservation.create.mockResolvedValue({ id: RES_ID });
  });

  it("정상: 가용 수량 충분 시 예약 생성", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(baseLot());
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 20 },
    });

    const result = await createReservation(baseCreateInput());

    expect(mockPrisma.inventoryReservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: COMPANY_ID,
        inventoryLotId: LOT_ID,
        materialMasterId: MM_ID,
        quantity: 10,
        referenceType: "MEAL_PLAN_SLOT",
        referenceId: "slot-1",
      }),
    });
    expect(result.id).toBe(RES_ID);
  });

  it("가용 수량 부족: InsufficientAvailableQtyError", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(baseLot());
    mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 95 },
    }); // 가용 = 5, 요청 10

    await expect(createReservation(baseCreateInput())).rejects.toBeInstanceOf(
      InsufficientAvailableQtyError,
    );
    expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it("존재하지 않는 lot: LotNotFoundError", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue(null);

    await expect(createReservation(baseCreateInput())).rejects.toBeInstanceOf(
      LotNotFoundError,
    );
  });

  it("companyId 불일치: 에러", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      companyId: "other-company",
    });

    await expect(createReservation(baseCreateInput())).rejects.toThrow(
      /COMPANY_MISMATCH/,
    );
  });

  it("STOCK_KEEPING lot: LotNotEligibleForReservationError", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      purchaseKind: "STOCK_KEEPING",
    });

    await expect(createReservation(baseCreateInput())).rejects.toBeInstanceOf(
      LotNotEligibleForReservationError,
    );
  });

  it("SUBSIDIARY lot: LotNotEligibleForReservationError", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      itemType: "SUBSIDIARY",
      materialMasterId: null,
    });

    await expect(createReservation(baseCreateInput())).rejects.toBeInstanceOf(
      LotNotEligibleForReservationError,
    );
  });

  it("purchaseKind=null lot: LotNotEligibleForReservationError", async () => {
    mockPrisma.inventoryLot.findUnique.mockResolvedValue({
      ...baseLot(),
      purchaseKind: null,
    });

    await expect(createReservation(baseCreateInput())).rejects.toBeInstanceOf(
      LotNotEligibleForReservationError,
    );
  });
});

describe("releaseReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상: releasedAt=null 예약 해제 (CONSUMED)", async () => {
    mockPrisma.inventoryReservation.findUnique.mockResolvedValue({
      id: RES_ID,
      releasedAt: null,
    });
    mockPrisma.inventoryReservation.update.mockResolvedValue({
      id: RES_ID,
      releasedAt: new Date(),
      releaseReason: "CONSUMED",
    });

    await releaseReservation({ reservationId: RES_ID, reason: "CONSUMED" });

    expect(mockPrisma.inventoryReservation.update).toHaveBeenCalledWith({
      where: { id: RES_ID },
      data: expect.objectContaining({
        releasedAt: expect.any(Date),
        releaseReason: "CONSUMED",
      }),
    });
  });

  it("이미 해제된 예약: ReservationAlreadyReleasedError", async () => {
    mockPrisma.inventoryReservation.findUnique.mockResolvedValue({
      id: RES_ID,
      releasedAt: new Date(),
    });

    await expect(
      releaseReservation({ reservationId: RES_ID, reason: "MANUAL_CANCEL" }),
    ).rejects.toBeInstanceOf(ReservationAlreadyReleasedError);
    expect(mockPrisma.inventoryReservation.update).not.toHaveBeenCalled();
  });

  it("존재하지 않는 예약: ReservationNotFoundError", async () => {
    mockPrisma.inventoryReservation.findUnique.mockResolvedValue(null);

    await expect(
      releaseReservation({ reservationId: RES_ID, reason: "CONSUMED" }),
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });
});

describe("detectStaleReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useDate < referenceDate 이고 releasedAt=null 예약 목록 반환", async () => {
    const stale = [
      { id: "res-old-1", useDate: new Date("2026-07-01"), releasedAt: null },
      { id: "res-old-2", useDate: new Date("2026-07-05"), releasedAt: null },
    ];
    mockPrisma.inventoryReservation.findMany.mockResolvedValue(stale);

    const referenceDate = new Date("2026-07-10");
    const result = await detectStaleReservations(COMPANY_ID, referenceDate);

    expect(mockPrisma.inventoryReservation.findMany).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY_ID,
        releasedAt: null,
        useDate: { lt: referenceDate },
      },
      orderBy: [{ useDate: "asc" }, { reservedAt: "asc" }],
    });
    expect(result).toHaveLength(2);
  });

  it("referenceDate 미지정 시 현재 시각 기준으로 조회", async () => {
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([]);

    await detectStaleReservations(COMPANY_ID);

    expect(mockPrisma.inventoryReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          releasedAt: null,
          useDate: { lt: expect.any(Date) },
        }),
      }),
    );
  });

  it("자동 해제하지 않음 (findMany만 호출, update 없음)", async () => {
    mockPrisma.inventoryReservation.findMany.mockResolvedValue([
      { id: "res-old-1", useDate: new Date("2026-07-01"), releasedAt: null },
    ]);

    await detectStaleReservations(COMPANY_ID);

    expect(mockPrisma.inventoryReservation.update).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryReservation.updateMany).not.toHaveBeenCalled();
  });
});
