import { prisma } from "@/lib/prisma";
import type { Prisma, InventoryReservation } from "@prisma/client";
import { withTransaction } from "@/lib/auth/transaction";
import { isReservationEligibleLot } from "../lib/reservation-eligibility";

type Tx = Prisma.TransactionClient;

// ============================================================
// Error constants & classes
// ============================================================

export const RESERVATION_ERRORS = {
  LOT_NOT_FOUND: "LOT_NOT_FOUND",
  LOT_NOT_ELIGIBLE: "LOT_NOT_ELIGIBLE",
  INSUFFICIENT_AVAILABLE_QTY: "INSUFFICIENT_AVAILABLE_QTY",
  RESERVATION_NOT_FOUND: "RESERVATION_NOT_FOUND",
  RESERVATION_ALREADY_RELEASED: "RESERVATION_ALREADY_RELEASED",
  COMPANY_MISMATCH: "COMPANY_MISMATCH",
} as const;

export class LotNotFoundError extends Error {
  constructor(lotId: string) {
    super(`${RESERVATION_ERRORS.LOT_NOT_FOUND}: ${lotId}`);
    this.name = "LotNotFoundError";
  }
}

export class LotNotEligibleForReservationError extends Error {
  constructor(lotId: string, reason: string) {
    super(`${RESERVATION_ERRORS.LOT_NOT_ELIGIBLE}: ${lotId} (${reason})`);
    this.name = "LotNotEligibleForReservationError";
  }
}

export class InsufficientAvailableQtyError extends Error {
  constructor(lotId: string, requested: number, available: number) {
    super(
      `${RESERVATION_ERRORS.INSUFFICIENT_AVAILABLE_QTY}: lot=${lotId}, requested=${requested}, available=${available}`
    );
    this.name = "InsufficientAvailableQtyError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`${RESERVATION_ERRORS.RESERVATION_NOT_FOUND}: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationAlreadyReleasedError extends Error {
  constructor(reservationId: string) {
    super(`${RESERVATION_ERRORS.RESERVATION_ALREADY_RELEASED}: ${reservationId}`);
    this.name = "ReservationAlreadyReleasedError";
  }
}

// ============================================================
// Private helpers
// ============================================================

/**
 * lot의 활성 예약 수량 합계를 반환.
 * 활성 = releasedAt IS NULL (아직 해제되지 않은 예약).
 */
async function sumActiveReservationsForLot(
  lotId: string,
  tx: Prisma.TransactionClient | typeof prisma
): Promise<number> {
  const result = await tx.inventoryReservation.aggregate({
    where: { inventoryLotId: lotId, releasedAt: null },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

// ============================================================
// Service functions
// ============================================================

/**
 * lot의 가용 수량 = remainingQty - Σ(활성 예약 quantity).
 * 예약 대상이 아닌 lot(SK, 부자재, purchaseKind=NULL)은 remainingQty를 그대로 반환.
 */
export async function getAvailableQty(
  lotId: string,
  existingTx?: Prisma.TransactionClient
): Promise<number> {
  const client = existingTx ?? prisma;

  const lot = await client.inventoryLot.findUnique({
    where: { id: lotId },
    select: { id: true, remainingQty: true, purchaseKind: true, itemType: true },
  });
  if (!lot) throw new LotNotFoundError(lotId);

  if (!isReservationEligibleLot(lot)) {
    return lot.remainingQty;
  }

  const reserved = await sumActiveReservationsForLot(lotId, client);
  const available = lot.remainingQty - reserved;
  return available < 0 ? 0 : available;
}

// ------------------------------------------------------------
// 예약 생성
// ------------------------------------------------------------

export interface CreateReservationInput {
  companyId: string;
  inventoryLotId: string;
  materialMasterId: string;
  quantity: number;
  useDate: Date;
  referenceType: string; // e.g. "MEAL_PLAN_SLOT", "MANUAL"
  referenceId: string;
}

export async function createReservation(
  input: CreateReservationInput,
  existingTx?: Prisma.TransactionClient
): Promise<InventoryReservation> {
  return withTransaction(
    async (tx: Tx) => {
      const lot = await tx.inventoryLot.findUnique({
        where: { id: input.inventoryLotId },
        select: {
          id: true,
          companyId: true,
          remainingQty: true,
          purchaseKind: true,
          itemType: true,
          materialMasterId: true,
        },
      });
      if (!lot) throw new LotNotFoundError(input.inventoryLotId);

      if (lot.companyId !== input.companyId) {
        throw new Error(`${RESERVATION_ERRORS.COMPANY_MISMATCH}: lot=${lot.id}`);
      }

      if (!isReservationEligibleLot(lot)) {
        throw new LotNotEligibleForReservationError(
          lot.id,
          `itemType=${lot.itemType}, purchaseKind=${lot.purchaseKind}`
        );
      }

      const reserved = await sumActiveReservationsForLot(lot.id, tx);
      const available = lot.remainingQty - reserved;
      if (input.quantity > available) {
        throw new InsufficientAvailableQtyError(lot.id, input.quantity, available);
      }

      return tx.inventoryReservation.create({
        data: {
          companyId: input.companyId,
          inventoryLotId: input.inventoryLotId,
          materialMasterId: input.materialMasterId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          quantity: input.quantity,
          useDate: input.useDate,
        },
      });
    },
    { existingTx }
  );
}

// ------------------------------------------------------------
// 예약 해제 (CONSUMED / MANUAL_CANCEL / AUTO_EXPIRED)
// ------------------------------------------------------------

export interface ReleaseReservationInput {
  reservationId: string;
  reason: "CONSUMED" | "MANUAL_CANCEL" | "AUTO_EXPIRED";
}

export async function releaseReservation(
  input: ReleaseReservationInput,
  existingTx?: Prisma.TransactionClient
): Promise<InventoryReservation> {
  return withTransaction(
    async (tx: Tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: input.reservationId },
        select: { id: true, releasedAt: true },
      });
      if (!reservation) throw new ReservationNotFoundError(input.reservationId);
      if (reservation.releasedAt !== null) {
        throw new ReservationAlreadyReleasedError(input.reservationId);
      }

      return tx.inventoryReservation.update({
        where: { id: input.reservationId },
        data: {
          releasedAt: new Date(),
          releaseReason: input.reason,
        },
      });
    },
    { existingTx }
  );
}

// ------------------------------------------------------------
// Stale reservation 감지 (알림 트리거용, 자동 해제 없음)
// ------------------------------------------------------------

/**
 * 출고일이 지났으나 아직 사용처리(해제)되지 않은 예약 목록을 반환.
 *
 * 정책 (P13 예약 도메인):
 *   - 자동 EXPIRED 처리는 하지 않는다. 사용자에게 알림을 보내 사용처리를
 *     완료하도록 유도한다. 사용자가 명시적으로 취소하면 MANUAL_CANCEL,
 *     정책에 따라 자동 만료가 필요하면 별도 조치 후 AUTO_EXPIRED로 해제.
 *
 * 알림 시스템 연결은 후속 phase(S5 계열)에서 수행.
 */
export async function detectStaleReservations(
  companyId: string,
  referenceDate: Date = new Date(),
  existingTx?: Prisma.TransactionClient
): Promise<InventoryReservation[]> {
  const client = existingTx ?? prisma;
  return client.inventoryReservation.findMany({
    where: {
      companyId,
      releasedAt: null,
      useDate: { lt: referenceDate },
    },
    orderBy: [{ useDate: "asc" }, { reservedAt: "asc" }],
  });
}
