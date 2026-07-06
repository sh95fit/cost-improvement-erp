import { getReceivingDashboardSummaryAction } from "@/features/receiving-note/actions/get-receiving-dashboard-summary.action";
import { ReceivingDashboard } from "@/features/receiving-note/components/receiving-dashboard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

export default async function ReceivingDashboardPage() {
  const result = await getReceivingDashboardSummaryAction();

  if (!result.success) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">입고 관리</h1>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">입고 관리</h1>
          <p className="text-sm text-gray-500">
            발주 입고 확정 및 재고 로트 생성을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/receiving/daily">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              일자별 입고
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/receiving/notes">입고서 목록</Link>
          </Button>
          <Button asChild>
            <Link href="/receiving/notes/new">새 입고서</Link>
          </Button>
        </div>
      </div>

      <ReceivingDashboard summary={result.data} />
    </div>
  );
}
