import type { DiscrepancyType } from "@prisma/client";

/**
 * 불일치 스냅샷의 안정 키 생성 (D30 C-3-d3).
 *
 * UI(preview)와 서비스(confirm)에서 동일 규칙으로 생성되어야 하므로
 * 단일 유틸로 관리한다.
 *
 * 규칙: `${type}:${purchaseOrderItemId ?? "none"}:${receivingNoteItemId ?? "none"}`
 *
 * 사례별 매핑:
 *  - QUANTITY_SHORT / QUANTITY_OVER : 둘 다 있음 → 예) "QUANTITY_SHORT:po_item_A:rn_item_1"
 *  - UNIT_PRICE_DIFF                : 둘 다 있음 → 예) "UNIT_PRICE_DIFF:po_item_A:rn_item_1"
 *  - ITEM_MISSING (발주에 없음)      : poItemId=null, rItemId 있음
 *      예) "ITEM_MISSING:none:rn_item_9"
 *  - ITEM_MISSING (입고에 없음)      : poItemId 있음, rItemId=null
 *      예) "ITEM_MISSING:po_item_B:none"
 */
export function buildDiscrepancyKey(
  type: DiscrepancyType,
  purchaseOrderItemId: string | null | undefined,
  receivingNoteItemId: string | null | undefined,
): string {
  return `${type}:${purchaseOrderItemId ?? "none"}:${receivingNoteItemId ?? "none"}`;
}
