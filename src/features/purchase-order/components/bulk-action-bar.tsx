// src/features/purchase-order/components/bulk-action-bar.tsx
"use client";

import { useState } from "react";
import { POStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { canTransitionPOStatus, PO_STATUS_LABELS } from "../schemas/purchase-order.schema";
import {
  bulkTransitionPOStatusAction,
  type BulkTransitionResult,
} from "../actions/bulk-transition-po-status.action";

type Props = {
  selectedRows: Array<{ id: string; status: POStatus }>;
  onCompleted: () => void;     // 일괄 액션 완료 후 목록 새로고침
  onClearSelection: () => void; // 선택 초기화
};

export function BulkActionBar({ selectedRows, onCompleted, onClearSelection }: Props) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (selectedRows.length === 0) return null;

  // 모든 선택 행이 toStatus 로 전이 가능해야 활성 (혼합 선택 시 안전한 공통 액션만 활성)
  const canBulkSubmit = selectedRows.every(
    (r) => r.status === "SUBMITTED" || canTransitionPOStatus(r.status, "SUBMITTED"),
  );
  const canBulkReceive = selectedRows.every(
    (r) => r.status === "RECEIVED" || canTransitionPOStatus(r.status, "RECEIVED"),
  );
  const canBulkCancel = selectedRows.every(
    (r) => r.status === "CANCELLED" || canTransitionPOStatus(r.status, "CANCELLED"),
  );

  async function run(toStatus: POStatus, reason?: string) {
    setBusy(true);
    try {
      const result = await bulkTransitionPOStatusAction({
        ids: selectedRows.map((r) => r.id),
        toStatus,
        cancelReason: reason,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      const r: BulkTransitionResult = result.data;
      if (r.failedCount > 0) {
        toast.error(
          `일괄 처리 일부 실패: 성공 ${r.successCount}, 변동 없음 ${r.skippedCount}, 실패 ${r.failedCount}.\n` +
            r.failures.slice(0, 3).map((f) => `· ${f.message}`).join("\n") +
            (r.failures.length > 3 ? `\n외 ${r.failures.length - 3}건` : ""),
        );
      } else {
        toast.success(
          `일괄 처리 완료: 성공 ${r.successCount}건` +
            (r.skippedCount > 0 ? `, 변동 없음 ${r.skippedCount}건` : ""),
        );
      }

      onClearSelection();
      onCompleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border bg-amber-50 px-4 py-2 text-sm">
        <span className="font-medium">{selectedRows.length}건 선택</span>
        <div className="ml-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canBulkSubmit || busy}
            onClick={() => run("SUBMITTED")}
          >
            선택 발주 확정
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canBulkReceive || busy}
            onClick={() => run("RECEIVED")}
          >
            선택 입고 완료
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!canBulkCancel || busy}
            onClick={() => setCancelOpen(true)}
          >
            선택 취소
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClearSelection}>
          선택 해제
        </Button>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 {selectedRows.length}건을 취소합니다</AlertDialogTitle>
            <AlertDialogDescription>
              취소 사유를 입력하세요. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="취소 사유 (필수)"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>닫기</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !cancelReason.trim()}
              onClick={() => {
                run("CANCELLED", cancelReason.trim());
                setCancelOpen(false);
                setCancelReason("");
              }}
            >
              취소 처리
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
