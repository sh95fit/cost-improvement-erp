"use client";

import { useMemo } from "react";
import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";

interface Props {
  mapped: POItemCandidate[];
  /**
   * ★ D25-1 (D-PREVIEW-CONSISTENCY): 부분재고 행도 발주 대상이므로
   *    Step 5 합계(validMapped)와 일치시키기 위해 분할 미리보기에 포함한다.
   */
  mappedPartialStock: POItemCandidate[];
}

interface PreviewGroup {
  key: string;
  supplierId: string;
  supplierName: string;
  locationId: string;
  productionLineId: string | null;
  rows: POItemCandidate[];
  itemCount: number;
  totalAmount: number;
}

export function StepSplitPreview({ mapped, mappedPartialStock }: Props) {
  // ★ D25-1: SSOT — mapped + mappedPartialStock 통합
  const allRows = useMemo(
    () => [...mapped, ...mappedPartialStock],
    [mapped, mappedPartialStock],
  );

  const groups = useMemo<PreviewGroup[]>(() => {
    const map = new Map<string, PreviewGroup>();
    for (const r of allRows) {
      if (!r.supplierItem) continue;
      // ★ D25-1: orderQuantity 가 0/null 인 행은 합계 왜곡 방지를 위해 제외
      if (r.orderQuantity == null || r.orderQuantity <= 0) continue;

      const supplierId = r.supplierItem.supplierId;
      const supplierName = r.supplierItem.supplierName;
      const locationId = r.locationId;
      const productionLineId = r.productionLineId ?? null;
      const key = `${supplierId}|${locationId}|${productionLineId ?? "_"}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          supplierId,
          supplierName,
          locationId,
          productionLineId,
          rows: [],
          itemCount: 0,
          totalAmount: 0,
        });
      }
      const g = map.get(key)!;
      g.rows.push(r);
      g.itemCount += 1;
      g.totalAmount += (r.orderQuantity ?? 0) * (r.unitPrice ?? 0);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName, "ko"),
    );
  }, [allRows]);

  const grandTotal = groups.reduce((s, g) => s + g.totalAmount, 0);
  const totalItems = groups.reduce((s, g) => s + g.itemCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 4 — 분할 미리보기</h2>
        <p className="mt-1 text-sm text-gray-600">
          공급업체 × 공장 × 라인 단위로 자동 분할됩니다. 같은 그룹의 자재는 1개의
          DRAFT PO로 묶입니다.
          <span className="ml-1 text-gray-500">
            (부분재고 차감 후 잔여 발주 행도 포함)
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label="생성될 PO 수" value={groups.length} />
        <SummaryStat label="자재 행 총합" value={totalItems} />
        <SummaryStat
          label="총 발주 금액"
          value={`${grandTotal.toLocaleString()} 원`}
        />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          매핑된 자재가 없습니다. Step 3 에서 공급업체를 모두 매핑한 후 다시
          시도하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.key}
              className="rounded-md border border-gray-200 bg-white"
            >
              <header className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-900">
                    {g.supplierName}
                  </span>
                  <span className="ml-2 text-gray-500">
                    · 공장 {g.locationId.slice(0, 8)}…
                  </span>
                  {g.productionLineId && (
                    <span className="ml-1 text-gray-500">
                      · 라인 {g.productionLineId.slice(0, 8)}…
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-gray-600">{g.itemCount} 행</div>
                  <div className="font-semibold text-gray-900">
                    {g.totalAmount.toLocaleString()} 원
                  </div>
                </div>
              </header>
              <table className="w-full text-xs">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="px-3 py-1.5">자재</th>
                    <th className="px-3 py-1.5">품목</th>
                    <th className="px-3 py-1.5 text-right">수량</th>
                    <th className="px-3 py-1.5 text-right">단가</th>
                    <th className="px-3 py-1.5 text-right">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr
                      key={r.materialRequirementId}
                      className="border-t border-gray-50"
                    >
                      <td className="px-3 py-1.5">
                        <span className="font-medium">{r.materialName}</span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">
                        {r.supplierItem?.productName ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {r.orderQuantity ?? 0}{" "}
                        <span className="text-gray-400">
                          {r.supplierItem?.supplyUnitName}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {(r.unitPrice ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {(
                          (r.orderQuantity ?? 0) * (r.unitPrice ?? 0)
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}