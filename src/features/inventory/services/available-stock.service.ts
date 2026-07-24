/**
 * 파일: src/features/inventory/services/available-stock.service.ts
 * 목적: P16 정본 공식 aggregate-level 가용재고 조회.
 *       (materialMasterId, locationId, productionLineId, lineupId, useDate) 5축 매칭.
 * 근거: PROGRESS.md L534 P16 원문, 감사서 §10 (2026-07-23 신설, 2026-07-24 D-R6-f α 정정).
 * 사용처: R6-B P11 Pre-flight 통합 (confirm-consumption.service.ts:156, 후속 페이즈).
 *
 * P16 공식:
 *   available = max(0, reservedSameAxis + freeStock - reservedOtherDate - reservedOtherAxis)
 *
 * 예약 4요소 (§9-3 P16 정정, 다음 모두 충족):
 *   - InventoryReservation.releasedAt IS NULL (활성)
 *   - InventoryReservation.useDate = input.useDate (대상 소비일)
 *   - InventoryReservation.referenceType = "MATERIAL_REQUIREMENT"
 *   - 참조된 MaterialRequirement 의 (locationId, productionLineId, lineupId) 일치
 *
 * STOCK_KEEPING / SUBSIDIARY / purchaseKind=NULL 취급 (D-R6-f α, 2026-07-24):
 *   - isReservationEligibleLot=false → 예약 대상 아님.
 *   - freeStock 에 remainingQty 그대로 자연 합산 (P16 두 번째 항 "기존 재고: 예약 미걸림 remainingQty").
 *   - 별도 breakdown 필드 없음.
 *
 * P4 (Location 경계, §9-11):
 *   - Lot 조회 시 locationId 강제 필터. 다른 Location 의 lot 합산 금지.
 *
 * 트랜잭션 격리 (§10-7):
 *   - 조회 전용. Serializable 강제 안 함.
 *   - 호출자 트랜잭션 (예: R6-B P11 Pre-flight Serializable) 에 tx 파라미터로 합류 가능.
 *
 * 성능 (§10-6):
 *   - InventoryReservation (referenceType, referenceId) 복합 인덱스 활용
 *     (R6-Pre-2 마이그레이션 `20260724015728_s4_3_c_r6_pre_2_add_inv_reservation_reference_idx`).
 */

import type { Prisma } from "@prisma/client";

import { isReservationEligibleLot } from "@/features/inventory/lib/reservation-eligibility";

export interface GetAvailableStockInput {
  companyId: string;
  materialMasterId: string;
  locationId: string;
  productionLineId: string;
  lineupId: string;
  useDate: Date;
}

export interface GetAvailableStockBreakdown {
  /** 같은 (locationId, productionLineId, lineupId, useDate) 축의 MR 참조 활성 예약 합 */
  reservedSameAxis: number;
  /** eligible lot 잔량 - 활성 예약 합 (음수 clamp) + non-eligible lot 잔량 */
  freeStock: number;
  /** 같은 자재/축이지만 다른 useDate 활성 예약 합 */
  reservedOtherDate: number;
  /** 같은 자재이지만 다른 축(location/productionLine/lineup) 활성 예약 합 */
  reservedOtherAxis: number;
}

export interface GetAvailableStockResult {
  available: number;
  breakdown: GetAvailableStockBreakdown;
}

/**
 * useDate 를 YYYY-MM-DD 문자열로 정규화 (Prisma Date 컬럼 비교용).
 * schema.prisma 상 useDate 는 @db.Date 이므로 시각 정보는 무시.
 */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getAvailableStock(
  tx: Prisma.TransactionClient,
  input: GetAvailableStockInput,
): Promise<GetAvailableStockResult> {
  // ─────────────────────────────────────────
  // (1) Lot 조회 → freeStock 산출
  //     - Location 경계 강제 (P4, §9-11): locationId 필터.
  //     - eligible lot: remainingQty - 활성 예약 합 (음수 clamp).
  //     - non-eligible lot (SK/SUBSIDIARY/NULL): remainingQty 그대로 (예약 대상 아님, §10-5).
  // ─────────────────────────────────────────
  const lots = await tx.inventoryLot.findMany({
    where: {
      companyId: input.companyId,
      materialMasterId: input.materialMasterId,
      locationId: input.locationId,
      remainingQty: { gt: 0 },
    },
    select: {
      id: true,
      remainingQty: true,
      purchaseKind: true,
      itemType: true,
    },
  });

  let freeStock = 0;

  for (const lot of lots) {
    if (!isReservationEligibleLot(lot)) {
      // §10-5: non-eligible lot 은 예약 대상 아님 → remainingQty 그대로 freeStock 합산.
      freeStock += lot.remainingQty;
      continue;
    }

    const activeSum = await tx.inventoryReservation.aggregate({
      where: {
        inventoryLotId: lot.id,
        releasedAt: null,
      },
      _sum: { quantity: true },
    });
    const reserved = activeSum._sum.quantity ?? 0;
    const lotFree = lot.remainingQty - reserved;
    freeStock += lotFree > 0 ? lotFree : 0;
  }

  // ─────────────────────────────────────────
  // (2) 활성 예약 전체 조회 (자재 축, MR 참조만)
  //     - referenceType 필터로 (referenceType, referenceId) 인덱스 활용 (§10-6).
  //     - companyId + materialMasterId 로 자재 축 좁힘.
  // ─────────────────────────────────────────
  const reservations = await tx.inventoryReservation.findMany({
    where: {
      companyId: input.companyId,
      materialMasterId: input.materialMasterId,
      referenceType: "MATERIAL_REQUIREMENT",
      releasedAt: null,
    },
    select: {
      id: true,
      quantity: true,
      useDate: true,
      referenceId: true,
    },
  });

  if (reservations.length === 0) {
    // 예약 없음 → available = freeStock (음수 clamp 불필요).
    return {
      available: freeStock,
      breakdown: {
        reservedSameAxis: 0,
        freeStock,
        reservedOtherDate: 0,
        reservedOtherAxis: 0,
      },
    };
  }

  // ─────────────────────────────────────────
  // (3) MR 조회 (referenceId → MR.id) → 축 정보 확보
  //     - deletedAt=null 활성 MR 만.
  //     - §10-6 join 전략.
  // ─────────────────────────────────────────
  const mrIds = Array.from(new Set(reservations.map((r) => r.referenceId)));
  const mrs = await tx.materialRequirement.findMany({
    where: {
      id: { in: mrIds },
      deletedAt: null,
    },
    select: {
      id: true,
      locationId: true,
      productionLineId: true,
      lineupId: true,
    },
  });
  const mrById = new Map(mrs.map((mr) => [mr.id, mr]));

  // ─────────────────────────────────────────
  // (4) 예약 분류: sameAxis / otherDate / otherAxis
  //     - useDate 축 비교 시 시각 무시 (Prisma @db.Date, YYYY-MM-DD 문자열 정규화).
  // ─────────────────────────────────────────
  const targetDateKey = toDateKey(input.useDate);

  let reservedSameAxis = 0;
  let reservedOtherDate = 0;
  let reservedOtherAxis = 0;

  for (const r of reservations) {
    const mr = mrById.get(r.referenceId);
    if (!mr) {
      // MR soft-deleted 이면 사문화된 예약 → 분류 대상 아님 (역방향 전이 후 잔재).
      // R5-R1-B revert-guard 가 정상 흐름에서 처리하나, 방어적으로 skip.
      continue;
    }

    const dateMatch = toDateKey(r.useDate) === targetDateKey;
    const axisMatch =
      mr.locationId === input.locationId &&
      mr.productionLineId === input.productionLineId &&
      mr.lineupId === input.lineupId;

    if (dateMatch && axisMatch) {
      reservedSameAxis += r.quantity;
    } else if (!dateMatch) {
      reservedOtherDate += r.quantity;
    } else {
      // dateMatch && !axisMatch
      reservedOtherAxis += r.quantity;
    }
  }

  // ─────────────────────────────────────────
  // (5) 최종 available 계산 (P16 공식, 음수 clamp)
  // ─────────────────────────────────────────
  const raw = reservedSameAxis + freeStock - reservedOtherDate - reservedOtherAxis;
  const available = raw > 0 ? raw : 0;

  return {
    available,
    breakdown: {
      reservedSameAxis,
      freeStock,
      reservedOtherDate,
      reservedOtherAxis,
    },
  };
}
