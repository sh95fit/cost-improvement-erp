// src/features/purchase-order/services/po-delta.service.ts
// R1-b3: DELTA 모드 차분 계산 (pure 함수, DB 접근 없음)

/** computeDeltaPlan 의 신규 후보 입력 — 매칭/차분에 필요한 최소 필드만 */
export interface NewItemForDelta {
  materialMasterId: string;
  locationId: string;
  productionLineId: string | null;
  supplierId: string;
  supplierItemId: string;
  /** 박스 수량 (위저드 BatchPOItem.quantity 와 동일) */
  quantity: number;
  unitPrice: number;
  /** 참고용 g 단위 순필요량 (재고 차감 후). 없으면 0 처리 */
  netRequiredG?: number | null;
}

/** 기존 PO의 item 1개 + 그룹 키 정보 */
export interface ExistingPOItemForDelta {
  purchaseOrderId: string;
  purchaseOrderStatus: "DRAFT" | "SUBMITTED";
  purchaseOrderItemId: string;
  // 그룹 키 (4필드 — 위저드는 단일 mealPlanGroup 세션이므로 mealPlanGroupId 불필요)
  materialMasterId: string;
  locationId: string;
  productionLineId: string | null;
  supplierId: string;
  supplierItemId: string;
  // 현재 값
  quantity: number;
  unitPrice: number;
  systemQuantity: number | null;
}

export interface ComputeDeltaPlanInput {
  newCandidates: NewItemForDelta[];
  existingItems: ExistingPOItemForDelta[];
}

export interface DeltaUpdate {
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  purchaseOrderStatus: "DRAFT" | "SUBMITTED";
  beforeQuantity: number;
  afterQuantity: number;
  deltaQuantity: number;
  clamped: boolean;
  beforeSystemQuantity: number | null;
  afterSystemQuantity: number;
  beforeUnitPrice: number;
  afterUnitPrice: number;
  unitPriceChanged: boolean;
  quantityReason: string | null;
  priceReason: string | null;
}

export interface DeltaAddition {
  purchaseOrderId: string;
  purchaseOrderStatus: "DRAFT" | "SUBMITTED";
  candidate: NewItemForDelta;
}

export interface DeltaNewGroup {
  candidate: NewItemForDelta;
}

export interface DeltaUnchanged {
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  candidate: NewItemForDelta;
}

export interface ComputeDeltaPlanResult {
  updates: DeltaUpdate[];
  additions: DeltaAddition[];
  newGroups: DeltaNewGroup[];
  unchanged: DeltaUnchanged[];
  summary: {
    increased: number;
    decreased: number;
    added: number;
    priceChanged: number;
    unchanged: number;
    totalDeltaAmount: number;
  };
}

function makeMatchKey(args: {
  materialMasterId: string;
  locationId: string;
  productionLineId: string | null;
  supplierId: string;
}): string {
  return [
    args.materialMasterId,
    args.locationId,
    args.productionLineId ?? "null",
    args.supplierId,
  ].join("|");
}

function makeGroupKey(args: {
  supplierId: string;
  locationId: string;
  productionLineId: string | null;
}): string {
  return [args.supplierId, args.locationId, args.productionLineId ?? "null"].join("|");
}

/**
 * R1-b3 DELTA 모드 차분 계산.
 *
 * 정책:
 * - quantity 는 새 산정값으로 교체 ((a) 교체 방식). 차분은 POAdjustmentLog 에만 기록.
 * - 음수 차분(새 산정 < 기존)은 정상 케이스 (식수 감소) — 클램프 안 함.
 * - APPROVED 이상 PO 는 호출자가 사전 차단 (이 함수에 들어오면 안 됨).
 * - SUBMITTED PO 변경 시 호출자가 AuditLog 적층 책임.
 */
export function computeDeltaPlan(input: ComputeDeltaPlanInput): ComputeDeltaPlanResult {
  const { newCandidates, existingItems } = input;

  const existingByMatchKey = new Map<string, ExistingPOItemForDelta>();
  for (const item of existingItems) {
    existingByMatchKey.set(
      makeMatchKey({
        materialMasterId: item.materialMasterId,
        locationId: item.locationId,
        productionLineId: item.productionLineId,
        supplierId: item.supplierId,
      }),
      item,
    );
  }

  const existingPOByGroupKey = new Map<
    string,
    { purchaseOrderId: string; purchaseOrderStatus: "DRAFT" | "SUBMITTED" }
  >();
  for (const item of existingItems) {
    const gk = makeGroupKey({
      supplierId: item.supplierId,
      locationId: item.locationId,
      productionLineId: item.productionLineId,
    });
    if (!existingPOByGroupKey.has(gk)) {
      existingPOByGroupKey.set(gk, {
        purchaseOrderId: item.purchaseOrderId,
        purchaseOrderStatus: item.purchaseOrderStatus,
      });
    }
  }

  const updates: DeltaUpdate[] = [];
  const additions: DeltaAddition[] = [];
  const newGroups: DeltaNewGroup[] = [];
  const unchanged: DeltaUnchanged[] = [];

  for (const cand of newCandidates) {
    if (cand.quantity <= 0) continue; // 방어

    const matchKey = makeMatchKey({
      materialMasterId: cand.materialMasterId,
      locationId: cand.locationId,
      productionLineId: cand.productionLineId,
      supplierId: cand.supplierId,
    });

    const existing = existingByMatchKey.get(matchKey);

    if (existing) {
      const qtyChanged = existing.quantity !== cand.quantity;
      const priceChanged = existing.unitPrice !== cand.unitPrice;

      if (!qtyChanged && !priceChanged) {
        unchanged.push({
          purchaseOrderId: existing.purchaseOrderId,
          purchaseOrderItemId: existing.purchaseOrderItemId,
          candidate: cand,
        });
        continue;
      }

      const delta = cand.quantity - existing.quantity;
      const sign = delta > 0 ? "+" : "";
      const quantityReason = qtyChanged
        ? `식단/식수 변경 재산정 (${sign}${delta}박스, ${existing.quantity} → ${cand.quantity})`
        : null;
      const priceReason = priceChanged
        ? `공급가 변경 (${existing.unitPrice} → ${cand.unitPrice})`
        : null;

      updates.push({
        purchaseOrderId: existing.purchaseOrderId,
        purchaseOrderItemId: existing.purchaseOrderItemId,
        purchaseOrderStatus: existing.purchaseOrderStatus,
        beforeQuantity: existing.quantity,
        afterQuantity: cand.quantity,
        deltaQuantity: delta,
        clamped: false,
        beforeSystemQuantity: existing.systemQuantity,
        afterSystemQuantity: cand.netRequiredG ?? 0,
        beforeUnitPrice: existing.unitPrice,
        afterUnitPrice: cand.unitPrice,
        unitPriceChanged: priceChanged,
        quantityReason,
        priceReason,
      });
    } else {
      const groupKey = makeGroupKey({
        supplierId: cand.supplierId,
        locationId: cand.locationId,
        productionLineId: cand.productionLineId,
      });
      const groupPO = existingPOByGroupKey.get(groupKey);

      if (groupPO) {
        additions.push({
          purchaseOrderId: groupPO.purchaseOrderId,
          purchaseOrderStatus: groupPO.purchaseOrderStatus,
          candidate: cand,
        });
      } else {
        newGroups.push({ candidate: cand });
      }
    }
  }

  let increased = 0;
  let decreased = 0;
  let priceChanged = 0;
  let totalDeltaAmount = 0;

  for (const u of updates) {
    if (u.deltaQuantity > 0) increased++;
    else if (u.deltaQuantity < 0) decreased++;
    if (u.unitPriceChanged) priceChanged++;
    totalDeltaAmount += Math.round(
      u.afterQuantity * u.afterUnitPrice - u.beforeQuantity * u.beforeUnitPrice,
    );
  }
  for (const a of additions) {
    totalDeltaAmount += Math.round(a.candidate.quantity * a.candidate.unitPrice);
  }
  for (const n of newGroups) {
    totalDeltaAmount += Math.round(n.candidate.quantity * n.candidate.unitPrice);
  }

  const added = additions.length + newGroups.length;

  return {
    updates,
    additions,
    newGroups,
    unchanged,
    summary: {
      increased,
      decreased,
      added,
      priceChanged,
      unchanged: unchanged.length,
      totalDeltaAmount,
    },
  };
}
