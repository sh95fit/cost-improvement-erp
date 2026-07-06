"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { DailyReceivingBundle } from "../services/daily-receiving.service";
import { DailyReceivingHeader } from "./daily-receiving-header";
import { DailyReceivingPendingTable } from "./daily-receiving-pending-table";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 컨테이너
//   - 헤더(필터) + Pending 테이블 + Completed 리스트를 조립
//   - G-3a: Pending 테이블 연결 (저장 완료)
//   - G-3b: 확정 프리뷰 다이얼로그 연결 (다음 단계)
//   - G-4 : Completed 리스트 (다음 단계)
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
  // 확정 프리뷰 대상 noteIds (G-3b 에서 다이얼로그 오픈에 사용)
  const [confirmTargetIds, setConfirmTargetIds] = useState<string[] | null>(
    null,
  );

  const handleRequestConfirm = (receivingNoteIds: string[]) => {
    // TODO(G-3b): 프리뷰 다이얼로그 오픈
    setConfirmTargetIds(receivingNoteIds);
    toast.info(
      `확정 대상 ${receivingNoteIds.length}건 준비됨 (다음 단계에서 다이얼로그 연결).`,
    );
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

      {/* 임시 표시 — G-3b 완성 시 다이얼로그로 대체 */}
      {confirmTargetIds && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
          [디버그] 확정 대상 noteIds: {confirmTargetIds.join(", ")}
        </div>
      )}
    </div>
  );
}
