"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getMealPlanGroupsForOrderAction } from "@/features/purchase-order/actions/purchase-order.action";
import { Label } from "@/components/ui/label";
import type { MealPlanGroupOption } from "./po-wizard";
import { ExistingPONotice } from "./existing-po-notice";
import {
  WizardModeSelector,
  type WizardMode,
} from "./wizard-mode-selector";
import type { ExistingPOSummary } from "@/features/purchase-order/actions/purchase-order.action";


interface Props {
  value: MealPlanGroupOption | null;
  onChange: (group: MealPlanGroupOption | null) => void;
  countSource: "ESTIMATED" | "FINAL";
  onCountSourceChange: (cs: "ESTIMATED" | "FINAL") => void;
  // ★ R1-b2
  mode: WizardMode;
  basedOnPOIds: string[];
  onChangeMode: (mode: WizardMode, basedOnPOIds: string[]) => void;
}

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "산출중",
  COMPLETED: "산출완료",
};

export function StepMealPlanGroupSelect({
  value,
  onChange,
  countSource,
  onCountSourceChange,
  mode,
  basedOnPOIds,
  onChangeMode,
}: Props) {
  const [options, setOptions] = useState<MealPlanGroupOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getMealPlanGroupsForOrderAction()
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error.message);
          toast.error(res.error.message);
          return;
        }
        setOptions(
          res.data.map((g) => ({
            id: g.id,
            planDate: new Date(g.planDate),
            status: g.status,
            mealPlanCount: g.mealPlanCount,
          })),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "식단 그룹 로드 실패";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ★ R1-b2: 활성 PO 개수 (ExistingPONotice 가 콜백으로 알려줌)
  const [existingPOIds, setExistingPOIds] = useState<string[]>([]);
  const existingPOCount = existingPOIds.length;

  const handleExistingPOsLoaded = useCallback(
    (pos: ExistingPOSummary[]) => {
      const ids = pos.map((po) => po.id);
      setExistingPOIds(ids);
      // PO가 사라졌으면 모드를 NEW로 리셋
      if (ids.length === 0 && mode !== "NEW") {
        onChangeMode("NEW", []);
      }
    },
    [mode, onChangeMode],
  );

  const handleModeChange = useCallback(
    (next: WizardMode) => {
      // 추천(A)대로 DELTA/REPLACE 선택 시 활성 PO 전체 ID를 basedOnPOIds로 자동 세팅
      onChangeMode(next, next === "NEW" ? [] : existingPOIds);
    },
    [existingPOIds, onChangeMode],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 1 — 식단 그룹 선택</h2>
        <p className="mt-1 text-sm text-gray-600">
          최근 30일 이내 산출중(IN_PROGRESS) · 산출완료(COMPLETED) 상태의 식단
          그룹만 표시됩니다.
        </p>
      </div>

      {/* 식수 기준 (ESTIMATED / FINAL) */}
      <div className="space-y-2">
        <Label>식수 기준</Label>
        <div className="flex gap-2">
          {(["ESTIMATED", "FINAL"] as const).map((cs) => (
            <button
              key={cs}
              type="button"
              onClick={() => onCountSourceChange(cs)}
              className={`rounded-md border px-4 py-2 text-sm ${
                countSource === cs
                  ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {cs === "ESTIMATED" ? "예상 식수 (ESTIMATED)" : "확정 식수 (FINAL)"}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          ESTIMATED는 식단 확정 직후 산출된 1차 필요량, FINAL은 식수 확정 후
          산출된 2차 필요량입니다.
        </p>
      </div>

      {/* 식단 그룹 목록 */}
      <div className="space-y-2">
        <Label>식단 그룹</Label>
        {isLoading && (
          <p className="text-sm text-gray-500">목록을 불러오는 중...</p>
        )}
        {error && !isLoading && (
          <p className="text-sm text-red-600">에러: {error}</p>
        )}
        {!isLoading && !error && options.length === 0 && (
          <p className="text-sm text-gray-500">
            발주 가능한 식단 그룹이 없습니다. 식단을 먼저 확정하세요.
          </p>
        )}
        {!isLoading && options.length > 0 && (
          <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-600">
                <tr>
                  <th className="w-12 px-3 py-2"></th>
                  <th className="px-3 py-2">기준일</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">식단 수</th>
                </tr>
              </thead>
              <tbody>
                {options.map((g) => {
                  const selected = value?.id === g.id;
                  return (
                    <tr
                      key={g.id}
                      onClick={() => onChange(g)}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50 ${
                        selected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => onChange(g)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {g.planDate.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            g.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {STATUS_LABEL[g.status] ?? g.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {g.mealPlanCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
          </div>
        )}
      </div>

      {/* ★ R1-b1: 선택된 식단그룹의 기존 활성 PO 사전 안내 */}
      {value && (
        <>
          <ExistingPONotice
            mealPlanGroupId={value.id}
            context="step1"
            onLoaded={handleExistingPOsLoaded}
          />
          {/* ★ R1-b2: 활성 PO 가 있을 때만 모드 선택 노출 */}
          <WizardModeSelector
            value={mode}
            onChange={handleModeChange}
            existingPOCount={existingPOCount}
          />
        </>
      )}
    </div>
  );
}
