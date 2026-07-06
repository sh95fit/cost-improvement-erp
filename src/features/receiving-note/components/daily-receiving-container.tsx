"use client";

import type { DailyReceivingBundle } from "../services/daily-receiving.service";
import { DailyReceivingHeader } from "./daily-receiving-header";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 컨테이너
//   - 상단 헤더(필터/카운트) + Pending 테이블 + Completed 리스트를 조립
//   - 현재는 G-1/G-2 뼈대. G-3(Pending) / G-4(Completed) 는 다음 청크에서 추가
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
  return (
    <div className="space-y-4">
      <DailyReceivingHeader
        date={initialDate}
        mode={initialMode}
        pendingCount={initialBundle.pending.length}
        completedCount={initialBundle.completed.length}
      />

      {/* TODO(G-3): Pending 테이블 */}
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500">
        대기 목록 UI는 다음 단계(G-3)에서 추가됩니다. (현재{" "}
        {initialBundle.pending.length}건)
      </div>

      {/* TODO(G-4): Completed 리스트 */}
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500">
        완료 목록 UI는 다음 단계(G-4)에서 추가됩니다. (현재{" "}
        {initialBundle.completed.length}건)
      </div>
    </div>
  );
}
