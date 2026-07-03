"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmReceivingNoteAction } from "../actions/confirm-receiving-note.action";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receivingNoteId: string;
  receiveNumber: string;
  onSuccess: () => void;
};

export function ConfirmReceivingNoteDialog({
  open,
  onOpenChange,
  receivingNoteId,
  receiveNumber,
  onSuccess,
}: Props) {
  const [note, setNote] = useState("");
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ★ D30 C-3-d2: 다이얼로그가 닫힐 때 입력 필드 초기화
  //   (취소 후 다시 열었을 때 이전 사유가 남는 것을 방지)
  useEffect(() => {
    if (!open) {
      setNote("");
      setDiscrepancyReason("");
    }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await confirmReceivingNoteAction({
        receivingNoteId,
        note: note || undefined,
        discrepancyReason: discrepancyReason || undefined,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${receiveNumber} 입고 확정 완료`);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>입고 확정</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <strong>{receiveNumber}</strong> 입고서를 확정하시겠습니까?
              </p>
              <p className="text-red-600">
                확정 시 재고 로트가 생성되고 발주 상태가{" "}
                <strong>입고 완료</strong>로 자동 전이됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="discrepancyReason">
            불일치 사유 <span className="text-xs text-gray-400">(선택)</span>
          </Label>
          <Textarea
            id="discrepancyReason"
            placeholder="발주와 차이가 발생한 이유를 남겨주세요 (수량 부족·초과, 단가 차이 등에 공통 적용)"
            value={discrepancyReason}
            onChange={(e) => setDiscrepancyReason(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-gray-500">
            입력 시 확정과 동시에 발생하는 모든 불일치 항목에 동일 사유로 기록됩니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label>확정 메모 (선택)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="이 입고 확정에 대한 메모를 남겨주세요 (입고서 상세에서 확인 가능)"
            rows={3}
            maxLength={500}
          />
          <div className="text-xs text-gray-400">{note.length} / 500</div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? "확정 중..." : "확정"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
