"use client";

import { useState } from "react";   // ★ 추가
import type { PreviewDeltaPlanResult } from "@/features/purchase-order/actions/purchase-order.action";

interface Props {
  /** preview 결과 — null 이면 미실행/계산중, undefined 면 비DELTA 모드 (렌더 안 함) */
  preview: PreviewDeltaPlanResult | null;
  isLoading: boolean;
  error: string | null;
  /** 표시 위치 (디자인 미세 조정용) */
  context: "step2" | "step5";
}

export function DeltaPreviewCard({ preview, isLoading, error, context }: Props) {
  if (isLoading) { /* 기존 그대로 */ }
  if (error) { /* 기존 그대로 */ }
  if (!preview) return null;

  // ★ R1-b5-3 (D20): Step 5 진입 시 기본 접힘, Step 2 / 기타 컨텍스트는 펼침 유지
  //    (현재 Step 2 호출은 R1-b5-2 에서 제거되었지만 context==="step2" 분기는 호환성 위해 보존)
  const [collapsed, setCollapsed] = useState(context === "step5");

  const { summary, itemChanges, newGroups, blocked } = preview;
  const hasAnyChange =
    summary.increased + summary.decreased + summary.priceChanged + summary.added > 0;

  const changesByPO = new Map<
    string,
    { orderNumber: string | null; rows: typeof itemChanges }
  >();
  for (const ch of itemChanges) {
    const key = ch.purchaseOrderId ?? "_NEW_";
    let entry = changesByPO.get(key);
    if (!entry) {
      entry = { orderNumber: ch.purchaseOrderNumber, rows: [] };
      changesByPO.set(key, entry);
    }
    entry.rows.push(ch);
  }

  const isToggleable = context === "step5";

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40">
      <header className="flex items-center justify-between border-b border-amber-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-900">
            🔀 차분 발주 미리보기
          </span>
          {context === "step2" && (
            <span className="text-xs text-amber-700">
              (Step 3 편집 시 자동 갱신됩니다)
            </span>
          )}
          {/* ★ R1-b5-3: Step 5 에서 변경 건수 요약을 헤더에 노출 (접힘 상태에서도 보이도록) */}
          {isToggleable && (
            <span className="text-xs text-amber-800">
              · 변경 {summary.increased + summary.decreased + summary.added + summary.priceChanged}건
              {summary.unchanged > 0 && ` · 동일 ${summary.unchanged}건`}
              {newGroups.length > 0 && ` · 신규 PO ${newGroups.length}건`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-amber-800">
            총 변동액{" "}
            <strong
              className={
                summary.totalDeltaAmount > 0
                  ? "text-blue-700"
                  : summary.totalDeltaAmount < 0
                    ? "text-orange-700"
                    : "text-gray-700"
              }
            >
              {summary.totalDeltaAmount >= 0 ? "+" : ""}
              {summary.totalDeltaAmount.toLocaleString()} 원
            </strong>
          </span>
          {/* ★ R1-b5-3: Step 5 토글 버튼 */}
          {isToggleable && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
              className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100"
            >
              {collapsed ? "상세 펼치기 ▾" : "상세 접기 ▴"}
            </button>
          )}
        </div>
      </header>

      {/* ★ R1-b5-3: 본문 4개 블록을 collapsed 로 감싸기. blocked 경고는 안전상 항상 노출. */}
      {blocked.hasApprovedOrLocked && (
        <div className="border-b border-amber-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          ⚠ 발주확정(APPROVED) 이상 상태의 PO {blocked.lockedPOIds.length}건이
          포함되어 있어 실행이 차단됩니다. 부족분은 신규 발주로, 오배송·과다는
          재고 실사로 처리하세요.
        </div>
      )}

      {!collapsed && (
        <>
          {/* 요약 카운트 */}
          <div className="grid grid-cols-5 gap-2 border-b border-amber-200 px-4 py-3">
            <SummaryPill label="증가" count={summary.increased} tone="up" />
            <SummaryPill label="감소" count={summary.decreased} tone="down" />
            <SummaryPill label="신규" count={summary.added} tone="add" />
            <SummaryPill label="단가 변경" count={summary.priceChanged} tone="price" />
            <SummaryPill label="변경 없음" count={summary.unchanged} tone="unchanged" />
          </div>

          {!hasAnyChange && summary.unchanged === 0 && newGroups.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              차분 항목이 없습니다.
            </div>
          )}

          {/* 기존 PO 별 변경 행 */}
          {changesByPO.size > 0 && (
            <div className="border-b border-amber-200">
              {Array.from(changesByPO.entries()).map(([poId, entry]) => {
                if (poId === "_NEW_") return null;
                return (
                  <div key={poId} className="border-b border-amber-100 last:border-b-0">
                    <div className="bg-amber-100/50 px-4 py-1.5 text-xs font-medium text-amber-900">
                      기존 발주서 {entry.orderNumber ?? poId.slice(0, 8)} —{" "}
                      {entry.rows.length}건
                    </div>
                    <ChangeRowsTable rows={entry.rows} />
                  </div>
                );
              })}
            </div>
          )}

          {/* 신규 그룹 */}
          {newGroups.length > 0 && (
            <div>
              <div className="bg-emerald-100/50 px-4 py-1.5 text-xs font-medium text-emerald-900">
                ＋ 신규 발주서 생성 — {newGroups.length}건
              </div>
              {newGroups.map((g, i) => (
                <div
                  key={i}
                  className="border-b border-emerald-100 last:border-b-0 px-4 py-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-900">
                      {g.supplierName} · {g.locationName}
                      {g.productionLineName && ` · ${g.productionLineName}`}
                    </span>
                    <span className="font-semibold text-emerald-700">
                      +{g.groupAmount.toLocaleString()} 원
                    </span>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-gray-700">
                    {g.items.map((it) => (
                      <li key={it.materialMasterId} className="flex justify-between">
                        <span>
                          {it.materialName}{" "}
                          <span className="text-gray-400">({it.materialCode})</span>
                        </span>
                        <span className="font-mono">
                          {/* ★ 표시 정수 안전망 */}
                          {Math.round(it.quantity)} × {it.unitPrice.toLocaleString()} ={" "}
                          {it.amount.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────
function SummaryPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "up" | "down" | "add" | "price" | "unchanged";
}) {
  const toneClass = {
    up: "bg-blue-100 text-blue-800",
    down: "bg-orange-100 text-orange-800",
    add: "bg-emerald-100 text-emerald-800",
    price: "bg-purple-100 text-purple-800",
    unchanged: "bg-gray-100 text-gray-600",
  }[tone];
  const icon = {
    up: "↑",
    down: "↓",
    add: "＋",
    price: "₩",
    unchanged: "＝",
  }[tone];
  return (
    <div className={`rounded-md px-2 py-1.5 text-center ${toneClass}`}>
      <div className="text-[10px] font-medium">
        {icon} {label}
      </div>
      <div className="text-base font-bold">{count}</div>
    </div>
  );
}

function ChangeRowsTable({
  rows,
}: {
  rows: import("@/features/purchase-order/actions/purchase-order.action").DeltaPreviewItemChange[];
}) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-white/40 text-left text-gray-600">
        <tr>
          <th className="px-3 py-1.5 w-24">유형</th>
          <th className="px-3 py-1.5">자재</th>
          <th className="px-3 py-1.5 text-right">수량 변화</th>
          <th className="px-3 py-1.5 text-right">단가 변화</th>
          <th className="px-3 py-1.5 text-right">금액 차이</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={`${r.purchaseOrderId}-${r.materialMasterId}-${i}`}
            className={`border-t border-amber-100 ${
              r.kind === "UNCHANGED" ? "text-gray-400" : "text-gray-800"
            }`}
          >
            <td className="px-3 py-1.5">
              <KindBadge kind={r.kind} />
            </td>
            <td className="px-3 py-1.5">
              <div className="font-medium">{r.materialName}</div>
              <div className="text-[10px] text-gray-400">{r.materialCode}</div>
            </td>
            <td className="px-3 py-1.5 text-right font-mono">
              {r.kind === "ADD" ? (
                <span className="text-emerald-700">
                  ＋ {Math.round(r.afterQuantity)}
                </span>
              ) : r.deltaQuantity !== 0 ? (
                <>
                  <span className="text-gray-500">
                    {r.beforeQuantity != null ? Math.round(r.beforeQuantity) : "—"}
                  </span>
                  {" → "}
                  <strong className={r.deltaQuantity > 0 ? "text-blue-700" : "text-orange-700"}>
                    {Math.round(r.afterQuantity)}
                  </strong>
                  <span className="ml-1 text-[10px] opacity-70">
                    ({r.deltaQuantity > 0 ? "+" : ""}
                    {Math.round(r.deltaQuantity)})
                  </span>
                </>
              ) : (
                <span className="text-gray-400">{Math.round(r.afterQuantity)}</span>
              )}
            </td>
            <td className="px-3 py-1.5 text-right font-mono">
              {r.unitPriceChanged && r.beforeUnitPrice !== null ? (
                <>
                  <span className="text-gray-500">
                    {r.beforeUnitPrice.toLocaleString()}
                  </span>
                  {" → "}
                  <strong className="text-purple-700">
                    {r.afterUnitPrice.toLocaleString()}
                  </strong>
                </>
              ) : (
                <span className="text-gray-400">
                  {r.afterUnitPrice.toLocaleString()}
                </span>
              )}
            </td>
            <td className="px-3 py-1.5 text-right font-mono font-medium">
              {r.amountDelta === 0 ? (
                <span className="text-gray-400">—</span>
              ) : (
                <span
                  className={
                    r.amountDelta > 0 ? "text-blue-700" : "text-orange-700"
                  }
                >
                  {r.amountDelta > 0 ? "+" : ""}
                  {r.amountDelta.toLocaleString()}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KindBadge({
  kind,
}: {
  kind: import("@/features/purchase-order/actions/purchase-order.action").DeltaPreviewItemChange["kind"];
}) {
  const map = {
    UPDATE_QUANTITY: { label: "수량 변경", cls: "bg-blue-100 text-blue-800" },
    UPDATE_UNIT_PRICE: {
      label: "단가 변경",
      cls: "bg-purple-100 text-purple-800",
    },
    UPDATE_BOTH: { label: "수량＋단가", cls: "bg-indigo-100 text-indigo-800" },
    ADD: { label: "신규 추가", cls: "bg-emerald-100 text-emerald-800" },
    UNCHANGED: { label: "변경 없음", cls: "bg-gray-100 text-gray-600" },
  }[kind];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map.cls}`}>
      {map.label}
    </span>
  );
}
