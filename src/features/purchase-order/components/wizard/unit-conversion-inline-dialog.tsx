"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createUnitConversionAction } from "@/features/unit-conversion/actions/unit-conversion.action";

export interface ConversionRegisteredPayload {
  materialMasterId: string;
  fromUnit: string;
  factor: number;
}

interface Props {
  open: boolean;
  materialMasterId: string;
  materialName: string;
  /** 추천 fromUnit (없으면 빈 문자열) */
  suggestedFromUnit: string;
  onClose: () => void;
  onSuccess: (payload: ConversionRegisteredPayload) => void;
}

export function UnitConversionInlineDialog({
  open,
  materialMasterId,
  materialName,
  suggestedFromUnit,
  onClose,
  onSuccess,
}: Props) {
  const [fromUnit, setFromUnit] = useState(suggestedFromUnit);
  const [factor, setFactor] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 다이얼로그 열릴 때마다 입력값 초기화
  useEffect(() => {
    if (open) {
      setFromUnit(suggestedFromUnit);
      setFactor("");
    }
  }, [open, suggestedFromUnit]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, isSubmitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFromUnit = fromUnit.trim();
    if (!trimmedFromUnit) {
      toast.error("변환 전 단위는 필수입니다");
      return;
    }
    const factorNum = Number(factor);
    if (!Number.isFinite(factorNum) || factorNum <= 0) {
      toast.error("환산 계수는 0보다 큰 숫자여야 합니다");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createUnitConversionAction({
        materialMasterId,
        subsidiaryMasterId: null,
        fromUnit: trimmedFromUnit,
        toUnit: "g",
        factor: factorNum,
        unitCategory: "WEIGHT",
      });

      if (!res.success) {
        toast.error(res.error.message);
        return;
      }

      toast.success(`단위 환산 등록 완료: 1 ${trimmedFromUnit} = ${factorNum} g`);
      onSuccess({
        materialMasterId,
        fromUnit: trimmedFromUnit,
        factor: factorNum,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "단위 환산 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        // 배경 클릭 시 닫기 (다이얼로그 내부 클릭은 제외)
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-[420px] rounded-md bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-gray-900">단위 환산 등록</h3>
        <p className="mt-1 text-xs text-gray-600">
          자재: <span className="font-medium">{materialName}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          예: 1 포 = 1000 g 이면 변환 전 단위 = "포", 환산 계수 = 1000
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              변환 전 단위
            </label>
            <input
              type="text"
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              placeholder="예: 포, kg, L"
              maxLength={20}
              disabled={isSubmitting}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">
                환산 계수
              </label>
              <input
                type="number"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                placeholder="예: 1000"
                step="0.0001"
                min={0}
                disabled={isSubmitting}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="pt-5 text-xs text-gray-500">
              → <span className="font-medium">g</span>
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            * 변환 후 단위는 <span className="font-medium">g</span> 로 고정됩니다.
            <br />* 분류는 <span className="font-medium">WEIGHT(중량)</span> 로 자동 설정됩니다.
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
