import type { InventoryLot } from "@prisma/client";

/**
 * 예약 가능한 lot 판별 헬퍼.
 *
 * 규약 (Phase S4-0-c 확정, P13 예약 도메인 헌법):
 *   - purchaseKind = WIZARD, MANUAL_JIT  → 예약 대상 O (JIT 흐름)
 *   - purchaseKind = STOCK_KEEPING       → 예약 대상 X (재고 상시 보유, FIFO 소비만)
 *   - purchaseKind = NULL                → 예약 대상 X (수동 조정/시드 데이터, 정책 미확정)
 *   - itemType     = SUBSIDIARY          → 예약 대상 X (부자재는 메뉴 계획 시 사용량만 집계)
 */
export function isReservationEligibleLot(
  lot: Pick<InventoryLot, "purchaseKind" | "itemType">
): boolean {
  if (lot.itemType === "SUBSIDIARY") return false;
  if (lot.purchaseKind === null) return false;
  if (lot.purchaseKind === "STOCK_KEEPING") return false;
  return true;
}
