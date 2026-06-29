"use client";

import { useState, useMemo } from "react";
import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";

export type GroupByAxis = "location" | "productionLine" | "supplier" | "lineup";

export type UserScopeLevel = "COMPANY" | "LOCATION" | "PRODUCTION_LINE";

interface Props {
  rows: POItemCandidate[];   // mapped + mappedPartialStock (orderQuantity > 0 인 행만)
  scopeLevel: UserScopeLevel;
}

// 권한 스코프별 기본 그룹핑 축 (헌법 P2 Roll-up 의 자연스러운 시점)
const DEFAULT_AXIS_BY_SCOPE: Record<UserScopeLevel, GroupByAxis> = {
  COMPANY: "location",
  LOCATION: "productionLine",
  PRODUCTION_LINE: "supplier",  // 라인 스코프는 자기 라인만 보이므로 다음 축으로
};

// 권한 스코프별로 표시할 탭 (상위 축은 의미 없어 숨김)
const VISIBLE_AXES_BY_SCOPE: Record<UserScopeLevel, GroupByAxis[]> = {
  COMPANY:         ["location", "productionLine", "supplier", "lineup"],
  LOCATION:        ["productionLine", "supplier", "lineup"],
  PRODUCTION_LINE: ["supplier", "lineup"],
};

const AXIS_LABEL: Record<GroupByAxis, string> = {
  location: "공장별",
  productionLine: "제조라인별",
  supplier: "공급업체별",
  lineup: "라인업별",
};

export function GroupByTabs({ rows, scopeLevel }: Props) {
  const visibleAxes = VISIBLE_AXES_BY_SCOPE[scopeLevel];
  const [axis, setAxis] = useState<GroupByAxis>(DEFAULT_AXIS_BY_SCOPE[scopeLevel]);

  const groups = useMemo(() => groupRows(rows, axis), [rows, axis]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-gray-200">
        {visibleAxes.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAxis(a)}
            className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition ${
              axis === a
                ? "border-blue-600 text-blue-700 font-medium"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {AXIS_LABEL[a]}
          </button>
        ))}
      </div>
      <GroupList groups={groups} axis={axis} />
    </div>
  );
}

interface GroupedRow {
  key: string;
  label: string;
  rows: POItemCandidate[];
  totalAmount: number;
  itemCount: number;
}

function groupRows(rows: POItemCandidate[], axis: GroupByAxis): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  for (const r of rows) {
    if (!r.supplierItem) continue;
    if (r.orderQuantity == null || r.orderQuantity <= 0) continue;
    const { key, label } = axisKeyOf(r, axis);
    if (!map.has(key)) {
      map.set(key, { key, label, rows: [], totalAmount: 0, itemCount: 0 });
    }
    const g = map.get(key)!;
    g.rows.push(r);
    g.itemCount += 1;
    g.totalAmount += (r.orderQuantity ?? 0) * (r.unitPrice ?? 0);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "ko"),
  );
}

function axisKeyOf(r: POItemCandidate, axis: GroupByAxis): { key: string; label: string } {
  switch (axis) {
    case "location":
      return { key: r.locationId, label: `공장 ${r.locationId.slice(0, 8)}…` };
    case "productionLine":
      return { key: r.productionLineId, label: `라인 ${r.productionLineId.slice(0, 8)}…` };
    case "supplier":
      return { key: r.supplierItem!.supplierId, label: r.supplierItem!.supplierName };
    case "lineup":
      return {
        key: r.lineupId ?? "__UNCLASSIFIED__",
        label: r.lineupName ?? "(라인업 미지정)",
      };
  }
}

function GroupList({ groups, axis }: { groups: GroupedRow[]; axis: GroupByAxis }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        표시할 항목이 없습니다.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="rounded-md border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm">
            <span className="font-medium text-gray-900">{g.label}</span>
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
                {axis !== "lineup" && <th className="px-3 py-1.5">라인업</th>}
                <th className="px-3 py-1.5 text-right">수량</th>
                <th className="px-3 py-1.5 text-right">기준량(g)</th>
                <th className="px-3 py-1.5 text-right">단가</th>
                <th className="px-3 py-1.5 text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.materialRequirementId} className="border-t border-gray-50">
                  <td className="px-3 py-1.5 font-medium">{r.materialName}</td>
                  <td className="px-3 py-1.5 text-gray-700">
                    {r.supplierItem?.productName ?? "—"}
                  </td>
                  {axis !== "lineup" && (
                    <td className="px-3 py-1.5 text-gray-600">
                      {r.lineupName ?? "—"}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-right">
                    {r.orderQuantity ?? 0}{" "}
                    <span className="text-gray-400">{r.supplierItem?.supplyUnitName}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-500">
                    {r.netRequiredG.toLocaleString()} g
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {(r.unitPrice ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {((r.orderQuantity ?? 0) * (r.unitPrice ?? 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
