import { describe, expect, it } from "vitest";
import {
  computeDeltaPlan,
  type ExistingPOItemForDelta,
  type NewItemForDelta,
} from "@/features/purchase-order/services/po-delta.service";

// ── 헬퍼 ──
function makeExisting(
  overrides: Partial<ExistingPOItemForDelta> = {},
): ExistingPOItemForDelta {
  return {
    purchaseOrderId: overrides.purchaseOrderId ?? "po_1",
    purchaseOrderStatus: overrides.purchaseOrderStatus ?? "DRAFT",
    purchaseOrderItemId: overrides.purchaseOrderItemId ?? "poi_1",
    materialMasterId: overrides.materialMasterId ?? "mat_1",
    locationId: overrides.locationId ?? "loc_1",
    productionLineId: overrides.productionLineId ?? null,
    supplierId: overrides.supplierId ?? "sup_1",
    supplierItemId: overrides.supplierItemId ?? "si_1",
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 50000,
    systemQuantity: overrides.systemQuantity ?? null,
  };
}

function makeCandidate(
  overrides: Partial<NewItemForDelta> = {},
): NewItemForDelta {
  return {
    materialMasterId: overrides.materialMasterId ?? "mat_1",
    locationId: overrides.locationId ?? "loc_1",
    productionLineId: overrides.productionLineId ?? null,
    supplierId: overrides.supplierId ?? "sup_1",
    supplierItemId: overrides.supplierItemId ?? "si_1",
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 50000,
    netRequiredG: overrides.netRequiredG ?? null,
  };
}

describe("computeDeltaPlan", () => {
  // ── 수량 변경 ──
  it("동일 매칭 키 + 수량 증가 → updates 에 +delta 기록", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ quantity: 1, unitPrice: 50000 })],
      newCandidates: [makeCandidate({ quantity: 2, unitPrice: 50000 })],
    });

    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].beforeQuantity).toBe(1);
    expect(r.updates[0].afterQuantity).toBe(2);
    expect(r.updates[0].deltaQuantity).toBe(1);
    expect(r.updates[0].quantityReason).toContain("+1박스");
    expect(r.updates[0].unitPriceChanged).toBe(false);
    expect(r.summary.increased).toBe(1);
    expect(r.summary.decreased).toBe(0);
    expect(r.summary.totalDeltaAmount).toBe(50000);
  });

  it("동일 매칭 키 + 수량 감소 → updates 에 -delta 기록", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ quantity: 3, unitPrice: 50000 })],
      newCandidates: [makeCandidate({ quantity: 1, unitPrice: 50000 })],
    });

    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].deltaQuantity).toBe(-2);
    expect(r.updates[0].quantityReason).toContain("-2박스");
    expect(r.summary.decreased).toBe(1);
    expect(r.summary.totalDeltaAmount).toBe(-100000);
  });

  it("동일 매칭 키 + 수량·단가 동일 → unchanged 로 분류, 로그 없음", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ quantity: 2, unitPrice: 50000 })],
      newCandidates: [makeCandidate({ quantity: 2, unitPrice: 50000 })],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.unchanged).toHaveLength(1);
    expect(r.summary.unchanged).toBe(1);
    expect(r.summary.totalDeltaAmount).toBe(0);
  });

  // ── 단가 변경 ──
  it("단가만 변경 → updates 에 priceReason 만 기록", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ quantity: 2, unitPrice: 50000 })],
      newCandidates: [makeCandidate({ quantity: 2, unitPrice: 55000 })],
    });

    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].quantityReason).toBeNull();
    expect(r.updates[0].priceReason).toContain("50000");
    expect(r.updates[0].priceReason).toContain("55000");
    expect(r.updates[0].unitPriceChanged).toBe(true);
    expect(r.summary.priceChanged).toBe(1);
    expect(r.summary.totalDeltaAmount).toBe(10000); // 2 × (55000-50000)
  });

  it("수량·단가 모두 변경 → updates 에 두 reason 모두 채움", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ quantity: 1, unitPrice: 50000 })],
      newCandidates: [makeCandidate({ quantity: 2, unitPrice: 55000 })],
    });

    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].quantityReason).not.toBeNull();
    expect(r.updates[0].priceReason).not.toBeNull();
    expect(r.summary.increased).toBe(1);
    expect(r.summary.priceChanged).toBe(1);
  });

  // ── 신규 자재 / 신규 그룹 ──
  it("매칭 안 됨 + 동일 그룹 PO 존재 → additions 으로 분류", () => {
    const r = computeDeltaPlan({
      existingItems: [
        // 기존: mat_1 in po_1 (sup_1/loc_1/null line)
        makeExisting({
          materialMasterId: "mat_1",
          purchaseOrderId: "po_1",
          purchaseOrderItemId: "poi_1",
        }),
      ],
      newCandidates: [
        // 신규: mat_2 같은 supplier/location/line 그룹
        makeCandidate({
          materialMasterId: "mat_2",
          supplierItemId: "si_2",
        }),
      ],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.additions).toHaveLength(1);
    expect(r.additions[0].purchaseOrderId).toBe("po_1");
    expect(r.additions[0].candidate.materialMasterId).toBe("mat_2");
    expect(r.newGroups).toHaveLength(0);
    expect(r.summary.added).toBe(1);
  });

  it("매칭 안 됨 + 그룹도 없음 → newGroups 로 분류", () => {
    const r = computeDeltaPlan({
      existingItems: [
        makeExisting({ supplierId: "sup_1", locationId: "loc_1" }),
      ],
      newCandidates: [
        // 다른 공급업체 → 그룹 키도 다름
        makeCandidate({
          supplierId: "sup_2",
          supplierItemId: "si_2",
          materialMasterId: "mat_2",
        }),
      ],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.additions).toHaveLength(0);
    expect(r.newGroups).toHaveLength(1);
    expect(r.newGroups[0].candidate.supplierId).toBe("sup_2");
    expect(r.summary.added).toBe(1);
  });

  // ── 매칭 키 ──
  it("같은 자재라도 공장이 다르면 다른 그룹 (newGroup)", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ locationId: "loc_1" })],
      newCandidates: [
        makeCandidate({
          locationId: "loc_2",
          supplierItemId: "si_3",
        }),
      ],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.newGroups).toHaveLength(1);
  });

  it("같은 자재라도 공급업체가 다르면 다른 그룹 (newGroup)", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ supplierId: "sup_1" })],
      newCandidates: [
        makeCandidate({
          supplierId: "sup_2",
          supplierItemId: "si_2",
        }),
      ],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.newGroups).toHaveLength(1);
  });

  it("같은 자재 + 같은 그룹이라도 productionLineId 가 다르면 다른 매칭", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting({ productionLineId: null })],
      newCandidates: [makeCandidate({ productionLineId: "line_1" })],
    });

    expect(r.updates).toHaveLength(0);
    // 같은 supplier+location 이지만 line 이 달라 그룹 키도 다름 → newGroup
    expect(r.newGroups).toHaveLength(1);
  });

  // ── SUBMITTED 처리 ──
  it("SUBMITTED 상태의 기존 item 도 동일하게 차분 (status 전달)", () => {
    const r = computeDeltaPlan({
      existingItems: [
        makeExisting({
          purchaseOrderStatus: "SUBMITTED",
          quantity: 1,
        }),
      ],
      newCandidates: [makeCandidate({ quantity: 3 })],
    });

    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].purchaseOrderStatus).toBe("SUBMITTED");
    expect(r.updates[0].deltaQuantity).toBe(2);
  });

  // ── 방어 케이스 ──
  it("quantity 0 인 후보는 무시", () => {
    const r = computeDeltaPlan({
      existingItems: [makeExisting()],
      newCandidates: [makeCandidate({ quantity: 0 })],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.additions).toHaveLength(0);
    expect(r.newGroups).toHaveLength(0);
    expect(r.unchanged).toHaveLength(0);
  });

  it("기존 item 없음 + 신규 후보만 있음 → 모두 newGroups", () => {
    const r = computeDeltaPlan({
      existingItems: [],
      newCandidates: [
        makeCandidate({ materialMasterId: "mat_1" }),
        makeCandidate({
          materialMasterId: "mat_2",
          supplierItemId: "si_2",
        }),
      ],
    });

    expect(r.updates).toHaveLength(0);
    expect(r.additions).toHaveLength(0);
    expect(r.newGroups).toHaveLength(2);
    expect(r.summary.added).toBe(2);
  });

  // ── 복합 시나리오 ──
  it("복합: 1건 증가 + 1건 감소 + 1건 신규 + 1건 변경없음", () => {
    const r = computeDeltaPlan({
      existingItems: [
        makeExisting({
          materialMasterId: "mat_1",
          purchaseOrderItemId: "poi_1",
          quantity: 2,
        }),
        makeExisting({
          materialMasterId: "mat_2",
          supplierItemId: "si_2",
          purchaseOrderItemId: "poi_2",
          quantity: 5,
        }),
        makeExisting({
          materialMasterId: "mat_3",
          supplierItemId: "si_3",
          purchaseOrderItemId: "poi_3",
          quantity: 1,
        }),
      ],
      newCandidates: [
        // 증가: mat_1  2 → 4
        makeCandidate({ materialMasterId: "mat_1", quantity: 4 }),
        // 감소: mat_2  5 → 3
        makeCandidate({
          materialMasterId: "mat_2",
          supplierItemId: "si_2",
          quantity: 3,
        }),
        // 변경 없음: mat_3
        makeCandidate({
          materialMasterId: "mat_3",
          supplierItemId: "si_3",
          quantity: 1,
        }),
        // 신규: mat_4 (같은 그룹) → addition
        makeCandidate({
          materialMasterId: "mat_4",
          supplierItemId: "si_4",
        }),
      ],
    });

    expect(r.updates).toHaveLength(2);
    expect(r.additions).toHaveLength(1);
    expect(r.unchanged).toHaveLength(1);
    expect(r.summary.increased).toBe(1);
    expect(r.summary.decreased).toBe(1);
    expect(r.summary.added).toBe(1);
    expect(r.summary.unchanged).toBe(1);
  });
});
