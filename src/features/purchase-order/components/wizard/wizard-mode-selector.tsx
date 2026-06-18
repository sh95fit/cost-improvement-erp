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

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "NEW",
    label: "신규 발주",
    description:
      "기존 발주서와 별개로 새 발주서를 추가 생성합니다. 식단 외 추가 자재가 필요할 때 사용합니다.",
    enabled: true,
  },
  {
    value: "DELTA",
    label: "차분 발주",
    description:
      "기존 발주서의 자재 수량을 비교해 부족분만 추가로 발주합니다. 식수 증가 시 사용합니다.",
    enabled: false,
    comingSoonLabel: "R1-b3 도입 예정",
  },
  {
    value: "REPLACE",
    label: "덮어쓰기 발주",
    description:
      "기존 DRAFT 발주서를 취소하고 새 발주서로 대체합니다. 식단 자체가 크게 변경되었을 때 사용합니다.",
    enabled: false,
    comingSoonLabel: "R1-b4 도입 예정",
  },
];

interface Props {
  value: WizardMode;
  onChange: (mode: WizardMode) => void;
  /** 활성 PO가 있는 식단그룹에서만 의미가 있음 — 없으면 컴포넌트 자체를 렌더하지 않음 */
  existingPOCount: number;
}

export function WizardModeSelector({ value, onChange, existingPOCount }: Props) {
  if (existingPOCount === 0) return null;

  return (
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-blue-700" />
        <p className="text-sm font-medium text-blue-900">
          기존 발주서가 {existingPOCount}건 있습니다 — 진행 방식을 선택하세요
        </p>
      </div>

      <div className="grid gap-2">
        {MODE_OPTIONS.map((opt) => {
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
