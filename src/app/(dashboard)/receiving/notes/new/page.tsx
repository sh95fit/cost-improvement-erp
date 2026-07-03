import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getPurchaseOrderByIdAction } from "@/features/purchase-order/actions/purchase-order.action";
import { listEligiblePOsForReceivingAction } from "@/features/receiving-note/actions/list-eligible-pos-for-receiving.action";
import { CreateReceivingNoteForm } from "@/features/receiving-note/components/create-receiving-note-form";
import { EligiblePOPicker } from "@/features/receiving-note/components/eligible-po-picker";

export default async function CreateReceivingNotePage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  const { poId } = await searchParams;

  // Case A: poId 있음 → PO 로드 후 폼
  if (poId) {
    const poResult = await getPurchaseOrderByIdAction(poId);
    if (!poResult.success) {
      return (
        <div className="space-y-4">
          <BackLink />
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {poResult.error.message}
          </div>
        </div>
      );
    }
    if (!poResult.data) {
      return (
        <div className="space-y-4">
          <BackLink />
          <div className="rounded-md border bg-white p-4 text-sm text-gray-600">
            발주서를 찾을 수 없습니다.
          </div>
        </div>
      );
    }
    // 서버 측 상태 재확인 (SUBMITTED 만 허용) — 사용자에게 명확한 안내
    if (poResult.data.status !== "SUBMITTED") {
      return (
        <div className="space-y-4">
          <BackLink />
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            이 발주서는 입고서 작성 대상이 아닙니다. (현재 상태: {poResult.data.status})
            <br />
            발주 확정(SUBMITTED) 상태인 발주만 입고서를 작성할 수 있습니다.
          </div>
        </div>
      );
    }
    // 이미 노트가 있으면 상세로 리다이렉트
    const existing = poResult.data.receivingNotes?.[0];
    if (existing) {
      redirect(`/receiving/notes/${existing.id}`);
    }

    return (
      <div className="space-y-4">
        <BackLink />
        <h1 className="text-2xl font-bold">새 입고서 작성</h1>
        <CreateReceivingNoteForm key={poResult.data.id} po={poResult.data} />
      </div>
    );
  }

  // Case B: poId 없음 → Eligible PO 선택 화면
  const listResult = await listEligiblePOsForReceivingAction({});
  if (!listResult.success) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listResult.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <h1 className="text-2xl font-bold">새 입고서 작성</h1>
      <p className="text-sm text-gray-500">
        입고서를 작성할 발주서를 선택하세요. 발주 확정(SUBMITTED) 상태이면서 아직 입고서가 없는 발주만 표시됩니다.
      </p>
      <EligiblePOPicker initialPOs={listResult.data} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/receiving"
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    >
      <ChevronLeft className="h-4 w-4" />
      입고 관리
    </Link>
  );
}
