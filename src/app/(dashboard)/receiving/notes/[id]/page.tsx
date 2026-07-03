import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getReceivingNoteByIdAction } from "@/features/receiving-note/actions/get-receiving-note.action";
import { ReceivingNoteDetail } from "@/features/receiving-note/components/receiving-note-detail";

export default async function ReceivingNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getReceivingNoteByIdAction(id);

  if (!result.success) {
    return (
      <div className="space-y-4">
        <Link
          href="/receiving/notes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          입고서 목록
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error.message}
        </div>
      </div>
    );
  }

  if (!result.data) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/receiving/notes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        입고서 목록
      </Link>
      <ReceivingNoteDetail note={result.data} />
    </div>
  );
}
