"use client";

import { Info } from "lucide-react";

export type WizardMode = "NEW" | "DELTA" | "REPLACE";

interface ModeOption {
  value: WizardMode;
  label: string;
  description: string;
  enabled: boolean;
  comingSoonLabel?: string;
}

interface Props {
  value: WizardMode;
  onChange: (mode: WizardMode) => void;
  /**
   * 활성 PO 카운트 (CANCELLED 제외).
   * 백엔드 getExistingPOsForMealPlanGroupAction이 이미 CANCELLED를 필터링해 내려주므로
   * 이 값이 곧 활성 PO 카운트와 동일하다.
   * 0 이면 컴포넌트 자체를 렌더하지 않음 (호출부에서 검사해도 무방).
   */
  existingPOCount: number;
  /** ★ R1-b3: 상태별 카운트 — 모드 가용성 판정에 사용 */
  draftCount: number;
  submittedCount: number;
  /** APPROVED + RECEIVED 합산 */
  lockedCount: number;
}

export function WizardModeSelector({
  value,
  onChange,
  existingPOCount,
  draftCount,
  submittedCount,
  lockedCount,
}: Props) {
  if (existingPOCount === 0) return null;

  // DELTA 는 DRAFT 또는 SUBMITTED 가 1건이라도 있어야 가능
  const deltaEnabled = draftCount + submittedCount > 0;
  // ★ R1-b4: REPLACE 는 DRAFT/SUBMITTED 가 1건이라도 있고, APPROVED 이상이 섞이지 않아야 가능
  const replaceEnabled = draftCount + submittedCount > 0 && lockedCount === 0;

  // ★ D18 (R1-b5-1): 활성 PO 가 존재할 때(=이 컴포넌트가 렌더되는 시점)는
  //   NEW 옵션을 노출하지 않는다. NEW 발주는 멱등성 키((mealPlanGroupId, outboundDate))
  //   충돌로 어차피 실패하므로 사용자를 막다른 길로 안내하지 않는다.
  //   식단 외 발주는 Phase 4-D 수동 발주 트랙(/purchase-orders/manual)에서 처리한다.
  const options: ModeOption[] = [
    {
      value: "DELTA",
      label: "차분 발주",
      description: deltaEnabled
        ? `기존 작성중·발주등록 PO와 비교해 변경된 수량만큼 자동 갱신하고 변경 이력을 적층합니다. (대상 ${draftCount + submittedCount}건)`
        : "변경 가능한 작성중·발주등록 PO가 없어 사용할 수 없습니다.",
      enabled: deltaEnabled,
    },
    {
      value: "REPLACE",
      label: "덮어쓰기 발주",
      description: replaceEnabled
        ? `기존 작성중·발주등록 PO를 모두 취소하고 새 발주서로 대체합니다. (대상 ${draftCount + submittedCount}건)`
        : lockedCount > 0
          ? "발주확정 이상 상태의 PO가 있어 덮어쓸 수 없습니다. 차분 발주(DELTA)로 진행하거나 해당 PO를 먼저 취소하세요."
          : "작성중·발주등록 PO가 없어 사용할 수 없습니다.",
      enabled: replaceEnabled,
    },
  ];

  return (
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-blue-700" />
        <p className="text-sm font-medium text-blue-900">
          기존 발주서가 {existingPOCount}건 있습니다 — 진행 방식을 선택하세요
        </p>
      </div>

      <div className="grid gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const isDisabled = !opt.enabled;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                isDisabled
                  ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                  : isSelected
                  ? "border-blue-500 bg-white ring-2 ring-blue-200"
                  : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              <input
                type="radio"
                name="wizard-mode"
                value={opt.value}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => opt.enabled && onChange(opt.value)}
                className="mt-0.5 h-4 w-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      isDisabled ? "text-gray-500" : "text-gray-900"
                    }`}
                  >
                    {opt.label}
                  </span>
                  {opt.comingSoonLabel && (
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      {opt.comingSoonLabel}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 text-xs ${
                    isDisabled ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {opt.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export const MODE_LABEL: Record<WizardMode, string> = {
  NEW: "신규 발주",
  DELTA: "차분 발주",
  REPLACE: "덮어쓰기 발주",
};
