"use client";

import { useReducer, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BuildPOItemsResult, POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";
import { StepMealPlanGroupSelect } from "./step-meal-plan-group-select";
import { StepLoadSummary } from "./step-load-summary";

// ════════════════════════════════════════
// 위저드 상태 모델
// ════════════════════════════════════════
export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type MealPlanGroupOption = {
  id: string;
  planDate: Date;
  status: string;
  mealPlanCount: number;
};

export interface WizardState {
  step: WizardStep;
  // Step 1
  mealPlanGroup: MealPlanGroupOption | null;
  countSource: "ESTIMATED" | "FINAL";
  // Step 2
  isLoading: boolean;
  loadResult: BuildPOItemsResult | null;
  loadError: string | null;
  // Step 3 이후 편집 상태 (4-B'-5c에서 채움)
  mapped: POItemCandidate[];
  unmapped: POItemCandidate[];
  noOrderNeeded: POItemCandidate[];
  // Step 5 입력
  orderDate: Date;
  deliveryDate: Date | null;
  note: string;
}

type Action =
  | { type: "SET_GROUP"; payload: MealPlanGroupOption | null }
  | { type: "SET_COUNT_SOURCE"; payload: "ESTIMATED" | "FINAL" }
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; payload: BuildPOItemsResult }
  | { type: "LOAD_ERROR"; payload: string }
  | { type: "GO_NEXT" }
  | { type: "GO_PREV" }
  | { type: "RESET" };

const initialState: WizardState = {
  step: 1,
  mealPlanGroup: null,
  countSource: "ESTIMATED",
  isLoading: false,
  loadResult: null,
  loadError: null,
  mapped: [],
  unmapped: [],
  noOrderNeeded: [],
  orderDate: new Date(),
  deliveryDate: null,
  note: "",
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_GROUP":
      return { ...state, mealPlanGroup: action.payload, loadResult: null, loadError: null };
    case "SET_COUNT_SOURCE":
      return { ...state, countSource: action.payload, loadResult: null, loadError: null };
    case "LOAD_START":
      return { ...state, isLoading: true, loadError: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        isLoading: false,
        loadResult: action.payload,
        mapped: action.payload.mapped,
        unmapped: action.payload.unmapped,
        noOrderNeeded: action.payload.noOrderNeeded,
        loadError: null,
      };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, loadError: action.payload };
    case "GO_NEXT":
      return { ...state, step: Math.min(5, state.step + 1) as WizardStep };
    case "GO_PREV":
      return { ...state, step: Math.max(1, state.step - 1) as WizardStep };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ════════════════════════════════════════
// 위저드 컨테이너
// ════════════════════════════════════════
const STEP_LABELS: Record<WizardStep, string> = {
  1: "식단 그룹 선택",
  2: "필요량 로드",
  3: "자재 매핑·편집",
  4: "분할 미리보기",
  5: "발주 생성",
};

export function POWizard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleCancel = useCallback(() => {
    if (
      state.step > 1 &&
      !window.confirm("위저드를 종료하시겠습니까? 입력한 내용은 저장되지 않습니다.")
    ) {
      return;
    }
    router.push("/purchase-orders");
  }, [state.step, router]);

  // Step 1 → 2 진입 가능 여부
  const canProceedFromStep1 = state.mealPlanGroup !== null;
  // Step 2 → 3 진입 가능 여부
  const canProceedFromStep2 =
    state.loadResult !== null &&
    state.loadResult.summary.totalCount > 0 &&
    !state.isLoading;

  return (
    <div className="space-y-6">
      {/* 진행 표시줄 */}
      <ol className="flex items-center gap-2 text-sm">
        {([1, 2, 3, 4, 5] as WizardStep[]).map((n) => (
          <li
            key={n}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${
              n === state.step
                ? "bg-blue-100 text-blue-900 font-medium"
                : n < state.step
                ? "bg-gray-100 text-gray-600"
                : "bg-white text-gray-400 border border-gray-200"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                n === state.step
                  ? "bg-blue-600 text-white"
                  : n < state.step
                  ? "bg-gray-400 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {n}
            </span>
            <span>{STEP_LABELS[n]}</span>
          </li>
        ))}
      </ol>

      {/* 본문 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 min-h-[400px]">
        {state.step === 1 && (
          <StepMealPlanGroupSelect
            value={state.mealPlanGroup}
            onChange={(g) => dispatch({ type: "SET_GROUP", payload: g })}
            countSource={state.countSource}
            onCountSourceChange={(cs) =>
              dispatch({ type: "SET_COUNT_SOURCE", payload: cs })
            }
          />
        )}

        {state.step === 2 && state.mealPlanGroup && (
          <StepLoadSummary
            mealPlanGroupId={state.mealPlanGroup.id}
            mealPlanGroup={state.mealPlanGroup}
            countSource={state.countSource}
            isLoading={state.isLoading}
            loadResult={state.loadResult}
            loadError={state.loadError}
            onLoadStart={() => dispatch({ type: "LOAD_START" })}
            onLoadSuccess={(r) => dispatch({ type: "LOAD_SUCCESS", payload: r })}
            onLoadError={(e) => dispatch({ type: "LOAD_ERROR", payload: e })}
          />
        )}

        {state.step === 3 && (
          <PlaceholderStep
            title="Step 3 — 자재 매핑·편집"
            description="Phase 4-B'-5c 에서 구현됩니다. 매핑됨/미매핑 자재 행을 인라인 편집하고 미매핑 항목을 공급업체와 연결합니다."
            preview={
              state.loadResult && (
                <SummaryPreview result={state.loadResult} />
              )
            }
          />
        )}

        {state.step === 4 && (
          <PlaceholderStep
            title="Step 4 — 분할 미리보기"
            description="Phase 4-B'-5c 에서 구현됩니다. 공급업체 × 공장 × 라인 단위로 분할될 PO 목록을 미리 확인합니다."
          />
        )}

        {state.step === 5 && (
          <PlaceholderStep
            title="Step 5 — 발주 생성"
            description="Phase 4-B'-5c 에서 구현됩니다. createPurchaseOrdersBatchAction 으로 N 개 DRAFT PO를 일괄 생성합니다."
          />
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          취소
        </Button>
        <div className="flex items-center gap-2">
          {state.step > 1 && (
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "GO_PREV" })}
              disabled={state.isLoading}
            >
              이전
            </Button>
          )}
          {state.step < 5 && (
            <Button
              onClick={() => {
                if (state.step === 1 && !canProceedFromStep1) {
                  toast.warning("식단 그룹을 선택하세요");
                  return;
                }
                if (state.step === 2 && !canProceedFromStep2) {
                  if (!state.loadResult) {
                    toast.warning("'필요량 로드' 버튼을 눌러 자재 목록을 가져오세요");
                  } else if (state.loadResult.summary.totalCount === 0) {
                    toast.warning(
                      "해당 식단 그룹의 산출 결과가 비어 있습니다. 식단·MR 산출 상태를 확인하세요"
                    );
                  }
                  return;
                }
                if (state.step >= 3) {
                  toast.info("Phase 4-B'-5c에서 구현됩니다");
                  return;
                }
                dispatch({ type: "GO_NEXT" });
              }}
              disabled={state.isLoading}
            >
              다음
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// 임시 placeholder (4-B'-5c에서 제거)
// ════════════════════════════════════════
function PlaceholderStep({
  title,
  description,
  preview,
}: {
  title: string;
  description: string;
  preview?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
        {description}
      </div>
      {preview}
    </div>
  );
}

function SummaryPreview({ result }: { result: BuildPOItemsResult }) {
  return (
    <div className="rounded-md border border-gray-200 p-4 text-sm">
      <p className="mb-2 font-medium">로드된 자재 요약 (Step 2 결과)</p>
      <ul className="space-y-1 text-gray-700">
        <li>전체: {result.summary.totalCount} 건</li>
        <li>자동 매핑됨: {result.summary.mappedCount} 건</li>
        <li className="text-red-700">
          미매핑 (공급업체 선택 필요): {result.summary.unmappedCount} 건
        </li>
        <li className="text-gray-500">
          재고 충당: {result.summary.noOrderNeededCount} 건
        </li>
        <li>
          예상 발주 금액 (매핑 행만):{" "}
          {result.summary.estimatedTotalAmount.toLocaleString()} 원
        </li>
      </ul>
    </div>
  );
}
