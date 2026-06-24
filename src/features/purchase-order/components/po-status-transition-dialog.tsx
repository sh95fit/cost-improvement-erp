"use client";

import { useEffect, useState } from "react";
import type { POStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PO_STATUS_LABELS,
  getNextAllowedStatuses,
} from "../schemas/purchase-order.schema";
import { transitionPurchaseOrderStatusAction } from "../actions/purchase-order.action";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  poId: string;
  orderNumber: string;
  currentStatus: POStatus;
  onSuccess: () => void;
};

export function POStatusTransitionDialog({
  open,
  onOpenChange,
  poId,
  orderNumber,
  currentStatus,
  onSuccess,
}: Props) {
  const nextOptions = getNextAllowedStatuses(currentStatus);
  const [toStatus, setToStatus] = useState<POStatus | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 다이얼로그가 열릴 때마다 초기화
  useEffect(() => {
    if (open) {
      setToStatus(nextOptions[0] ?? "");
      setReason("");
    }
  }, [open, nextOptions]);

  const requiresReason = toStatus === "CANCELLED";

  const handleSubmit = async () => {
    if (!toStatus) {
      toast.error("변경할 상태를 선택하세요");
      return;
    }
    if (requiresReason && reason.trim().length === 0) {
      toast.error("취소 사유를 입력하세요");
      return;
    }

    setSubmitting(true);
    try {
      const res = await transitionPurchaseOrderStatusAction(poId, {
        toStatus,
        reason: requiresReason ? reason.trim() : undefined,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `${orderNumber} → ${PO_STATUS_LABELS[toStatus as POStatus]} 변경 완료`
      );
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  if (nextOptions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>발주 상태 변경</DialogTitle>
          <DialogDescription>
            {orderNumber} · 현재 상태:{" "}
            <strong>{PO_STATUS_LABELS[currentStatus]}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>변경할 상태</Label>
            <Select
              value={toStatus}
              onValueChange={(v) => setToStatus(v as POStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                {nextOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PO_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresReason && (
            <div className="space-y-2">
              <Label>
                취소 사유 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="취소 사유를 입력하세요 (감사 로그에 기록됩니다)"
                rows={3}
                maxLength={500}
              />
              <div className="text-xs text-gray-400">{reason.length} / 500</div>
            </div>
          )}

          {toStatus === "SUBMITTED" && (
            <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
              발주 등록 시 공급업체별 단가 변경 이력이 자동으로 기록됩니다.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !toStatus}>
            {submitting ? "처리 중..." : "변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
