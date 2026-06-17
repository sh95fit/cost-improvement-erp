"use client";

import { useReducer, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  BuildPOItemsResult,
  POItemCandidate,
} from "@/features/purchase-order/lib/build-po-items-from-mr";
import type { SupplierItemWithSupplier } from "@/features/supplier/actions/supplier.action";
import { StepMealPlanGroupSelect } from "./step-meal-plan-group-select";
import { StepLoadSummary } from "./step-load-summary";
import { StepMappingTable } from "./step-mapping-table";
import { StepSplitPreview } from "./step-split-preview";
import { StepConfirmCreate } from "./step-confirm-create";
import { useWizardPersistence } from "./use-wizard-persistence";

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
  mealPlanGroup: MealPlanGroupOption | null;
  countSource: "ESTIMATED" | "FINAL";
  isLoading: boolean;
  loadResult: BuildPOItemsResult | null;
  loadError: string | null;
  // 편집 상태 (모두 동일 배열에서 분리만)
  mapped: POItemCandidate[];
  unmapped: POItemCandidate[];
  noOrderNeeded: POItemCandidate[];
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
  | {
      type: "UPDATE_QUANTITY";
      payload: { materialRequirementId: string; value: number };
    }
  | {
      type: "UPDATE_UNIT_PRICE";
      payload: { materialRequirementId: string; value: number };
    }
  | {
      type: "RESOLVE_UNMAPPED";
      payload: {
        materialRequirementId: string;
        supplierItem: SupplierItemWithSupplier;
      };
    }
  | { type: "SET_ORDER_DATE"; payload: Date }
  | { type: "SET_DELIVERY_DATE"; payload: Date | null }
  | { type: "SET_NOTE"; payload: string }
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
      return {
        ...state,
        mealPlanGroup: action.payload,
        loadResult: null,
        loadError: null,
        mapped: [],
        unmapped: [],
        noOrderNeeded: [],
      };
    case "SET_COUNT_SOURCE":
      return {
        ...state,
        countSource: action.payload,
        loadResult: null,
        loadError: null,
        mapped: [],
        unmapped: [],
        noOrderNeeded: [],
      };
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

    case "UPDATE_QUANTITY": {
      const { materialRequirementId, value } = action.payload;
      const update = (rows: POItemCandidate[]) =>
        rows.map((r) =>
          r.materialRequirementId === materialRequirementId
            ? { ...r, orderQuantity: value }
            : r,
        );
      return { ...state, mapped: update(state.mapped) };
    }
    case "UPDATE_UNIT_PRICE": {
      const { materialRequirementId, value } = action.payload;
      const update = (rows: POItemCandidate[]) =>
        rows.map((r) =>
          r.materialRequirementId === materialRequirementId
            ? { ...r, unitPrice: value }
            : r,
        );
      return { ...state, mapped: update(state.mapped) };
    }
    case "RESOLVE_UNMAPPED": {
      const { materialRequirementId, supplierItem } = action.payload;
      const target = state.unmapped.find(
        (r) => r.materialRequirementId === materialRequirementId,
      );
      if (!target) return state;
      // supplyUnitQty 기반으로 ceil 재계산 (간단화: netRequiredInFromUnit / supplyUnitQty)
      const baseQty =
        target.netRequiredInFromUnit ?? target.netRequiredG;
      const orderQuantityRaw =
        supplierItem.supplyUnitQty > 0
          ? baseQty / supplierItem.supplyUnitQty
          : baseQty;
      const orderQuantity = Math.ceil(orderQuantityRaw);
      const resolved: POItemCandidate = {
        ...target,
        supplierItem: {
          id: supplierItem.id,
          supplierId: supplierItem.supplierId,
          supplierName: supplierItem.supplier.name,
          productName: supplierItem.productName,
          supplyUnitName: supplierItem.supplyUnit.name,
          supplyUnitQty: supplierItem.supplyUnitQty,
          currentPrice: supplierItem.currentPrice,
        },
        orderQuantity,
        orderQuantityRaw,
        unitPrice: supplierItem.currentPrice,
        status: "MAPPED",
        warnings: target.warnings.filter(
          (w) => !w.includes("매핑") && !w.includes("공급"),
        ),
      };
      return {
        ...state,
        unmapped: state.unmapped.filter(
          (r) => r.materialRequirementId !== materialRequirementId,
        ),
        mapped: [...state.mapped, resolved],
      };
    }

    case "SET_ORDER_DATE":
      return { ...state, orderDate: action.payload };
    case "SET_DELIVERY_DATE":
      return { ...state, deliveryDate: action.payload };
    case "SET_NOTE":
      return { ...state, note: action.payload };
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

  // localStorage persistence (편집 상태만 저장 — loadResult/mapped는 다시 로드)
  const persistedState = {
    countSource: state.countSource,
    edits: Object.fromEntries(
      state.mapped
        .filter((r) => r.supplierItem)
        .map((r) => [
          r.materialRequirementId,
          {
            supplierItemId: r.supplierItem!.id,
            supplierId: r.supplierItem!.supplierId,
            orderQuantity: r.orderQuantity ?? 0,
            unitPrice: r.unitPrice ?? 0,
          },
        ]),
    ),
    orderDate: state.orderDate.toISOString(),
    deliveryDate: state.deliveryDate?.toISOString() ?? null,
    note: state.note,
  };

  const { clearPersisted } = useWizardPersistence(
    state.mealPlanGroup?.id ?? null,
    state.mapped.length > 0 ? persistedState : null,
  );

  const handleCancel = useCallback(() => {
    if (
      state.step > 1 &&
      !window.confirm(
        "위저드를 종료하시겠습니까? 입력한 내용은 저장되지 않습니다.",
      )
    ) {
      return;
    }
    router.push("/purchase-orders");
  }, [state.step, router]);

  const canProceedFromStep1 = state.mealPlanGroup !== null;
  const canProceedFromStep2 =
    state.loadResult !== null &&
    state.loadResult.summary.totalCount > 0 &&
    !state.isLoading;
  const canProceedFromStep3 = state.unmapped.length === 0;

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
            onLoadSuccess={(r) =>
              dispatch({ type: "LOAD_SUCCESS", payload: r })
            }
            onLoadError={(e) =>
              dispatch({ type: "LOAD_ERROR", payload: e })
            }
          />
        )}

        {state.step === 3 && (
          <StepMappingTable
            mapped={state.mapped}
            unmapped={state.unmapped}
            noOrderNeeded={state.noOrderNeeded}
            onUpdateQuantity={(id, v) =>
              dispatch({
                type: "UPDATE_QUANTITY",
                payload: { materialRequirementId: id, value: v },
              })
            }
            onUpdateUnitPrice={(id, v) =>
              dispatch({
                type: "UPDATE_UNIT_PRICE",
                payload: { materialRequirementId: id, value: v },
              })
            }
            onResolveUnmapped={(id, si) =>
              dispatch({
                type: "RESOLVE_UNMAPPED",
                payload: { materialRequirementId: id, supplierItem: si },
              })
            }
          />
        )}

        {state.step === 4 && <StepSplitPreview mapped={state.mapped} />}

        {state.step === 5 && state.mealPlanGroup && (
          <StepConfirmCreate
            mealPlanGroupId={state.mealPlanGroup.id}
            mapped={state.mapped}
            orderDate={state.orderDate}
            deliveryDate={state.deliveryDate}
            note={state.note}
            onChangeOrderDate={(d) =>
              dispatch({ type: "SET_ORDER_DATE", payload: d })
            }
            onChangeDeliveryDate={(d) =>
              dispatch({ type: "SET_DELIVERY_DATE", payload: d })
            }
            onChangeNote={(s) =>
              dispatch({ type: "SET_NOTE", payload: s })
            }
            onClearPersistence={() =>
              clearPersisted(state.mealPlanGroup?.id ?? null)
            }
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
                    toast.warning(
                      "'필요량 로드' 결과를 기다리거나 다시 시도하세요",
                    );
                  } else if (state.loadResult.summary.totalCount === 0) {
                    toast.warning(
                      "해당 식단 그룹의 산출 결과가 비어 있습니다",
                    );
                  }
                  return;
                }
                if (state.step === 3 && !canProceedFromStep3) {
                  toast.warning(
                    `미매핑 자재 ${state.unmapped.length}건을 먼저 매핑하세요`,
                  );
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