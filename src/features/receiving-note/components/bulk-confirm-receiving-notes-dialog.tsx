"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { previewBulkConfirmReceivingNotesAction } from "../actions/preview-bulk-confirm-receiving-notes.action";
import { bulkConfirmReceivingNotesAction } from "../actions/bulk-confirm-receiving-notes.action";
import type { BulkConfirmPreviewRow } from "../services/daily-receiving.service";

// ════════════════════════════════════════
// D30 Ex1: 일괄 확정 다이얼로그
//   1) 열림 → previewBulkConfirm 자동 호출 (dry-run)
//   2) 모든 row canConfirm=true 일 때만 "확정" 버튼 활성화
//   3) 확정 → bulkConfirmReceivingNotes 호출 → 성공 시 refresh + 닫힘
//
// UX 정책: 이번 청크는 노트별 사유 입력 UI 없이 그대로 확정.
//         불일치가 예상되는 노트는 개별 상세 페이지에서 확정하도록 안내.
// ════════════════════════════════════════

type NoteMeta = {
  receivingNoteId: string;
  orderNumber: string;
  supplierName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 확정 대상 note 들의 표시용 메타 정보 */
  notes: NoteMeta[];
};

export function BulkConfirmReceivingNotesDialog({
  open,
  onOpenChange,
  notes,
}: Props) {
  const router = useRouter();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<BulkConfirmPreviewRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isConfirming, startConfirming] = useTransition();

  // 다이얼로그가 열릴 때마다 프리뷰 실행
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const ids = notes.map((n) => n.receivingNoteId);
    if (ids.length === 0) return;

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);
    (async () => {
      const res = await previewBulkConfirmReceivingNotesAction({
        receivingNoteIds: ids,
      });
      if (cancelled) return;
      if (!res.success) {
        setPreviewError(res.error.message);
        setPreview(null);
      } else {
        setPreview(res.data);
      }
      setIsPreviewLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, notes]);

  const rowsWithMeta =
    preview?.map((r) => {
      const meta = notes.find((n) => n.receivingNoteId === r.receivingNoteId);
      return { ...r, meta };
    }) ?? [];

  const okCount = rowsWithMeta.filter((r) => r.canConfirm).length;
  const blockedCount = rowsWithMeta.length - okCount;
  const allOk = rowsWithMeta.length > 0 && blockedCount === 0;

  const handleConfirm = () => {
    if (!allOk) return;
    const ids = notes.map((n) => n.receivingNoteId);
    startConfirming(async () => {
      const res = await bulkConfirmReceivingNotesAction({
        receivingNoteIds: ids,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${res.data.length}건 확정되었습니다`);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>일괄 확정</DialogTitle>
          <DialogDescription>
            선택한 {notes.length}건의 입고서를 확정합니다. 하나라도 실패하면
            전체가 롤백됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto">
          {isPreviewLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              확정 가능 여부 확인 중...
            </div>
          )}

          {previewError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          {!isPreviewLoading && !previewError && preview && (
            <div className="space-y-2">
              {/* 요약 */}
              <div className="flex items-center gap-4 rounded-md bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-500">
                  총 <span className="font-semibold text-gray-900">{rowsWithMeta.length}</span>건
                </span>
                <span className="text-emerald-700">
                  확정 가능 <span className="font-semibold">{okCount}</span>건
                </span>
                {blockedCount > 0 && (
                  <span className="text-red-700">
                    차단됨 <span className="font-semibold">{blockedCount}</span>건
                  </span>
                )}
              </div>

              {/* 각 노트 상세 */}
              <ul className="divide-y rounded-md border bg-white">
                {rowsWithMeta.map((r) => (
                  <li
                    key={r.receivingNoteId}
                    className="flex items-start gap-3 px-3 py-2 text-sm"
                  >
                    {r.canConfirm ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="font-mono text-xs text-gray-500">
                          {r.meta?.orderNumber ?? r.receivingNoteId}
                        </span>
                        {r.meta?.supplierName && (
                          <span className="text-gray-700">
                            {r.meta.supplierName}
                          </span>
                        )}
                      </div>
                      {!r.canConfirm && r.blockingReason && (
                        <div className="mt-0.5 text-xs text-red-700">
                          {r.blockingReason}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {blockedCount > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  차단된 항목이 있어 확정할 수 없습니다. 해당 항목의 선택을
                  해제하거나, 개별 입고서 상세 페이지에서 원인을 해결한 뒤 다시
                  시도하세요.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allOk || isConfirming || isPreviewLoading}
          >
            {isConfirming && (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            )}
            {allOk ? `${okCount}건 확정` : "확정 불가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
