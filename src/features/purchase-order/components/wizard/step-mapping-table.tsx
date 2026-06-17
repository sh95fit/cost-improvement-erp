"use client";

import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";
import type { SupplierItemWithSupplier } from "@/features/supplier/actions/supplier.action";
import { SupplierItemPicker } from "./supplier-item-picker";

interface Props {
  mapped: POItemCandidate[];
  unmapped: POItemCandidate[];
  noOrderNeeded: POItemCandidate[];
  onUpdateQuantity: (materialRequirementId: string, value: number) => void;
  onUpdateUnitPrice: (materialRequirementId: string, value: number) => void;
  onResolveUnmapped: (
    materialRequirementId: string,
    supplierItem: SupplierItemWithSupplier,
  ) => void;
}

export function StepMappingTable({
  mapped,
  unmapped,
  noOrderNeeded,
  onUpdateQuantity,
  onUpdateUnitPrice,
  onResolveUnmapped,
}: Props) {
  const totalAmount = mapped.reduce(
    (sum, r) => sum + (r.orderQuantity ?? 0) * (r.unitPrice ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 3 — 자재 매핑·편집</h2>
        <p className="mt-1 text-sm text-gray-600">
          매핑된 항목은 수량·단가를 인라인 편집할 수 있습니다. 미매핑 항목은
          공급업체와 공급품목을 선택해야 다음 단계로 진행할 수 있습니다.
        </p>
      </div>

      {/* 미매핑 섹션 (우선 노출) */}
      {unmapped.length > 0 && (
        <section className="rounded-md border border-red-200 bg-red-50">
          <header className="border-b border-red-200 px-4 py-2 text-sm font-medium text-red-900">
            ⚠ 미매핑 자재 ({unmapped.length}건) — 공급업체 선택 필요
          </header>
          <RowsTable
            rows={unmapped}
            mode="unmapped"
            onUpdateQuantity={onUpdateQuantity}
            onUpdateUnitPrice={onUpdateUnitPrice}
            onResolveUnmapped={onResolveUnmapped}
          />
        </section>
      )}

      {/* 매핑됨 섹션 */}
      <section className="rounded-md border border-gray-200">
        <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900">
          <span>✓ 자동 매핑됨 ({mapped.length}건)</span>
          <span className="text-gray-600">
            예상 합계:{" "}
            <span className="font-semibold text-gray-900">
              {totalAmount.toLocaleString()} 원
            </span>
          </span>
        </header>
        {mapped.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            자동 매핑된 자재가 없습니다.
          </p>
        ) : (
          <RowsTable
            rows={mapped}
            mode="mapped"
            onUpdateQuantity={onUpdateQuantity}
            onUpdateUnitPrice={onUpdateUnitPrice}
            onResolveUnmapped={onResolveUnmapped}
          />
        )}
      </section>

      {/* 발주 불필요 섹션 */}
      {noOrderNeeded.length > 0 && (
        <section className="rounded-md border border-gray-200 bg-gray-50">
          <header className="border-b border-gray-200 px-4 py-2 text-sm font-medium text-gray-700">
            재고 충당 — 발주 불필요 ({noOrderNeeded.length}건)
          </header>
          <RowsTable
            rows={noOrderNeeded}
            mode="noOrderNeeded"
            onUpdateQuantity={onUpdateQuantity}
            onUpdateUnitPrice={onUpdateUnitPrice}
            onResolveUnmapped={onResolveUnmapped}
          />
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 내부: 행 테이블
// ────────────────────────────────────────────────────────
function RowsTable({
  rows,
  mode,
  onUpdateQuantity,
  onUpdateUnitPrice,
  onResolveUnmapped,
}: {
  rows: POItemCandidate[];
  mode: "mapped" | "unmapped" | "noOrderNeeded";
  onUpdateQuantity: (id: string, v: number) => void;
  onUpdateUnitPrice: (id: string, v: number) => void;
  onResolveUnmapped: (
    id: string,
    si: SupplierItemWithSupplier,
  ) => void;
}) {
  const editable = mode === "mapped";
  const disabled = mode === "noOrderNeeded";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/60 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">자재</th>
            <th className="px-3 py-2">필요량(g)</th>
            <th className="px-3 py-2">재고(g)</th>
            <th className="px-3 py-2">순필요</th>
            <th className="px-3 py-2 w-[200px]">공급업체 · 품목</th>
            <th className="px-3 py-2 w-20">발주수량</th>
            <th className="px-3 py-2 w-24">단가</th>
            <th className="px-3 py-2 w-24 text-right">합계</th>
            <th className="px-3 py-2">알림</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowTotal =
              (r.orderQuantity ?? 0) * (r.unitPrice ?? 0);
            return (
              <tr
                key={r.materialRequirementId}
                className="border-t border-gray-100 align-middle"
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">
                    {r.materialName}
                  </div>
                  <div className="text-gray-500">{r.materialCode}</div>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {r.requiredQtyG.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {r.stockQtyG.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {r.netRequiredG.toLocaleString()}
                  {r.fromUnitName && r.netRequiredInFromUnit != null && (
                    <div className="text-[10px] text-gray-400">
                      = {r.netRequiredInFromUnit.toFixed(2)} {r.fromUnitName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {mode === "unmapped" ? (
                    <SupplierItemPicker
                      materialMasterId={r.materialMasterId}
                      value={r.supplierItem?.id ?? null}
                      onSelect={(si) =>
                        onResolveUnmapped(r.materialRequirementId, si)
                      }
                    />
                  ) : r.supplierItem ? (
                    <div>
                      <div className="font-medium">
                        {r.supplierItem.supplierName}
                      </div>
                      <div className="text-gray-600">
                        {r.supplierItem.productName}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {r.supplierItem.supplyUnitQty}{" "}
                        {r.supplierItem.supplyUnitName}/{r.supplierItem.supplyUnitName}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.orderQuantity ?? 0}
                      onChange={(e) =>
                        onUpdateQuantity(
                          r.materialRequirementId,
                          Number(e.target.value),
                        )
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                    />
                  ) : (
                    <span
                      className={
                        disabled ? "text-gray-400" : "text-gray-700"
                      }
                    >
                      {r.orderQuantity ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={r.unitPrice ?? 0}
                      onChange={(e) =>
                        onUpdateUnitPrice(
                          r.materialRequirementId,
                          Number(e.target.value),
                        )
                      }
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                    />
                  ) : (
                    <span
                      className={
                        disabled ? "text-gray-400" : "text-gray-700"
                      }
                    >
                      {r.unitPrice != null
                        ? r.unitPrice.toLocaleString()
                        : "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {rowTotal > 0 ? rowTotal.toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.warnings.length > 0 && (
                    <ul className="space-y-0.5 text-[10px] text-amber-700">
                      {r.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
