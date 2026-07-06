"use client";

import { useMemo, useState } from "react";
import type { DailyReceivingBundle } from "../services/daily-receiving.service";
import { DailyReceivingHeader } from "./daily-receiving-header";
import { DailyReceivingPendingTable } from "./daily-receiving-pending-table";
import { BulkConfirmReceivingNotesDialog } from "./bulk-confirm-receiving-notes-dialog";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 컨테이너
//   - 헤더(필터) + Pending 테이블 + (예정) Completed 리스트
//   - G-3a: Pending 테이블 + 초안 저장  ✅
//   - G-3b: 확정 프리뷰 다이얼로그 연결   ✅ (이번 단계)
//   - G-4 : Completed 리스트             (다음 단계)
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

  // note id → { orderNumber, supplierName } 메타 매핑
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
    <div className="space-y-4">
      <DailyReceivingHeader
        date={initialDate}
        mode={initialMode}
        pendingCount={initialBundle.pending.length}
        completedCount={initialBundle.completed.length}
      />

      <DailyReceivingPendingTable
        date={initialDate}
        pending={initialBundle.pending}
        onRequestConfirm={handleRequestConfirm}
      />

      {/* TODO(G-4): Completed 리스트 */}
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500">
        완료 목록 UI는 다음 단계(G-4)에서 추가됩니다. (현재{" "}
        {initialBundle.completed.length}건)
      </div>

      <BulkConfirmReceivingNotesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        notes={dialogNotes}
      />
    </div>
  );
}
