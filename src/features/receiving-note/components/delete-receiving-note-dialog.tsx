"use client";

import { useState } from "react";
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
import { deleteReceivingNoteDraftAction } from "../actions/delete-receiving-note-draft.action";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receivingNoteId: string;
  receiveNumber: string;
  onSuccess: () => void;
};

export function DeleteReceivingNoteDialog({
  open,
  onOpenChange,
  receivingNoteId,
  receiveNumber,
  onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await deleteReceivingNoteDraftAction({ receivingNoteId });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${receiveNumber} 삭제 완료`);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>입고서 초안 삭제</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <strong>{receiveNumber}</strong> 초안을 삭제하시겠습니까?
              </p>
              <p className="text-red-600">
                이 작업은 되돌릴 수 없습니다. 발주서는 SUBMITTED 상태로 유지되며 새 입고서를 다시 작성할 수 있습니다.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={submitting}
          >
            {submitting ? "삭제 중..." : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
