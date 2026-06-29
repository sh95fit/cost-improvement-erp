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
// ★ D25-3: WizardPreviewPanel 로 모드별 분기 (NEW/DELTA/REPLACE)
// ★ D25-4: 레거시 StepSplitPreview 삭제 완료 (NewModePreview 가 흡수)
import { WizardPreviewPanel } from "./wizard-preview-panel";
import { StepConfirmCreate } from "./step-confirm-create";
import { useWizardPersistence } from "./use-wizard-persistence";
import { calculateOrderQuantity } from "@/features/purchase-order/lib/unit-conversion";

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
  // ★ R1-b1: 위저드 세션 멱등성 키 (Step 1 진입 시 발급)
  idempotencyKey: string | null;
  // ★ R1-b1: 위저드 모드 (R1-b2 부터 사용자 선택, R1-b1 단계에서는 항상 "NEW")
  mode: "NEW" | "DELTA" | "REPLACE";
  // ★ R1-b1: 모드 선택 시 참조한 기존 PO id 목록 (DELTA/REPLACE 시 사용)
  basedOnPOIds: string[];  
  step: WizardStep;
  mealPlanGroup: MealPlanGroupOption | null;
  countSource: "ESTIMATED" | "FINAL";
  isLoading: boolean;
  loadResult: BuildPOItemsResult | null;
  loadError: string | null;
  // 편집 상태 — Fix-R1-a (D10): 4분류
  mapped: POItemCandidate[];
  mappedPartialStock: POItemCandidate[];
  mappedFullStock: POItemCandidate[];
  unmapped: POItemCandidate[];
  orderDate: Date;
  // ★ Phase 1.6 (D15-1): deliveryDate → outboundDate
  outboundDate: Date | null;
  note: string;
  // ★ R1-b3: DELTA 프리뷰 (mode === "DELTA" 일 때만 의미)
  deltaPreview: import("@/features/purchase-order/actions/purchase-order.action").PreviewDeltaPlanResult | null;
  deltaPreviewLoading: boolean;
  deltaPreviewError: string | null;
  /** D19: materialRequirementId → setAsDefault 플래그 (기본 공급업체 변경 동의) */
  setAsDefaultMap: Record<string, boolean>;
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
  | {
      type: "REFRESH_ROW_AFTER_CONVERSION";
      payload: {
        materialMasterId: string;
        fromUnit: string;
        factor: number;
      };
    }    
  | { type: "SET_ORDER_DATE"; payload: Date }
  // ★ Phase 1.6 (D15-1): SET_DELIVERY_DATE → SET_OUTBOUND_DATE
  | { type: "SET_OUTBOUND_DATE"; payload: Date | null }
  | { type: "SET_NOTE"; payload: string }
  // ★ R1-b1
  | { type: "SET_IDEMPOTENCY_KEY"; payload: string }
  | {
      type: "SET_MODE";
      payload: { mode: "NEW" | "DELTA" | "REPLACE"; basedOnPOIds: string[] };
    }

  // ★ R1-b3
  | { type: "DELTA_PREVIEW_START" }
  | {
      type: "DELTA_PREVIEW_SUCCESS";
      payload: import("@/features/purchase-order/actions/purchase-order.action").PreviewDeltaPlanResult;
    }
  | { type: "DELTA_PREVIEW_ERROR"; payload: string }
  | { type: "DELTA_PREVIEW_RESET" }

  // ★ D19
  | {
    type: "SET_AS_DEFAULT";
    payload: { materialRequirementId: string; value: boolean };
  }
  | { type: "RESET" };

  const initialState: WizardState = {
    // ★ R1-b1
    idempotencyKey: null,
    mode: "NEW",
    basedOnPOIds: [],
    step: 1,
    mealPlanGroup: null,
    countSource: "ESTIMATED",
    isLoading: false,
    loadResult: null,
    loadError: null,
    mapped: [],
    mappedPartialStock: [],
    mappedFullStock: [],
    unmapped: [],
    orderDate: new Date(),
    // ★ Phase 1.6 (D15-1)
    outboundDate: null,
    note: "",
    deltaPreview: null,
    deltaPreviewLoading: false,
    deltaPreviewError: null,
    setAsDefaultMap: {},
  };

// ════════════════════════════════════════
// ★ R1-b1: 멱등성 토큰 헬퍼
// ════════════════════════════════════════
const IDEMPOTENCY_STORAGE_PREFIX = "po-wizard-idem:";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ★ D24 (D-IDEMPOTENCY-PER-MODE): 토큰 키에 mode를 포함해 모드 전환 시 자동 새 토큰 발급
function makeIdempotencyStorageKey(
  mealPlanGroupId: string,
  countSource: string,
  mode: "NEW" | "DELTA" | "REPLACE",
): string {
  return `${IDEMPOTENCY_STORAGE_PREFIX}${mealPlanGroupId}:${countSource}:${mode}`;
}

function generateIdempotencyToken(
  mealPlanGroupId: string,
  countSource: string,
  mode: "NEW" | "DELTA" | "REPLACE",
): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // ★ D24: 토큰 자체에도 mode를 포함해 디버깅 시 식별 용이
  return `wiz_${mealPlanGroupId}_${countSource}_${mode}_${uuid}`;
}

/**
 * localStorage에서 토큰을 복원하거나 새로 발급.
 * - 24시간 이내 저장된 토큰 → 재사용
 * - 그 외 → 새로 발급 후 저장
 */
function getOrCreateIdempotencyToken(
  mealPlanGroupId: string,
  countSource: string,
  mode: "NEW" | "DELTA" | "REPLACE",
): string {
  if (typeof window === "undefined") {
    return generateIdempotencyToken(mealPlanGroupId, countSource, mode);
  }
  const storageKey = makeIdempotencyStorageKey(mealPlanGroupId, countSource, mode);
  const raw = window.localStorage.getItem(storageKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { token: string; createdAt: number };
      if (
        parsed.token &&
        typeof parsed.createdAt === "number" &&
        Date.now() - parsed.createdAt < IDEMPOTENCY_TTL_MS
      ) {
        return parsed.token;
      }
    } catch {
      // ignore — 손상된 데이터는 새로 발급
    }
  }
  const token = generateIdempotencyToken(mealPlanGroupId, countSource, mode);
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({ token, createdAt: Date.now() }),
  );
  return token;
}

function clearIdempotencyToken(
  mealPlanGroupId: string,
  countSource: string,
  mode: "NEW" | "DELTA" | "REPLACE",
): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(
    makeIdempotencyStorageKey(mealPlanGroupId, countSource, mode),
  );
}

// ★ FIX-IDEM-CANCELLED-2 (D27): step-meal-plan-group-select 에서 사용
export function clearAllIdempotencyTokensFor(
  mealPlanGroupId: string,
  countSource: string,
): void {
  (["NEW", "DELTA", "REPLACE"] as const).forEach((m) =>
    clearIdempotencyToken(mealPlanGroupId, countSource, m),
  );
}

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_GROUP":
      return {
        ...state,
        mealPlanGroup: action.payload,
        // ★ R1-b1: 그룹 변경 시 토큰 리셋 (useEffect가 새로 발급)
        idempotencyKey: null,
        mode: "NEW",
        basedOnPOIds: [],
        loadResult: null,
        loadError: null,
        mapped: [],
        mappedPartialStock: [],
        mappedFullStock: [],
        unmapped: [],
        deltaPreview: null,
        deltaPreviewLoading: false,
        deltaPreviewError: null,
        setAsDefaultMap: {},
      };
    case "SET_COUNT_SOURCE":
      return {
        ...state,
        countSource: action.payload,
        // ★ R1-b1: countSource 변경 시 토큰 리셋
        idempotencyKey: null,
        loadResult: null,
        loadError: null,
        mapped: [],
        mappedPartialStock: [],
        mappedFullStock: [],
        unmapped: [],
        deltaPreview: null,
        deltaPreviewLoading: false,
        deltaPreviewError: null,
        setAsDefaultMap: {},
      };
    case "LOAD_START":
      return { ...state, isLoading: true, loadError: null };
      case "LOAD_SUCCESS": {
        // ★ D19: 자동 매핑된 행 중 자재에 default 가 아직 없는 경우(currentDefaultSupplierItemId === null)
        //        + supplierItem 이 실제로 결정된 행에 대해 자동으로 setAsDefault=true 로 시드.
        //        사용자가 체크박스를 보지 않는 자동 케이스(A)에서도 발주 생성 시
        //        MaterialMaster.defaultSupplierItemId 가 정상적으로 채워지도록 보장한다.
        //        같은 자재가 여러 행에 걸쳐 있을 경우 마지막 행이 승자가 됨(서버측 collectDefaultSupplierUpdates와 동일 규약).
        const autoSeedMap: Record<string, boolean> = {};
        const seedRows = [
          ...action.payload.mapped,
          ...action.payload.mappedPartialStock,
          ...action.payload.mappedFullStock,
        ];
        for (const r of seedRows) {
          if (
            r.supplierItem !== null &&
            r.currentDefaultSupplierItemId === null
          ) {
            autoSeedMap[r.materialRequirementId] = true;
          }
        }
        return {
          ...state,
          isLoading: false,
          loadResult: action.payload,
          mapped: action.payload.mapped,
          mappedPartialStock: action.payload.mappedPartialStock,
          mappedFullStock: action.payload.mappedFullStock,
          unmapped: action.payload.unmapped,
          loadError: null,
          setAsDefaultMap: {
            ...state.setAsDefaultMap,
            ...autoSeedMap,
          },
        };
      }  
    case "LOAD_ERROR":
      return { ...state, isLoading: false, loadError: action.payload };
    case "GO_NEXT":
      return { ...state, step: Math.min(5, state.step + 1) as WizardStep };
    case "GO_PREV":
      return { ...state, step: Math.max(1, state.step - 1) as WizardStep };

    case "UPDATE_QUANTITY": {
        const { materialRequirementId, value } = action.payload;
        // ★ 정수 강제: UI를 우회한 호출(키보드/단축키/persistence 복원 등)에도 안전하도록
        //   리듀서 단에서 최종 올림 보정. 음수 차단. UI 와 동일 정책(ceil).
        const safeValue = Math.max(0, Math.ceil((value ?? 0) - 1e-9));
        const update = (rows: POItemCandidate[]) =>
          rows.map((r) =>
            r.materialRequirementId === materialRequirementId
              ? { ...r, orderQuantity: safeValue }
              : r,
          );
        return {
          ...state,
          mapped: update(state.mapped),
          mappedPartialStock: update(state.mappedPartialStock),
        };
      }
    case "UPDATE_UNIT_PRICE": {
      const { materialRequirementId, value } = action.payload;
      const update = (rows: POItemCandidate[]) =>
        rows.map((r) =>
          r.materialRequirementId === materialRequirementId
            ? { ...r, unitPrice: value }
            : r,
        );
      return {
        ...state,
        mapped: update(state.mapped),
        mappedPartialStock: update(state.mappedPartialStock),
      };
    }  
    case "RESOLVE_UNMAPPED": {
      const { materialRequirementId, supplierItem } = action.payload;
      const target = state.unmapped.find(
        (r) => r.materialRequirementId === materialRequirementId,
      );
      if (!target) return state;
    
      const supplyUnitCode = supplierItem.supplyUnit.code;
      const supplyUnitName = supplierItem.supplyUnit.name;
    
      // D17 단일 진실 원천으로 재계산
      // - supplyUnit === 'g' 이면 환산 불필요
      // - 그 외엔 target.fromUnitName(=이전에 매핑되었던 supplyUnit code)이
      //   새 supplyUnitCode와 같고 factor를 알면 사용 가능. 아니면 환산 미등록 처리.
      const canReuseConversion =
        target.fromUnitName === supplyUnitCode &&
        target.netRequiredInFromUnit != null &&
        target.netRequiredG > 0;
    
      // factor 역산: netRequiredG / netRequiredInFromUnit (이전 행에서 환산이 유효했을 때만)
      // 단, 이전 행은 미매핑이라 netRequiredInFromUnit이 null이었을 가능성이 높음
      // → 대부분 환산 미등록 경로를 타게 됨 (정상)
      const conv =
        supplyUnitCode === "g"
          ? null
          : canReuseConversion
          ? {
              fromUnit: supplyUnitCode,
              factor: target.netRequiredG / (target.netRequiredInFromUnit as number),
            }
          : null;
    
      const calc = calculateOrderQuantity({
        requiredQtyG: target.requiredQtyG,
        stockQtyG: target.stockQtyG,
        unitConversion: conv,
        supplierItem: {
          supplyUnitName: supplyUnitCode,   // ★ code 기준 매칭
          supplyUnitQty: supplierItem.supplyUnitQty,
        },
      });
    
      const baseSupplierItem = {
        id: supplierItem.id,
        supplierId: supplierItem.supplierId,
        supplierName: supplierItem.supplier.name,
        productName: supplierItem.productName,
        supplyUnitName,           // 표시용 name
        supplyUnitCode,           // 비교용 code
        supplyUnitQty: supplierItem.supplyUnitQty,
        currentPrice: supplierItem.currentPrice,
        leadTimeDays: supplierItem.leadTimeDays,
      };
    
      // 이전 경고에서 "공급업체"/"매핑" 관련 제거 + D17 warnings 추가
      const cleanedPrevWarnings = target.warnings.filter(
        (w) =>
          !w.includes("매핑") &&
          !w.includes("공급업체 품목 미지정") &&
          !w.includes("자재 마스터를 찾을 수 없습니다"),
      );
    
      const resolved: POItemCandidate = {
        ...target,
        fromUnitName: conv?.fromUnit ?? (supplyUnitCode === "g" ? "g" : supplyUnitCode),
        netRequiredInFromUnit: calc.netRequiredInFromUnit,
        supplierItem: baseSupplierItem,
        orderQuantity: calc.orderQuantity,
        orderQuantityRaw: calc.orderQuantityRaw,
        unitPrice: supplierItem.currentPrice,
        status: calc.requiresManualInput ? "UNMAPPED" : "MAPPED",
        warnings: [...cleanedPrevWarnings, ...calc.warnings],
      };
    
      // 결과가 여전히 UNMAPPED(환산 미등록 등)이면 unmapped에 유지
      if (resolved.status === "UNMAPPED") {
        return {
          ...state,
          unmapped: state.unmapped.map((r) =>
            r.materialRequirementId === materialRequirementId ? resolved : r,
          ),
          // ★ D19: 매핑 미완(UNMAPPED 유지)이라도 default 플래그 사전 결정
          //        currentDefaultSupplierItemId === null → 자동 true
          //        같은 default → false, 다른 default → false (사용자가 체크박스로 결정)
          setAsDefaultMap: {
            ...state.setAsDefaultMap,
            [materialRequirementId]:
              target.currentDefaultSupplierItemId === null,
          },
        };
      }
    
      return {
        ...state,
        unmapped: state.unmapped.filter(
          (r) => r.materialRequirementId !== materialRequirementId,
        ),
        mapped: [...state.mapped, resolved],
        // ★ D19
        setAsDefaultMap: {
          ...state.setAsDefaultMap,
          [materialRequirementId]:
            target.currentDefaultSupplierItemId === null,
        },
      };
    }
    case "REFRESH_ROW_AFTER_CONVERSION": {
      const { materialMasterId, fromUnit, factor } = action.payload;
    
      const recalcRow = (r: POItemCandidate): POItemCandidate => {
        if (r.materialMasterId !== materialMasterId) return r;
    
        const netRequiredG = r.netRequiredG;
    
        // 경고 필터 (D17 + 구 D3 메시지 모두 제거)
        const cleanedWarnings = r.warnings.filter(
          (w) =>
            !w.includes("단위 환산 등록 필요") &&
            !w.includes("단위 환산 정보 미등록") &&
            !w.includes("단위 환산 계수") &&
            !w.includes("공급단위 계수"),
        );
    
        // 공급업체 미매핑: 환산전 단위 표시만 갱신, orderQuantity 는 null 유지
        if (!r.supplierItem) {
          return {
            ...r,
            fromUnitName: fromUnit,
            netRequiredInFromUnit: factor > 0 ? netRequiredG / factor : null,
            warnings: cleanedWarnings,
          };
        }
    
      // ★ 가드: 등록된 환산의 fromUnit이 supplyUnit.code와 다르면
      //        잘못된 환산을 적용하지 않고 경고 유지 + UNMAPPED 로 유지한다.
      //        (다른 자재에서 같은 materialMasterId의 환산을 등록했을 가능성 있음)
      if (r.supplierItem.supplyUnitCode !== fromUnit) {
        return {
          ...r,
          warnings: [
            ...cleanedWarnings,
            `등록된 환산(${fromUnit}→g)이 공급단위 '${r.supplierItem.supplyUnitCode}'와 다릅니다 — '${r.supplierItem.supplyUnitCode}→g' 환산 등록 필요`,
          ],
        };
      }

        // D17: gPerSupplyUnit = factor × supplyUnitQty
        const supplyUnitQty =
          r.supplierItem.supplyUnitQty > 0 ? r.supplierItem.supplyUnitQty : 1;
        const gPerSupplyUnit = factor * supplyUnitQty;
        const orderQuantityRaw = netRequiredG / gPerSupplyUnit;
        const orderQuantity = Math.ceil(orderQuantityRaw - 1e-9);

        return {
          ...r,
          fromUnitName: fromUnit,
          netRequiredInFromUnit: orderQuantityRaw,
          orderQuantityRaw,
          orderQuantity,
          status: "MAPPED",
          warnings: cleanedWarnings,
        };
      };
    
      // unmapped 에서 재계산 후 MAPPED 로 승격된 행은 mapped 로 이동.
      // (단, supplyUnitCode 와 등록된 fromUnit 이 일치하고 orderQuantity 가 유효해야 함)
      const recalcedUnmapped = state.unmapped.map(recalcRow);
      const isPromotable = (r: POItemCandidate) =>
        r.status === "MAPPED" &&
        r.supplierItem !== null &&
        r.supplierItem.supplyUnitCode === fromUnit &&
        r.orderQuantity !== null;
      const promoted = recalcedUnmapped.filter(isPromotable);
      const remainingUnmapped = recalcedUnmapped.filter((r) => !isPromotable(r));
    
      return {
        ...state,
        mapped: [...state.mapped.map(recalcRow), ...promoted],
        mappedPartialStock: state.mappedPartialStock.map(recalcRow),
        mappedFullStock: state.mappedFullStock.map(recalcRow),
        unmapped: remainingUnmapped,
      };
    }      

    case "SET_ORDER_DATE":
      return { ...state, orderDate: action.payload };
    // ★ Phase 1.6 (D15-1)
    case "SET_OUTBOUND_DATE":
      return { ...state, outboundDate: action.payload };
    case "SET_NOTE":
      return { ...state, note: action.payload };
    // ★ D19
    case "SET_AS_DEFAULT":
      return {
        ...state,
        setAsDefaultMap: {
          ...state.setAsDefaultMap,
          [action.payload.materialRequirementId]: action.payload.value,
        },
      };
    // ★ R1-b1
    case "SET_IDEMPOTENCY_KEY":
      return { ...state, idempotencyKey: action.payload };
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload.mode,
        basedOnPOIds: action.payload.basedOnPOIds,
        // ★ D24 (D-IDEMPOTENCY-PER-MODE): 모드 전환 시 idempotencyKey 무효화
        //    useEffect가 새 mode로 재발급/복원하도록 강제
        idempotencyKey: null,
        // ★ R1-b3: 모드 변경 시 preview 리셋
        deltaPreview: null,
        deltaPreviewLoading: false,
        deltaPreviewError: null,
      };

    case "DELTA_PREVIEW_START":
      return { ...state, deltaPreviewLoading: true, deltaPreviewError: null };
    case "DELTA_PREVIEW_SUCCESS":
      return {
        ...state,
        deltaPreviewLoading: false,
        deltaPreview: action.payload,
        deltaPreviewError: null,
      };
    case "DELTA_PREVIEW_ERROR":
      return {
        ...state,
        deltaPreviewLoading: false,
        deltaPreviewError: action.payload,
      };
    case "DELTA_PREVIEW_RESET":
      return {
        ...state,
        deltaPreview: null,
        deltaPreviewLoading: false,
        deltaPreviewError: null,
      };

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

  // ★ R1-b1 + D24: 식단그룹 + countSource + mode가 정해지면 모드별 멱등성 토큰 발급/복원
  useEffect(() => {
    if (!state.mealPlanGroup) return;
    if (state.idempotencyKey) return;
    const token = getOrCreateIdempotencyToken(
      state.mealPlanGroup.id,
      state.countSource,
      state.mode,
    );
    dispatch({ type: "SET_IDEMPOTENCY_KEY", payload: token });
  }, [state.mealPlanGroup, state.countSource, state.mode, state.idempotencyKey]);

  // ★ R1-b3: DELTA 모드 — candidates 변경 감지 후 프리뷰 자동 호출
  // - mode !== DELTA: 호출 안 함
  // - basedOnPOIds 비어있음: 호출 안 함
  // - Step 2 이상 진입했을 때만 의미 있음
  useEffect(() => {
    if (state.mode !== "DELTA") return;
    if (state.basedOnPOIds.length === 0) return;
    if (!state.mealPlanGroup) return;
    if (state.step < 2) return;
    // Step 2 로드 결과가 아직 없으면 호출 안 함 (candidates 가 비어있을 수 있음)
    if (!state.loadResult) return;

    // candidates 구성: mapped + mappedPartialStock (확정된 supplierItem 있는 행만)
    const candidates = [...state.mapped, ...state.mappedPartialStock]
      .filter(
        (r) =>
          r.supplierItem !== null &&
          r.orderQuantity !== null &&
          r.orderQuantity > 0,
      )
      .map((r) => ({
        materialMasterId: r.materialMasterId,
        locationId: r.locationId,
        productionLineId: r.productionLineId || null,
        supplierId: r.supplierItem!.supplierId,
        supplierItemId: r.supplierItem!.id,
        quantity: r.orderQuantity!,
        unitPrice: r.unitPrice ?? 0,
        netRequiredG: r.netRequiredG ?? null,
      }));

    if (candidates.length === 0) {
      dispatch({ type: "DELTA_PREVIEW_RESET" });
      return;
    }

    let cancelled = false;
    const mealPlanGroupId = state.mealPlanGroup.id;
    const basedOnPOIds = state.basedOnPOIds;

    void (async () => {
      dispatch({ type: "DELTA_PREVIEW_START" });
      try {
        const { previewDeltaPlanAction } = await import(
          "@/features/purchase-order/actions/purchase-order.action"
        );
        const res = await previewDeltaPlanAction({
          mealPlanGroupId,
          basedOnPOIds,
          candidates,
        });
        if (cancelled) return;
        if (!res.success) {
          dispatch({ type: "DELTA_PREVIEW_ERROR", payload: res.error.message });
          return;
        }
        dispatch({ type: "DELTA_PREVIEW_SUCCESS", payload: res.data });
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "DELTA_PREVIEW_ERROR",
          payload: err instanceof Error ? err.message : "프리뷰 호출 실패",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // candidates 직렬화 키 — materialRequirementId × qty × price × supplierItem.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.mode,
    state.basedOnPOIds.join(","),
    state.mealPlanGroup?.id,
    state.step,
    state.loadResult,
    // 편집 변경 감지용 직렬화 키
    [...state.mapped, ...state.mappedPartialStock]
      .filter((r) => r.supplierItem)
      .map(
        (r) =>
          `${r.materialRequirementId}|${r.supplierItem!.id}|${r.orderQuantity}|${r.unitPrice}`,
      )
      .sort()
      .join(";"),
  ]);

  // localStorage persistence (편집 상태만 저장 — loadResult/mapped는 다시 로드)
  const persistedState = {
    countSource: state.countSource,
    edits: Object.fromEntries(
      [...state.mapped, ...state.mappedPartialStock]
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
    // ★ Phase 1.6 (D15-1): localStorage 키도 outboundDate 로 변경
    //   (구 데이터 deliveryDate 는 use-wizard-persistence.ts 의 hydration 에서 무시되어 자연 소멸)
    outboundDate: state.outboundDate?.toISOString() ?? null,
    note: state.note,
  };

  const { clearPersisted } = useWizardPersistence(
    state.mealPlanGroup?.id ?? null,
    state.mapped.length + state.mappedPartialStock.length > 0
      ? persistedState
      : null,
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
            // ★ R1-b2: 모드 선택
            mode={state.mode}
            basedOnPOIds={state.basedOnPOIds}
            onChangeMode={(mode, basedOnPOIds) =>
              dispatch({ type: "SET_MODE", payload: { mode, basedOnPOIds } })
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
            /* ★ R1-b5-2 (D20): mode / deltaPreview* props 제거 — Step 2 차분 미표시 */
          />
        )}

        {state.step === 3 && (
          <StepMappingTable
            mapped={state.mapped}
            mappedPartialStock={state.mappedPartialStock}
            mappedFullStock={state.mappedFullStock}
            unmapped={state.unmapped}
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
            onResolveUnmapped={(materialRequirementId, supplierItem) =>
              dispatch({
                type: "RESOLVE_UNMAPPED",
                payload: { materialRequirementId, supplierItem },
              })
            }
            onRegisterConversion={(payload) =>
              dispatch({
                type: "REFRESH_ROW_AFTER_CONVERSION",
                payload,
              })
            }
            // ★ D19
            setAsDefaultMap={state.setAsDefaultMap}
            onToggleSetAsDefault={(materialRequirementId, value) =>
              dispatch({
                type: "SET_AS_DEFAULT",
                payload: { materialRequirementId, value },
              })
            }
            /* ★ R1-b5-4: DELTA 인라인 차분 */
            mode={state.mode}
            deltaPreview={state.deltaPreview}
          />
        )}

        {/* ★ D25-3: 모드별 분기 미리보기 (NEW/DELTA/REPLACE) */}
        {state.step === 4 && (
          <WizardPreviewPanel
            mode={state.mode}
            mapped={state.mapped}
            mappedPartialStock={state.mappedPartialStock}
            deltaPreview={state.deltaPreview}
            deltaPreviewLoading={state.deltaPreviewLoading}
            deltaPreviewError={state.deltaPreviewError}
            basedOnPOIds={state.basedOnPOIds}
            scopeLevel="COMPANY" /* TODO(Phase 4-E): pull from session.userScope */            
          />
        )}

        {state.step === 5 && state.mealPlanGroup && (
          <StepConfirmCreate
            mealPlanGroupId={state.mealPlanGroup.id}
            mapped={state.mapped}
            mappedPartialStock={state.mappedPartialStock}
            orderDate={state.orderDate}
            /* ★ Phase 1.6 (D15-1) */
            outboundDate={state.outboundDate}
            note={state.note}
            /* R1-b1: 멱등성 + 모드 정보 전달 */
            idempotencyKey={state.idempotencyKey}
            countSource={state.countSource}
            mode={state.mode}
            basedOnPOIds={state.basedOnPOIds}
            onChangeOrderDate={(d) =>
              dispatch({ type: "SET_ORDER_DATE", payload: d })
            }
            /* ★ Phase 1.6 (D15-1) */
            onChangeOutboundDate={(d) =>
              dispatch({ type: "SET_OUTBOUND_DATE", payload: d })
            }
            onChangeNote={(s) =>
              dispatch({ type: "SET_NOTE", payload: s })
            }
            onClearPersistence={() =>
              clearPersisted(state.mealPlanGroup?.id ?? null)
            }
            /* ★ R1-b3 */
            deltaPreview={state.deltaPreview}
            deltaPreviewLoading={state.deltaPreviewLoading}
            deltaPreviewError={state.deltaPreviewError}
            // ★ D19
            setAsDefaultMap={state.setAsDefaultMap}
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