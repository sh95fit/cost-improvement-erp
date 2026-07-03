"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ReceivingNoteList } from "@/features/receiving-note/components/receiving-note-list";

export default function ReceivingNotesListPage() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/receiving"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          입고 관리
        </Link>
        <h1 className="mt-1 text-2xl font-bold">입고서 목록</h1>
      </div>

      <ReceivingNoteList
        onNew={() => router.push("/receiving/notes/new")}
        onSelect={(rn) => router.push(`/receiving/notes/${rn.id}`)}
      />
    </div>
  );
}
