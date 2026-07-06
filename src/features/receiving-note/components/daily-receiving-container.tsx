"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import type { DailyReceivingBundle } from "../services/daily-receiving.service";
import { DailyReceivingHeader } from "./daily-receiving-header";
import { DailyReceivingPendingTable } from "./daily-receiving-pending-table";
import { DailyReceivingCompletedList } from "./daily-receiving-completed-list";
import { BulkConfirmReceivingNotesDialog } from "./bulk-confirm-receiving-notes-dialog";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 컨테이너
//   - 헤더(필터) + Pending 섹션 + Completed 섹션
//   - G-3a: Pending 테이블 + 초안 저장         ✅
//   - G-3b: 확정 프리뷰 다이얼로그 연결          ✅
//   - G-4 : Completed 읽기 전용 리스트           ✅ (이번 단계)
// ════════════════════════════════════════

type Props = {
  initialDate: string;
  initialMode: "outbound" | "expected";
  initialBundle: DailyReceivingBundle;
};

export function DailyReceivingContainer({
  initialDate,
  initialMode,
  initialBundle,
}: Props) {
  const [confirmTargetIds, setConfirmTargetIds] = useState<string[] | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const noteMetaByNoteId = useMemo(() => {
    const m = new Map<string, { orderNumber: string; supplierName: string }>();
    for (const p of initialBundle.pending) {
      if (p.existingDraft) {
        m.set(p.existingDraft.receivingNoteId, {
          orderNumber: p.purchaseOrder.orderNumber,
          supplierName: p.purchaseOrder.supplierName,
        });
      }
    }
    return m;
  }, [initialBundle.pending]);

  const dialogNotes =
    confirmTargetIds?.map((id) => ({
      receivingNoteId: id,
      orderNumber: noteMetaByNoteId.get(id)?.orderNumber ?? "(알수없음)",
      supplierName: noteMetaByNoteId.get(id)?.supplierName ?? "",
    })) ?? [];

  const handleRequestConfirm = (receivingNoteIds: string[]) => {
    setConfirmTargetIds(receivingNoteIds);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <DailyReceivingHeader
        date={initialDate}
        mode={initialMode}
        pendingCount={initialBundle.pending.length}
        completedCount={initialBundle.completed.length}
      />

      {/* Pending 섹션 */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Clock className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">확정 대기</h2>
          <span className="text-xs text-gray-500">
            ({initialBundle.pending.length}건)
          </span>
        </div>
        <DailyReceivingPendingTable
          date={initialDate}
          mode={initialMode}
          pending={initialBundle.pending}
          onRequestConfirm={handleRequestConfirm}
        />
      </section>

      {/* Completed 섹션 */}
      <DailyReceivingCompletedList completed={initialBundle.completed} />

      <BulkConfirmReceivingNotesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        notes={dialogNotes}
      />
    </div>
  );
}
