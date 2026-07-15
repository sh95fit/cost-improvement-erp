/**
 * Sprint 4 Phase S4-3-d — Consumption 확정 서비스 전용 에러 계열.
 * ActionResult.error.message 로 노출되는 사용자 메시지와, code 기반 클라이언트 분기용 code 값을 함께 정의.
 */

export class StaleDraftError extends Error {
    readonly code = "STALE_DRAFT";
    constructor(
      public readonly diffs: Array<{
        itemType: "MATERIAL" | "SUBSIDIARY";
        itemId: string;
        itemName: string;
        clientQty: number;
        serverQty: number;
      }>,
    ) {
      super(
        `Layer A 재계산 결과가 클라이언트 상태와 다릅니다 (${diffs.length}건). 페이지를 새로고침해 주세요.`,
      );
      this.name = "StaleDraftError";
    }
  }
  
  export class InsufficientStockError extends Error {
    readonly code = "INSUFFICIENT_STOCK";
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
      super(`재고 부족 항목 ${shortages.length}건`);
      this.name = "InsufficientStockError";
    }
  }
  
  export class InvalidLayerBItemError extends Error {
    readonly code = "INVALID_LAYER_B_ITEM";
    constructor(
      public readonly reason:
        | "ITEM_NOT_FOUND"
        | "ITEM_INACTIVE"
        | "QUANTITY_NON_POSITIVE"
        | "UNIT_MISMATCH",
      public readonly itemId: string,
      message?: string,
    ) {
      super(message ?? `유효하지 않은 Layer B 항목 (${reason})`);
      this.name = "InvalidLayerBItemError";
    }
  }
  