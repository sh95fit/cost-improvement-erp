/**
 * ════════════════════════════════════════
 * Sprint 4 Phase S4-3-d — Consumption 확정 서비스 전용 에러
 * ════════════════════════════════════════
 * message 는 handleActionError 매핑을 위한 코드 문자열 (또는 "코드:상세" 접두사 형태).
 * 상세 페이로드는 프로퍼티로 보존하여 서버 로그·향후 확장에 활용.
 *
 * 갱신 이력:
 * - S4-3-c-4-3 (2026-07-20): InvalidLayerBItemError 에 A/B 공통 검증 코드 추가
 *   (QUANTITY_NEGATIVE, QUANTITY_OVERFLOW, DISPOSAL_REASON_REQUIRED, DISPOSAL_NOTE_REQUIRED)
 *   → 클래스명은 하위 호환성을 위해 유지. 실제로는 Layer A/B 공통 항목 검증에 사용됨.
 */

export class StaleDraftError extends Error {
  constructor(
    public readonly diffs: Array<{
      itemType: "MATERIAL" | "SUBSIDIARY";
      itemId: string;
      itemName: string;
      clientQty: number;
      serverQty: number;
    }>,
  ) {
    super("STALE_DRAFT");
    this.name = "StaleDraftError";
  }
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly shortages: Array<{
      itemType: "MATERIAL" | "SUBSIDIARY";
      itemId: string;
      itemName: string;
      unit: string;
      required: number;
      available: number;
    }>,
  ) {
    super(formatShortagesMessage(shortages));
    this.name = "InsufficientStockError";
  }
}

export class InvalidLayerBItemError extends Error {
  constructor(
    public readonly reason:
      | "ITEM_NOT_FOUND"
      | "ITEM_INACTIVE"
      | "QUANTITY_NON_POSITIVE"
      | "UNIT_MISMATCH"
      // ── S4-3-c-4-3 신규 (Layer A/B 공통 검증) ──
      | "QUANTITY_NEGATIVE"          // finalUsedQty < 0 or remainingToStock < 0 (P11)
      | "QUANTITY_OVERFLOW"          // finalUsedQty + remainingToStock > totalAvailable (P14)
      | "DISPOSAL_REASON_REQUIRED"   // disposalQty > 0 인데 disposalReason 미지정 (P14)
      | "DISPOSAL_NOTE_REQUIRED",    // disposalReason=OTHER 인데 disposalNote 미지정 (P14)
    public readonly itemId: string,
  ) {
    super(`INVALID_LAYER_B_ITEM:${reason}`);
    this.name = "InvalidLayerBItemError";
  }
}

// ────────────────────────────────────────
function formatShortagesMessage(
  shortages: Array<{
    itemName: string;
    unit: string;
    required: number;
    available: number;
  }>,
): string {
  const preview = shortages.slice(0, 5).map((s) => {
    const short = s.required - s.available;
    return `${s.itemName}(${short.toFixed(3)} ${s.unit} 부족)`;
  });
  const rest = shortages.length > 5 ? ` 외 ${shortages.length - 5}건` : "";
  return `INSUFFICIENT_STOCK:재고 부족 - ${preview.join(", ")}${rest}`;
}
