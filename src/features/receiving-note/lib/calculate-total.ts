/**
 * 입고서/발주서 총액 계산 유틸 (D30 C-3-d).
 *
 * ReceivingNoteItem.unitPrice 및 receivedQty 는 Prisma 스키마상 Float.
 * 부동소수점 오차 방지를 위해 최종 합계에 Math.round 적용.
 */

type ItemWithQtyPrice = {
    receivedQty: number;
    unitPrice: number;
  };
  
  type POItemWithQtyPrice = {
    quantity: number;
    unitPrice: number;
  };
  
  /**
   * 입고서 총액 = Σ(receivedQty × unitPrice), 원 단위 반올림.
   */
  export function calculateReceivingNoteTotal(
    items: ItemWithQtyPrice[],
  ): number {
    const sum = items.reduce(
      (acc, it) => acc + Number(it.receivedQty) * Number(it.unitPrice),
      0,
    );
    return Math.round(sum);
  }
  
  /**
   * 발주서 items 기준 총액 = Σ(quantity × unitPrice), 원 단위 반올림.
   * (PO.totalAmount 컬럼과 별개로 items 로부터 재계산하고 싶을 때 사용)
   */
  export function calculatePurchaseOrderItemsTotal(
    items: POItemWithQtyPrice[],
  ): number {
    const sum = items.reduce(
      (acc, it) => acc + Number(it.quantity) * Number(it.unitPrice),
      0,
    );
    return Math.round(sum);
  }
  
  /**
   * 입고 총액 vs 발주 총액 차이. 양수면 입고가 더 큼, 음수면 발주가 더 큼.
   */
  export function calculateAmountDiff(
    receivingTotal: number,
    purchaseOrderTotal: number,
  ): number {
    return receivingTotal - purchaseOrderTotal;
  }
  