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
import type { ExistingPOsSummaryResult } from "@/features/purchase-order/actions/purchase-order.action";
import { clearAllIdempotencyTokensFor } from "./po-wizard";

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
            materialRequirementCount: g.materialRequirementCount, // ★ G-2
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

  // ★ R1-b3: 활성 PO 상세 (모드 가용성 판정 + basedOnPOIds 산정용)
  const [existingPOCounts, setExistingPOCounts] = useState({
    total: 0,
    draft: 0,
    submitted: 0,
    approved: 0,
    received: 0,
  });
  // 모드별 basedOnPOIds 후보 (DELTA = DRAFT+SUBMITTED, REPLACE = DRAFT only)
  const [deltaTargetIds, setDeltaTargetIds] = useState<string[]>([]);
  const [replaceTargetIds, setReplaceTargetIds] = useState<string[]>([]);

  const handleExistingPOsLoaded = useCallback(
    (result: ExistingPOsSummaryResult) => {
      setExistingPOCounts(result.counts);
  
      // ★ R1-b4: REPLACE 대상도 DRAFT + SUBMITTED 로 통일
      //   (백엔드 executeReplaceMode 도 DRAFT/SUBMITTED 모두 CANCELLED 로 일괄 전이)
      const deltaIds = result.pos
        .filter((p) => p.status === "DRAFT" || p.status === "SUBMITTED")
        .map((p) => p.id);
      const replaceIds = deltaIds;
      setDeltaTargetIds(deltaIds);
      setReplaceTargetIds(replaceIds);
  
      // ★ D18 (R1-b5-1): 활성 PO 카운트에 따른 모드 자동 보정
      //   - total === 0  → NEW 단독 표시 (selector 자체 비표시) → NEW 강제
      //   - total > 0    → NEW 옵션 자체가 제거됨 → NEW 였다면 가능한 모드로 자동 전환
      if (result.counts.total === 0) {
        // ★ FIX-IDEM-CANCELLED-2 (D27): 활성 PO 0건이면 (이전 batch 가 전량 취소된 상태일 수 있음)
        //   localStorage 의 모든 모드 토큰을 폐기해 신규 발주가 막히지 않도록 보장.
        //   서버측 Fix 1 만으로도 동작하지만, 토스트 메시지를 깔끔히 보여주기 위한 보조 방어.
        if (value) {
          clearAllIdempotencyTokensFor(value.id, countSource);
        }
        if (mode !== "NEW") onChangeMode("NEW", []);
      } else if (mode === "NEW") {
        // 활성 PO 가 있는데 NEW 가 선택돼 있던 경우 → DELTA 우선, 불가하면 REPLACE
        const lockedCount = result.counts.approved + result.counts.received;
        const editableCount = result.counts.draft + result.counts.submitted;
        if (editableCount > 0) {
          onChangeMode("DELTA", deltaIds);
        } else if (lockedCount > 0) {
          // 편집 가능한 PO 없음 + APPROVED/RECEIVED 만 존재 → DELTA 도 REPLACE 도 비활성
          // selector 는 둘 다 disabled 로 렌더링됨. 값은 DELTA 로 두되 basedOnPOIds 는 빈 배열.
          onChangeMode("DELTA", []);
        }
      }
    },
    [mode, onChangeMode],
  );  

  const handleModeChange = useCallback(
    (next: WizardMode) => {
      // ★ R1-b3: 모드별로 적절한 PO id 목록만 basedOnPOIds 에 채움
      const targetIds =
        next === "DELTA"
          ? deltaTargetIds
          : next === "REPLACE"
            ? replaceTargetIds
            : [];
      onChangeMode(next, targetIds);
    },
    [deltaTargetIds, replaceTargetIds, onChangeMode],
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
                  <th className="px-3 py-2">자재 산출</th>
                </tr>
              </thead>
              <tbody>
                {options.map((g) => {
                  const selected = value?.id === g.id;
                  const hasRequirements = g.materialRequirementCount > 0;
                  return (
                    <tr
                      key={g.id}
                      onClick={() => hasRequirements && onChange(g)}
                      className={`border-t border-gray-100 ${
                        hasRequirements
                          ? "cursor-pointer hover:bg-blue-50"
                          : "cursor-not-allowed opacity-60"
                      } ${selected ? "bg-blue-50" : ""}`}
                      title={
                        hasRequirements
                          ? undefined
                          : "자재 소요량이 산출되지 않았습니다. 식단을 진행중 상태로 다시 전환해주세요."
                      }
                    >
                      <td className="px-3 py-2">
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => hasRequirements && onChange(g)}
                          disabled={!hasRequirements}
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
                      <td className="px-3 py-2 text-gray-600">{g.mealPlanCount}</td>
                      <td className="px-3 py-2 text-xs">
                        {hasRequirements ? (
                          <span className="text-gray-600 tabular-nums">
                            {g.materialRequirementCount.toLocaleString()}건
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                            미산출
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ★ Phase 4-G G-2: 선택 그룹이 미산출인 경우 안내 배너 */}
      {value && value.materialRequirementCount === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            자재 소요량이 산출되지 않은 그룹입니다
          </p>
          <p className="mt-1 text-xs text-amber-800">
            식단 화면에서 해당 그룹을 <strong>진행중</strong> 상태로 전환하면
            자동으로 자재 소요량이 산출됩니다.
          </p>
          <a
            href="/meal-plans"
            className="mt-2 inline-block text-xs text-amber-900 underline hover:text-amber-950"
          >
            식단 화면으로 이동 →
          </a>
        </div>
      )}

      {/* ★ R1-b1: 선택된 식단그룹의 기존 활성 PO 사전 안내 */}
      {value && value.materialRequirementCount > 0 && (
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
            existingPOCount={existingPOCounts.total}
            draftCount={existingPOCounts.draft}
            submittedCount={existingPOCounts.submitted}
            lockedCount={existingPOCounts.approved + existingPOCounts.received}
          />
        </>
      )}
    </div>
  );
}
