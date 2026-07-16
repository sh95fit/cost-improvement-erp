"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { listPendingMealPlansAction } from "../actions/list-pending-meal-plans.action";

// ────────────────────────────────────────────────────────────
// Row 타입 — service.PendingMealPlanRow 와 정합
// ────────────────────────────────────────────────────────────
type PendingRow = {
  id: string;
  planDate: string | Date;
  status: "CONFIRMED";
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * ════════════════════════════════════════
 * S4-3-c-4-1: 확정 대기 식단 상단 배너
 * ════════════════════════════════════════
 *
 * - 기본 접힘, 건수 뱃지 노출.
 * - 펼침 시 CONFIRMED 상태 MealPlanGroup 카드 리스트 표시.
 * - 카드 클릭 → `/meal-plan/[id]` 이동 (식단 확정 페이지).
 * - 사용 처리 진입 자체는 P13 가드가 차단하므로 배너는 라우팅만 수행.
 * - 대상 0건이면 배너 자체를 렌더링하지 않음.
 */
export function PendingMealPlanBanner() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await listPendingMealPlansAction();
        if (cancelled) return;
        if (result.success) {
          setRows(result.data as PendingRow[]);
        } else {
          toast.error(
            result.error.message || "확정 대기 식단 조회에 실패했습니다",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 로딩 중이거나 대상 0건이면 렌더링 생략
  if (loading || rows.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-900">
            확정 대기 식단 {rows.length}건 있음
          </span>
          <span className="text-xs text-amber-700">
            (식단 확정 후 사용 처리 가능)
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-700">
          {expanded ? (
            <>
              접기
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              펼치기
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 px-4 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/meal-plan/${row.id}`}
                className="rounded border border-amber-200 bg-white p-3 hover:border-amber-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">
                    {formatDate(row.planDate)}
                  </span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    확정 대기
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-700">
            카드를 클릭하면 해당 식단 페이지로 이동합니다. 식단 확정(COMPLETED)
            후 리스트 상단 "신규 사용 처리" 버튼으로 진입하세요.
          </p>
        </div>
      )}
    </div>
  );
}
