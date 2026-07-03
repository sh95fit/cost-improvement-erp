import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getReceivingNoteByIdAction } from "@/features/receiving-note/actions/get-receiving-note.action";
import { getPurchaseOrderByIdAction } from "@/features/purchase-order/actions/purchase-order.action";
import { CreateReceivingNoteForm } from "@/features/receiving-note/components/create-receiving-note-form";

export default async function EditReceivingNoteDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const noteResult = await getReceivingNoteByIdAction(id);
  if (!noteResult.success) {
    return (
      <div className="space-y-4">
        <BackLink href={`/receiving/notes/${id}`} />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {noteResult.error.message}
        </div>
      </div>
    );
  }
  if (!noteResult.data) notFound();

  const note = noteResult.data;

  // DRAFT 아니면 상세로 리다이렉트 안내
  if (note.status !== "DRAFT") {
    return (
      <div className="space-y-4">
        <BackLink href={`/receiving/notes/${id}`} />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          이미 확정된 입고서는 수정할 수 없습니다.{" "}
          <Link href={`/receiving/notes/${id}`} className="text-blue-600 hover:underline">
            상세로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // PO 로드 (편집 폼이 필요한 shape)
  const poResult = await getPurchaseOrderByIdAction(note.purchaseOrder.id);
  if (!poResult.success || !poResult.data) {
    return (
      <div className="space-y-4">
        <BackLink href={`/receiving/notes/${id}`} />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          발주서를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  const initialReceivedDate = (() => {
    const d = new Date(note.receivedDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="space-y-4">
      <BackLink href={`/receiving/notes/${id}`} />
      <h1 className="text-2xl font-bold">
        입고서 초안 수정{" "}
        <span className="ml-2 font-mono text-lg text-gray-500">
          {note.receiveNumber}
        </span>
      </h1>
      <CreateReceivingNoteForm
        mode="edit"
        po={poResult.data}
        receivingNoteId={note.id}
        initialReceivedDate={initialReceivedDate}
        initialNote={note.note ?? ""}
        initialLines={note.items.map((it) => ({
          purchaseOrderItemId: it.purchaseOrderItemId,
          receivedQty: Number(it.receivedQty),
          unitPrice: Number(it.unitPrice),
        }))}
      />
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    >
      <ChevronLeft className="h-4 w-4" />
      돌아가기
    </Link>
  );
}
