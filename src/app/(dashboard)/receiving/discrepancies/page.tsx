import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ReceivingDiscrepancyList } from "@/features/receiving-note/components/receiving-discrepancy-list";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function ReceivingDiscrepanciesPage({
  searchParams,
}: PageProps) {
  const { month } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/receiving"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          입고 관리
        </Link>
        <h1 className="mt-1 text-2xl font-bold">불일치 이력</h1>
        <p className="mt-1 text-sm text-gray-500">
          발주와 입고 간 수량·단가 차이 및 품목 누락 이력을 조회합니다.
        </p>
      </div>

      <ReceivingDiscrepancyList initialMonth={month} />
    </div>
  );
}
