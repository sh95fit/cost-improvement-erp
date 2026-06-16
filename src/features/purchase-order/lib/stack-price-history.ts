import type { Prisma } from "@prisma/client";

export interface PriceStackingResult {
  /** 적층된 PriceHistory 행 수 */
  stackedCount: number;
  /** currentPrice 갱신된 SupplierItem 수 */
  updatedSupplierItemCount: number;
  /** 변경 내역 (디버깅/감사용) */
  changes: Array<{
    supplierItemId: string;
    fromPrice: number;
    toPrice: number;
  }>;
}

/**
 * PO 확정(SUBMITTED 전이) 시점에 PriceHistory 적층 + SupplierItem.currentPrice 갱신
 *
 * 동작:
 *   1) PO의 모든 item을 조회 (supplierItemId, unitPrice)
 *   2) 같은 supplierItemId가 여러 행에 있으면 첫 등장 행의 unitPrice 사용
 *   3) 현재 SupplierItem.currentPrice와 다른 항목만 추출
 *   4) 변경된 항목에 대해:
 *      - SupplierItemPriceHistory 행 1개 추가 (effectiveFrom=effectiveDate)
 *      - SupplierItem.currentPrice 갱신
 *   5) 같은 트랜잭션 안에서 모두 처리
 *
 * 기존 패턴(supplier-item.service.ts:updateSupplierItem)과 동일하게:
 *   - effectiveTo는 사용하지 않음 (항상 null)
 *   - 최신 이력이 currentPrice를 의미
 *
 * @param tx              Prisma transaction client
 * @param purchaseOrderId 적층 대상 PO ID
 * @param effectiveDate   이력 적용 시점 (보통 new Date())
 */
export async function stackPriceHistoryForPO(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string,
  effectiveDate: Date,
): Promise<PriceStackingResult> {
  // 1) PO items 조회
  const items = await tx.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    select: { supplierItemId: true, unitPrice: true },
  });

  if (items.length === 0) {
    return { stackedCount: 0, updatedSupplierItemCount: 0, changes: [] };
  }

  // 2) supplierItemId별 첫 등장 단가 추출 (중복 시 첫 행 사용)
  const proposedPrices = new Map<string, number>();
  for (const it of items) {
    if (!proposedPrices.has(it.supplierItemId)) {
      proposedPrices.set(it.supplierItemId, it.unitPrice);
    }
  }

  // 3) 현재 SupplierItem 상태 일괄 조회
  const supplierItemIds = Array.from(proposedPrices.keys());
  const current = await tx.supplierItem.findMany({
    where: { id: { in: supplierItemIds } },
    select: { id: true, currentPrice: true },
  });
  const currentMap = new Map(current.map((c) => [c.id, c.currentPrice]));

  // 4) 변경된 항목 추출
  const changes: PriceStackingResult["changes"] = [];
  for (const [siId, proposed] of proposedPrices) {
    const currentPrice = currentMap.get(siId);
    if (currentPrice === undefined) continue; // SupplierItem 삭제됨 (무시)
    if (proposed !== currentPrice) {
      changes.push({
        supplierItemId: siId,
        fromPrice: currentPrice,
        toPrice: proposed,
      });
    }
  }

  if (changes.length === 0) {
    return { stackedCount: 0, updatedSupplierItemCount: 0, changes: [] };
  }

  // 5) 적층 + currentPrice 갱신 (변경된 것만)
  for (const ch of changes) {
    await tx.supplierItemPriceHistory.create({
      data: {
        supplierItemId: ch.supplierItemId,
        price: ch.toPrice,
        effectiveFrom: effectiveDate,
      },
    });
    await tx.supplierItem.update({
      where: { id: ch.supplierItemId },
      data: { currentPrice: ch.toPrice },
    });
  }

  return {
    stackedCount: changes.length,
    updatedSupplierItemCount: changes.length,
    changes,
  };
}
