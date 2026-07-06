import { getDailyReceivingBundleAction } from "@/features/receiving-note/actions/get-daily-receiving-bundle.action";
import { DailyReceivingContainer } from "@/features/receiving-note/components/daily-receiving-container";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 통합 뷰 페이지
//   경로: /receiving/daily?date=YYYY-MM-DD&mode=outbound|expected
//   기본: 오늘 / outbound
// ════════════════════════════════════════

type SearchParams = Promise<{
  date?: string;
  mode?: "outbound" | "expected";
}>;

function todayISO(): string {
  // 서버 KST 자정 기준 오늘. 프로젝트가 UTC 자정 기준으로 date range 를 만드므로
  // "YYYY-MM-DD" 문자열만 전달하면 서비스가 알아서 UTC 자정으로 해석함.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function DailyReceivingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date: dateParam, mode: modeParam } = await searchParams;
  const date = dateParam ?? todayISO();
  const mode = modeParam === "expected" ? "expected" : "outbound";

  const result = await getDailyReceivingBundleAction({ date, mode });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">일자별 입고</h1>
          <p className="text-sm text-gray-500">
            선택한 날짜에 입고 예정/완료된 발주를 한 번에 확인하고 확정합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/receiving">대시보드</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/receiving/notes">입고서 목록</Link>
          </Button>
        </div>
      </div>

      {!result.success ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error.message}
        </div>
      ) : (
        <DailyReceivingContainer
          initialDate={date}
          initialMode={mode}
          initialBundle={result.data}
        />
      )}
    </div>
  );
}
