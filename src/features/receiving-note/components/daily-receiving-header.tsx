"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 상단 필터 바
//   - 날짜 이동 (전일 / 오늘 / 익일 + 직접 선택)
//   - mode 토글 (outbound / expected)
//   - 변경 시 URL 쿼리 갱신 → 서버 컴포넌트 재실행 (SSR 데이터 재로딩)
// ════════════════════════════════════════

type Mode = "outbound" | "expected";

type Props = {
  date: string;                // YYYY-MM-DD
  mode: Mode;
  pendingCount: number;
  completedCount: number;
};

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DailyReceivingHeader({
  date,
  mode,
  pendingCount,
  completedCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateQuery = (next: { date?: string; mode?: Mode }) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.date) params.set("date", next.date);
    if (next.mode) params.set("mode", next.mode);
    startTransition(() => {
      router.push(`/receiving/daily?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-3 rounded-md border bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* 날짜 이동 */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ date: shiftDate(date, -1) })}
            disabled={isPending}
            aria-label="전일"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) updateQuery({ date: e.target.value });
              }}
              className="w-[160px] pl-8"
              disabled={isPending}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ date: shiftDate(date, 1) })}
            disabled={isPending}
            aria-label="익일"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateQuery({ date: todayISO() })}
            disabled={isPending || date === todayISO()}
          >
            오늘
          </Button>
        </div>

        {/* 기준(mode) 토글 */}
        <div className="ml-2 inline-flex rounded-md border bg-gray-50 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => updateQuery({ mode: "outbound" })}
            disabled={isPending}
            className={`rounded px-3 py-1 transition ${
              mode === "outbound"
                ? "bg-white shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            출고일 기준
          </button>
          <button
            type="button"
            onClick={() => updateQuery({ mode: "expected" })}
            disabled={isPending}
            className={`rounded px-3 py-1 transition ${
              mode === "expected"
                ? "bg-white shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            예상입고일 기준
          </button>
        </div>

        {/* 요약 카운트 */}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            대기 <span className="font-semibold text-gray-900">{pendingCount}</span>건
          </span>
          <span className="text-gray-500">
            완료 <span className="font-semibold text-emerald-700">{completedCount}</span>건
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {mode === "outbound"
          ? "이 날짜에 사용(출고)되는 발주를 표시합니다. (발주서의 출고일 = 사용일 기준)"
          : "이 날짜에 공급업체가 도착시켜야 할 품목이 하나라도 포함된 발주를 표시합니다. (품목 예상입고일 = 출고일 − 리드타임)"
        }
      </p>
    </div>
  );
}
