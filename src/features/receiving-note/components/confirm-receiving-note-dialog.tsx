"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils/format";
import {
  DISCREPANCY_TYPE_LABELS,
  DISCREPANCY_TYPE_BADGE_COLOR,
} from "../schemas/receiving-note.schema";
import { confirmReceivingNoteAction } from "../actions/confirm-receiving-note.action";
import { previewReceivingDiscrepanciesAction } from "../actions/preview-receiving-discrepancies.action";
import type { ReceivingDiscrepancyPreview } from "../services/receiving-note.service";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receivingNoteId: string;
  receiveNumber: string;
  onSuccess: () => void;
};

/** 배지 색상 클래스 매핑 (인라인 색상 대신 tailwind 정적 클래스 유지) */
const BADGE_CLASS: Record<string, string> = {
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-gray-100 text-gray-800",
};

export function ConfirmReceivingNoteDialog({
  open,
  onOpenChange,
  receivingNoteId,
  receiveNumber,
  onSuccess,
}: Props) {
  // 확정 시 저장할 값들
  const [note, setNote] = useState("");
  const [unifiedReason, setUnifiedReason] = useState("");
  const [perKeyReason, setPerKeyReason] = useState<Record<string, string>>({});
  const [useUnified, setUseUnified] = useState(false);

  // 프리뷰 상태
  const [previews, setPreviews] = useState<ReceivingDiscrepancyPreview[] | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // 제출 상태
  const [submitting, setSubmitting] = useState(false);

  // ★ 다이얼로그가 닫힐 때 전체 상태 초기화
  useEffect(() => {
    if (!open) {
      setNote("");
      setUnifiedReason("");
      setPerKeyReason({});
      setUseUnified(false);
      setPreviews(null);
      setPreviewError(null);
    }
  }, [open]);

  // ★ 다이얼로그가 열릴 때 프리뷰 로드
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await previewReceivingDiscrepanciesAction({ receivingNoteId });
      if (!res.success) {
        setPreviewError(res.error.message);
        setPreviews(null);
      } else {
        setPreviews(res.data);
      }
    } catch (_err) {
      setPreviewError("불일치 미리보기 조회 중 오류가 발생했습니다.");
      setPreviews(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [receivingNoteId]);

  useEffect(() => {
    if (open) {
      void loadPreview();
    }
  }, [open, loadPreview]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      // 제출 payload 결정
      //  - 통일 사유 모드: discrepancyReason 만 전송
      //  - 개별 사유 모드: discrepancyReasons 만 전송 (빈 값은 서버에서 무시)
      const payload: {
        receivingNoteId: string;
        note?: string;
        discrepancyReason?: string;
        discrepancyReasons?: Record<string, string>;
      } = {
        receivingNoteId,
        note: note || undefined,
      };

      if (useUnified) {
        payload.discrepancyReason = unifiedReason || undefined;
      } else {
        // 빈 문자열은 제외해서 전송량 절약
        const filtered: Record<string, string> = {};
        for (const [k, v] of Object.entries(perKeyReason)) {
          const trimmed = v.trim();
          if (trimmed) filtered[k] = trimmed;
        }
        if (Object.keys(filtered).length > 0) {
          payload.discrepancyReasons = filtered;
        }
      }

      const res = await confirmReceivingNoteAction(payload);
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

  const hasDiscrepancies = (previews?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>입고 확정</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <strong>{receiveNumber}</strong> 입고서를 확정하시겠습니까?
              </p>
              <p className="text-red-600">
                확정 시 재고 로트가 생성되고 발주 상태가{" "}
                <strong>입고 완료</strong>로 자동 전이됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* ═══════ 프리뷰 섹션 ═══════ */}
        {previewLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            불일치 미리 계산 중...
          </div>
        )}

        {!previewLoading && previewError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="flex items-start gap-2 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">불일치 미리보기를 불러오지 못했습니다.</p>
                <p className="mt-1 text-xs">
                  {previewError} — 통일 사유 입력으로 진행할 수 있습니다.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label>불일치 사유 (선택, 전 항목에 동일 적용)</Label>
              <Textarea
                value={unifiedReason}
                onChange={(e) => {
                  setUnifiedReason(e.target.value);
                  setUseUnified(true);
                }}
                placeholder="발주와 차이가 발생한 이유를 남겨주세요"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
        )}

        {!previewLoading && !previewError && previews && !hasDiscrepancies && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            발주와 입고 내용이 완전히 일치합니다. 불일치 사유 입력 없이 확정합니다.
          </div>
        )}

        {!previewLoading && !previewError && previews && hasDiscrepancies && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  이 확정 시 <strong>{previews.length}건</strong>의 불일치가 기록됩니다.
                  각 항목의 사유를 입력하세요 (모두 선택 사항).
                </p>
              </div>
            </div>

            {/* 통일 사유 모드 토글 */}
            <div className="flex items-center gap-2 border-b pb-3">
              <Checkbox
                id="useUnified"
                checked={useUnified}
                onCheckedChange={(v) => setUseUnified(v === true)}
              />
              <Label htmlFor="useUnified" className="cursor-pointer text-sm">
                모든 항목에 동일한 사유 적용
              </Label>
            </div>

            {/* 통일 사유 입력 (모드 활성화 시) */}
            {useUnified && (
              <div className="space-y-2 rounded-md bg-gray-50 p-3">
                <Label>통일 사유</Label>
                <Textarea
                  value={unifiedReason}
                  onChange={(e) => setUnifiedReason(e.target.value)}
                  placeholder="아래 {previews.length}건의 불일치에 모두 동일 사유로 적용됩니다"
                  rows={3}
                  maxLength={500}
                />
              </div>
            )}

            {/* 항목별 목록 */}
            <div className="space-y-2">
              {previews.map((p) => {
                const badgeColor = DISCREPANCY_TYPE_BADGE_COLOR[p.type];
                const badgeClass = BADGE_CLASS[badgeColor] ?? BADGE_CLASS.gray;
                return (
                  <div
                    key={p.key}
                    className={`rounded-md border p-3 ${useUnified ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {DISCREPANCY_TYPE_LABELS[p.type]}
                      </span>
                      <span className="font-medium">{p.itemName}</span>
                    </div>

                    {/* 발주 vs 입고 요약 */}
                    <div className="mt-2 text-xs text-gray-600">
                      <DiscrepancyDetail preview={p} />
                    </div>

                    {/* 개별 사유 입력 */}
                    {!useUnified && (
                      <Textarea
                        className="mt-2 text-sm"
                        value={perKeyReason[p.key] ?? ""}
                        onChange={(e) =>
                          setPerKeyReason((prev) => ({
                            ...prev,
                            [p.key]: e.target.value,
                          }))
                        }
                        placeholder={
                          p.autoReason ??
                          "이 항목의 불일치 사유를 남겨주세요 (선택)"
                        }
                        rows={2}
                        maxLength={500}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ 확정 메모 (공통) ═══════ */}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="note">확정 메모 (선택)</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="이 입고 확정에 대한 메모를 남겨주세요 (입고서 상세에서 확인 가능)"
            rows={2}
            maxLength={500}
          />
          <div className="text-xs text-gray-400">{note.length} / 500</div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || previewLoading}
          >
            {submitting ? "확정 중..." : "확정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 각 불일치의 발주값 vs 입고값 상세 표시.
 * type 별로 어떤 필드를 강조할지 다름.
 */
function DiscrepancyDetail({
  preview,
}: {
  preview: ReceivingDiscrepancyPreview;
}) {
  const { type, expectedQty, actualQty, expectedUnitPrice, actualUnitPrice, diffValue } = preview;

  if (type === "QUANTITY_SHORT" || type === "QUANTITY_OVER") {
    return (
      <span>
        발주 <strong>{expectedQty}</strong> → 입고 <strong>{actualQty}</strong>
        <span className={diffValue < 0 ? "ml-2 text-red-600" : "ml-2 text-amber-600"}>
          ({diffValue > 0 ? "+" : ""}
          {diffValue})
        </span>
      </span>
    );
  }

  if (type === "UNIT_PRICE_DIFF") {
    return (
      <span>
        단가 {formatCurrency(expectedUnitPrice)} → {formatCurrency(actualUnitPrice)}
        <span className="ml-2 text-blue-600">
          ({diffValue > 0 ? "+" : ""}
          {formatCurrency(diffValue)})
        </span>
      </span>
    );
  }

  // ITEM_MISSING (양방향)
  if (expectedQty == null && actualQty != null) {
    return (
      <span>
        발주에 없음 · 입고 <strong>{actualQty}</strong> ({formatCurrency(actualUnitPrice)})
      </span>
    );
  }
  return (
    <span>
      발주 <strong>{expectedQty}</strong> · 입고되지 않음
    </span>
  );
}
