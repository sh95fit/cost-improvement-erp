"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { loadPOWizardDataAction } from "@/features/purchase-order/actions/purchase-order.action";
import { Button } from "@/components/ui/button";
import type { BuildPOItemsResult } from "@/features/purchase-order/lib/build-po-items-from-mr";
import type { MealPlanGroupOption } from "./po-wizard";

interface Props {
  mealPlanGroupId: string;
  mealPlanGroup: MealPlanGroupOption;
  countSource: "ESTIMATED" | "FINAL";
  isLoading: boolean;
  loadResult: BuildPOItemsResult | null;
  loadError: string | null;
  onLoadStart: () => void;
  onLoadSuccess: (r: BuildPOItemsResult) => void;
  onLoadError: (msg: string) => void;
}

export function StepLoadSummary({
  mealPlanGroupId,
  mealPlanGroup,
  countSource,
  isLoading,
  loadResult,
  loadError,
  onLoadStart,
  onLoadSuccess,
  onLoadError,
}: Props) {
  // 자동 로드: Step 2 진입 시 1회 (mealPlanGroupId×countSource 조합이 변경될 때마다)
  const lastLoadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${mealPlanGroupId}:${countSource}`;
    if (lastLoadedKeyRef.current === key) return;
    if (isLoading) return;
    lastLoadedKeyRef.current = key;
    void runLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealPlanGroupId, countSource]);

  async function runLoad() {
    onLoadStart();
    try {
      const res = await loadPOWizardDataAction({
        mealPlanGroupId,
        countSource,
      });
      if (!res.success) {
        onLoadError(res.error.message);
        toast.error(res.error.message);
        return;
      }
      onLoadSuccess(res.data);
      toast.success(
        `자재 ${res.data.summary.totalCount}건을 로드했습니다 (매핑됨 ${res.data.summary.mappedCount} · 미매핑 ${res.data.summary.unmappedCount})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "자재 로드 실패";
      onLoadError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 2 — 필요량 로드</h2>
        <p className="mt-1 text-sm text-gray-600">
          선택한 식단 그룹의 MaterialRequirement를 조회하고 즐겨찾기 공급업체와
          자동 매핑합니다.
        </p>
      </div>

      {/* 선택 요약 */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          <div>
            <span className="text-gray-500">기준일</span>
            <p className="font-medium">
              {mealPlanGroup.planDate.toISOString().slice(0, 10)}
            </p>
          </div>
          <div>
            <span className="text-gray-500">식수 기준</span>
            <p className="font-medium">
              {countSource === "ESTIMATED" ? "예상 식수" : "확정 식수"}
            </p>
          </div>
          <div>
            <span className="text-gray-500">식단 수</span>
            <p className="font-medium">{mealPlanGroup.mealPlanCount}</p>
          </div>
          <div>
            <span className="text-gray-500">그룹 상태</span>
            <p className="font-medium">{mealPlanGroup.status}</p>
          </div>
        </div>
      </div>

      {/* 로드 결과 */}
      {isLoading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          자재 목록을 불러오는 중...
        </div>
      )}

      {loadError && !isLoading && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">에러</p>
          <p className="mt-1">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              lastLoadedKeyRef.current = null;
              void runLoad();
            }}
          >
            다시 시도
          </Button>
        </div>
      )}

      {loadResult && !isLoading && !loadError && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard
              label="전체"
              value={loadResult.summary.totalCount}
              tone="default"
            />
            <SummaryCard
              label="자동 매핑됨"
              value={loadResult.summary.mappedCount}
              tone="success"
            />
            <SummaryCard
              label="미매핑"
              value={loadResult.summary.unmappedCount}
              tone="warning"
              note="공급업체 선택 필요"
            />
            <SummaryCard
              label="재고 충당"
              value={loadResult.summary.noOrderNeededCount}
              tone="muted"
              note="발주 불필요"
            />
          </div>

          <div className="rounded-md border border-gray-200 p-4 text-sm">
            <p className="text-gray-600">예상 발주 금액 (매핑 행만)</p>
            <p className="mt-1 text-xl font-semibold">
              {loadResult.summary.estimatedTotalAmount.toLocaleString()} 원
            </p>
          </div>

          {loadResult.summary.totalCount === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              산출 결과가 비어 있습니다. 식단(MealPlan) 의 슬롯 / MR 산출 상태를
              확인하세요.
            </div>
          )}

          {loadResult.summary.unmappedCount > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">
                ⚠ 미매핑 자재 {loadResult.summary.unmappedCount} 건
              </p>
              <p className="mt-1">
                다음 단계(Step 3)에서 공급업체와 공급품목을 직접 선택해야 합니다.
                미매핑 자재가 1건이라도 남아있으면 발주 생성이 차단됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note?: string;
  tone: "default" | "success" | "warning" | "muted";
}) {
  const toneClass = {
    default: "border-gray-200 bg-white",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    muted: "border-gray-200 bg-gray-50 text-gray-500",
  }[tone];
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs opacity-80">{note}</p>}
    </div>
  );
}
