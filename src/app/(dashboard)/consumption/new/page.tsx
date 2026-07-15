import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buildConsumptionDraftAction } from "@/features/consumption/actions/build-consumption-draft.action";
import { ConsumptionDraftForm } from "@/features/consumption/components/consumption-draft-form";

export default async function CreateConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; locationId?: string }>;
}) {
  const { date, locationId } = await searchParams;

  // Case A: 쿼리 파라미터 없음 → 안내
  if (!date || !locationId) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          출고일자(date)와 공장(locationId) 쿼리 파라미터가 필요합니다.
          <br />
          예: <code>/consumption/new?date=2026-07-14&amp;locationId=...</code>
        </div>
      </div>
    );
  }

  // Case B: 초안 로드
  const result = await buildConsumptionDraftAction({ targetDate: date, locationId });

  if (!result.success) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <ConsumptionDraftForm
        draft={result.data}
        targetDate={date}
        locationId={locationId}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/consumption"
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
    >
      <ChevronLeft className="h-4 w-4" />
      사용 처리 목록
    </Link>
  );
}
