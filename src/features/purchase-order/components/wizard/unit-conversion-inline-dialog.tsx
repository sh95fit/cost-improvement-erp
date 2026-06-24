"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createUnitConversionAction } from "@/features/unit-conversion/actions/unit-conversion.action";
import { UnitCombobox } from "@/features/unit-master/components/unit-combobox";

export interface ConversionRegisteredPayload {
  materialMasterId: string;
  fromUnit: string;
  factor: number;
}

interface Props {
  open: boolean;
  materialMasterId: string;
  materialName: string;
  /** 추천 fromUnit (없으면 빈 문자열) — UnitMaster.code 기준 */
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
  // ★ Phase 1.7 (D16-2): UnitCombobox 가 unit 객체를 함께 전달 → unitCategory 자동 도출
  const [fromUnitCategory, setFromUnitCategory] = useState<string | null>(null);
  const [factor, setFactor] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 다이얼로그 열릴 때마다 입력값 초기화
  useEffect(() => {
    if (open) {
      setFromUnit(suggestedFromUnit);
      setFromUnitCategory(null);
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

    // ★ Phase 1.7 (D16-1): UnitMaster 미선택 시 차단
    if (!fromUnit) {
      toast.error("변환 전 단위를 단위 관리에서 선택하세요");
      return;
    }

    // ★ D17-10: suggestedFromUnit 이 명시되어 있는데 사용자가 다른 단위로 바꾼 경우 차단
    //    (UnitCombobox 가 자유 선택을 허용하므로 서버 도달 전에 한 번 더 검증)
    if (suggestedFromUnit && fromUnit !== suggestedFromUnit) {
      toast.error(
        `이 자재의 공급단위는 '${suggestedFromUnit}'입니다. ` +
          `다른 단위로 환산을 등록할 수 없습니다.\n` +
          `(공급단위 자체를 바꾸려면 공급업체ㆍ품목 정보에서 supplyUnit을 수정하세요)`,
      );
      return;
    }    

    // ★ Phase 1.7 (D16-4'): 카테고리 제약 없음
    //   현장 시나리오: 포장단위(PACKAGE)→g, ml(VOLUME)→g 도 자재별 비중으로 자유 환산
    //   (toUnit='g' 고정은 유지 — 자재 환산 체인이 g 기준)

    const factorNum = Number(factor);
    if (!Number.isFinite(factorNum) || factorNum <= 0) {
      toast.error("환산 계수는 0보다 큰 숫자여야 합니다");
      return;
    }
    
    // ★ D17-9: factor 입력 가드 (오타로 인한 발주량 부풀림 방지)
    // 1) 비현실적으로 큰 값 차단
    if (factorNum > 100000) {
      toast.error(
        `환산 계수 ${factorNum}이(가) 너무 큽니다. 단위를 확인해 주세요. ` +
          `(예: 1 kg = 1000 g)`,
      );
      return;
    }
    // 2) toUnit='g' 환산에서 비정수 입력은 명시적 확인 요구
    //    (대부분의 무게/포장 환산은 정수 — 1000.0001 같은 오타 차단 목적)
    if (!Number.isInteger(factorNum)) {
      const ok = window.confirm(
        `환산 계수 ${factorNum}은(는) 정수가 아닙니다.\n` +
          `대부분의 단위 환산은 정수입니다 (예: 1 kg = 1000 g, 1 포 = 1000 g).\n` +
          `오타가 아닌지 다시 확인해 주세요.\n\n계속 진행하시겠습니까?`,
      );
      if (!ok) return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await createUnitConversionAction({
        materialMasterId,
        subsidiaryMasterId: null,
        fromUnit,
        toUnit: "g",
        factor: factorNum,
        // ★ Phase 1.7 (D16-4'): fromUnit 마스터의 카테고리를 그대로 사용
        //   카테고리 제약 없이 자유 환산 — 자재별 비중·포장 단위 환산 지원
        //   미선택(타입 안전 fallback) 시 WEIGHT 기본값 (실질적으로는 도달 안 함)
        unitCategory: (fromUnitCategory ?? "WEIGHT") as
          | "WEIGHT"
          | "VOLUME"
          | "COUNT"
          | "LENGTH"
          | "PACKAGE",
      });

      if (!res.success) {
        // ★ D17-10: 중복 환산은 "이미 등록 완료"로 해석하고 onSuccess 트리거
        //    (DB에 이미 있는데 화면이 안 읽은 케이스 — REFRESH_ROW_AFTER_CONVERSION 으로 재계산)
        //    ActionFailure 타입은 { code, message } 만 노출(details 없음) → code 로 판별.
        //    (서버: handleActionError(new Error("DUPLICATE_CONVERSION"), ...,
        //      { DUPLICATE_CONVERSION: "이미 등록된 단위 환산입니다" })
        //     → actionFail("DUPLICATE_CONVERSION", "이미 등록된 단위 환산입니다"))
        const isDuplicate =
          res.error.code === "DUPLICATE_CONVERSION" ||
          res.error.message?.includes("이미 등록");
        if (isDuplicate) {
          toast.info(
            `이미 등록된 환산입니다. 화면을 갱신합니다.\n` +
              `(1 ${fromUnit} = ${factorNum} g 기준으로 재계산)`,
          );
          onSuccess({
            materialMasterId,
            fromUnit,
            factor: factorNum,
          });
          onClose();
          return;
        }
        toast.error(res.error.message);
        return;
      }

      toast.success(`단위 환산 등록 완료: 1 ${fromUnit} = ${factorNum} g`);
      onSuccess({
        materialMasterId,
        fromUnit,
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
      <div className="w-[440px] rounded-md bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-gray-900">단위 환산 등록</h3>
        <p className="mt-1 text-xs text-gray-600">
          자재: <span className="font-medium">{materialName}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          예: 1 포 = 1000 g 이면 변환 전 단위 = "포", 환산 계수 = 1000
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* ★ Phase 1.7 (D16-1, D16-3): UnitCombobox 통합 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">
              변환 전 단위
            </label>
            <div className="mt-1">
              <UnitCombobox
                value={fromUnit}
                onChange={(v, unit) => {
                  setFromUnit(v);
                  setFromUnitCategory(unit?.unitCategory ?? null);
                }}
                itemType="MATERIAL"
                valueMode="code"
                placeholder="예: 포, kg, L (단위 코드)"
                disabled={isSubmitting}
                excludeValue="g"
                emptyHint="등록된 자재 단위가 없습니다"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              * 단위 관리에 등록된 단위만 선택할 수 있습니다.
            </p>
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

          {/* ★ Phase 1.7 (D16-2, D16-4'): 단위 카테고리 자동 표시 (정보용, 제약 없음) */}
          {fromUnit && fromUnitCategory && (
            <p className="text-[11px] text-gray-500">
              단위 분류:{" "}
              <span className="font-medium text-gray-700">
                {fromUnitCategory}
              </span>
              <span className="ml-1 text-gray-400">
                (선택한 단위 마스터에서 자동 도출)
              </span>
            </p>
          )}

          <p className="text-[11px] text-gray-500">
            * 변환 후 단위는 <span className="font-medium">g</span> 로 고정됩니다.
            <br />* 포장단위·부피 단위도 g 으로 자유 환산 가능합니다 (예: 1 포 = 1000 g, 1 ml = 0.92 g).
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
              disabled={isSubmitting || !fromUnit || !factor}
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
