"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createPurchaseOrdersBatchAction } from "@/features/purchase-order/actions/purchase-order.action";
import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";
import { ExistingPONotice } from "./existing-po-notice";
import { MODE_LABEL } from "./wizard-mode-selector";
import { DeltaPreviewCard } from "./delta-preview-card";
import type { PreviewDeltaPlanResult } from "@/features/purchase-order/actions/purchase-order.action";
import {
  calculateExpectedReceiveDate,
  formatExpectedReceiveDate,
  formatLeadTimeBadge,
} from "@/features/purchase-order/lib/format-lead-time";

interface Props {
  mealPlanGroupId: string;
  mapped: POItemCandidate[];
  /** ★ R1-a (D10) 분류 — 일부 재고 활용 행도 발주에 포함 */
  mappedPartialStock: POItemCandidate[];
  orderDate: Date;
  // ★ Phase 1.6 (D15-1): deliveryDate → outboundDate
  outboundDate: Date | null;
  note: string;
  // ★ R1-b1
  /** 위저드 세션 멱등성 키 — 그룹/countSource 정해지기 전에는 null */
  idempotencyKey: string | null;
  countSource: "ESTIMATED" | "FINAL";
  mode: "NEW" | "DELTA" | "REPLACE";
  basedOnPOIds: string[];
  onChangeOrderDate: (d: Date) => void;
  // ★ Phase 1.6 (D15-1)
  onChangeOutboundDate: (d: Date | null) => void;
  onChangeNote: (s: string) => void;
  // ★ R1-b3
  deltaPreview: PreviewDeltaPlanResult | null;
  deltaPreviewLoading: boolean;
  deltaPreviewError: string | null;
  onClearPersistence: () => void;
  // ★ D19
  setAsDefaultMap: Record<string, boolean>;
}

export function StepConfirmCreate({
  mealPlanGroupId,
  mapped,
  mappedPartialStock,
  orderDate,
  outboundDate,
  note,
  idempotencyKey,
  countSource,
  mode,
  basedOnPOIds,
  onChangeOrderDate,
  onChangeOutboundDate,
  onChangeNote,
  // ★ R1-b3
  deltaPreview,
  deltaPreviewLoading,
  deltaPreviewError,
  onClearPersistence,
  setAsDefaultMap,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ★ R1-a (D10): mapped + mappedPartialStock 양쪽 모두 발주 대상
  const allMapped = [...mapped, ...mappedPartialStock];
  const validMapped = allMapped.filter(
    (r) =>
      r.supplierItem !== null &&
      r.orderQuantity !== null &&
      r.orderQuantity > 0 &&
      r.unitPrice !== null &&
      r.unitPrice >= 0,
  );

  async function handleSubmit() {
    if (validMapped.length === 0) {
      toast.warning("생성할 발주 항목이 없습니다");
      return;
    }
    // ★ D21 (D-OUTBOUND-REQUIRED): 출고일은 UI 레벨 필수
    if (!outboundDate) {
      toast.warning("출고일을 입력해주세요");
      return;
    }
    // ★ R1-b1: 멱등성 키는 Step 1에서 발급되어야 함 — 누락 시 진행 차단
    if (!idempotencyKey) {
      toast.error(
        "위저드 세션 키가 없습니다. Step 1으로 돌아가 식단그룹을 다시 선택하세요",
      );
      return;
    }
    setIsSubmitting(true);

    try {
      const items = validMapped.map((r) => ({
        supplierId: r.supplierItem!.supplierId,
        supplierItemId: r.supplierItem!.id,
        itemType: "MATERIAL" as const,
        materialMasterId: r.materialMasterId,
        locationId: r.locationId,
        productionLineId: r.productionLineId || null,
        quantity: r.orderQuantity!,
        unitPrice: r.unitPrice ?? 0,
        materialRequirementId: r.materialRequirementId,
        systemQuantity: r.orderQuantityRaw ?? undefined,
        adjustedQuantity:
          r.orderQuantityRaw !== null &&
          r.orderQuantity !== r.orderQuantityRaw
            ? r.orderQuantity
            : undefined,
        // ★ D19
        setAsDefault: setAsDefaultMap[r.materialRequirementId] ?? false,
      }));

      const res = await createPurchaseOrdersBatchAction({
        mealPlanGroupId,
        orderDate,
        // ★ Phase 1.6 (D15-1): deliveryDate → outboundDate
        outboundDate: outboundDate ?? undefined,
        note: note.trim() || undefined,
        // ★ R1-b1
        idempotencyKey,
        countSource,
        mode,
        basedOnPOIds,
        items,
      });

      if (!res.success) {
        toast.error(res.error.message);
        return;
      }

      // ★ R1-b1: 멱등 replay (이미 같은 토큰으로 생성된 결과를 반환받은 경우)
      if (res.data.isIdempotentReplay) {
        onClearPersistence();
        toast.info(
          `이미 동일 세션으로 생성된 발주서 ${res.data.count}건이 있어 기존 결과를 반환합니다`,
        );
        router.push("/purchase-orders");
        return;
      }

      onClearPersistence();
      // ★ R1-b3/b4: DELTA/REPLACE 결과면 adjustmentSummary 로 변경 요약 노출
      const summary = res.data.adjustmentSummary;
      if (summary && mode === "DELTA") {
        toast.success(
          `차분 발주 완료 — 증가 ${summary.increased} · 감소 ${summary.decreased} · 신규 ${summary.added} · 단가변경 ${summary.priceChanged} · 변경없음 ${summary.unchanged}`,
        );
      } else if (summary && mode === "REPLACE") {
        toast.success(
          `덮어쓰기 완료 — 기존 ${summary.affectedPurchaseOrderIds.length}건 취소 · 신규 ${res.data.count}건 생성 (총 ${res.data.totalAmount.toLocaleString()}원)`,
        );
      } else {
        toast.success(
          `${res.data.count} 개 발주서를 생성했습니다 (총 ${res.data.totalAmount.toLocaleString()}원)`,
        );
      }
      router.push("/purchase-orders");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "발주서 생성 중 오류 발생",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 5 — 발주 생성</h2>
        <p className="mt-1 text-sm text-gray-600">
          주문일·출고일·메모를 입력하고 발주서를 일괄 생성합니다. 모든 PO는
          DRAFT 상태로 생성되며, 단가 적층은 DRAFT → SUBMITTED 전이 시점에
          반영됩니다. 출고일이 발주서 단위 입고 기준일을 겸하며, 품목별 예상
          입고일은 아래 목록에서 확인할 수 있습니다.
        </p>
      </div>

      {/* ★ R1-b2: 현재 모드 배지 */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">진행 모드:</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            mode === "NEW"
              ? "bg-blue-100 text-blue-800"
              : mode === "DELTA"
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {MODE_LABEL[mode]}
        </span>
        {mode === "REPLACE" && (
          <span className="text-xs text-red-700">
            ⚠ 기존 작성중·발주 확정 PO {basedOnPOIds.length}건이 모두 취소되고 새 발주서로 대체됩니다
          </span>
        )}
        {basedOnPOIds.length > 0 && (
          <span className="text-xs text-gray-500">
            기준 PO {basedOnPOIds.length}건
          </span>
        )}
        {mode === "DELTA" && (
          <span className="ml-2 text-xs text-blue-700">
            기존 PO 의 수량·단가가 갱신되고 변경 이력이 적층됩니다
          </span>
        )}
      </div>

      {/* ★ R1-b1: 동일 식단그룹의 기존 활성 PO 사전 안내 */}
      <ExistingPONotice mealPlanGroupId={mealPlanGroupId} context="step5" />

      {/* ★ R1-b3: DELTA 모드 차분 프리뷰 */}
      {mode === "DELTA" && (
        <DeltaPreviewCard
          preview={deltaPreview}
          isLoading={deltaPreviewLoading}
          error={deltaPreviewError}
          context="step5"
        />
      )}

      {/* ★ Phase 1.6 (D15-1, D15-2): 출고일 + 예상 입고일 미리보기 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="orderDate">주문일 *</Label>
          <input
            id="orderDate"
            type="date"
            value={orderDate.toISOString().slice(0, 10)}
            onChange={(e) =>
              onChangeOrderDate(new Date(e.target.value))
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outboundDate">
            출고일 <span className="text-red-500">*</span>
          </Label>
          <input
            id="outboundDate"
            type="date"
            value={outboundDate ? outboundDate.toISOString().slice(0, 10) : ""}
            onChange={(e) =>
              onChangeOutboundDate(
                e.target.value ? new Date(e.target.value) : null,
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {/* ★ D20 (D-EXPECTED-RECEIVE-SIMPLIFIED): 헤더 입고예정일 표시 제거.
              출고일이 헤더 단위 입고일 역할을 겸한다. 품목별 입고예정일은 상세에서 노출. */}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">공통 메모 (선택, 모든 PO에 동일하게 기록)</Label>
        <textarea
          id="note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => onChangeNote(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="예: 식단 그룹 기반 자동 생성"
        />
        <p className="text-xs text-gray-500">
          {note.length} / 1000
        </p>
      </div>

      {/* ★ D19: 기본 공급업체 품목 등록/변경 요약 */}
      {(() => {
        const defaultActions = validMapped.filter(
          (r) => setAsDefaultMap[r.materialRequirementId],
        );
        if (defaultActions.length === 0) return null;
        return (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
            <div className="font-medium text-blue-900">
              📌 기본 공급업체 품목 등록/변경 ({defaultActions.length}건)
            </div>
            <ul className="mt-1 list-disc pl-5 text-blue-800">
              {defaultActions.map((r) => (
                <li key={r.materialRequirementId}>
                  {r.materialName} → {r.supplierItem!.supplierName} ·{" "}
                  {r.supplierItem!.productName}{" "}
                  <span className="text-xs">
                    {r.currentDefaultSupplierItemId === null
                      ? "(신규 지정)"
                      : "(변경)"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* ★ D28: 품목별 예상 입고일 (D-N) — outboundDate 기준 클라이언트 계산 */}
      {validMapped.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
          <div className="mb-2 font-medium text-gray-900">
            품목별 예상 입고일 ({validMapped.length}건)
          </div>
          {!outboundDate ? (
            <p className="text-xs text-gray-500">
              출고일을 입력하면 품목별 D-N 배지가 표시됩니다
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {validMapped.map((r) => {
                const lt = r.supplierItem?.leadTimeDays ?? null;
                const eta = calculateExpectedReceiveDate(outboundDate, lt);
                return (
                  <li
                    key={r.materialRequirementId}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-gray-800">
                      {r.materialName}
                      <span className="ml-2 text-xs text-gray-500">
                        {r.supplierItem?.supplierName} ·{" "}
                        {r.supplierItem?.productName}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                        {formatLeadTimeBadge(lt)}
                      </span>
                      <span className="text-gray-600">
                        {formatExpectedReceiveDate(eta)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
        <p>
          <span className="text-gray-600">생성될 발주 행:</span>{" "}
          <span className="font-semibold">{validMapped.length} 건</span>
        </p>
        <p className="mt-1">
          <span className="text-gray-600">예상 총 금액:</span>{" "}
          <span className="font-semibold">
            {validMapped
              .reduce(
                (s, r) =>
                  s + (r.orderQuantity ?? 0) * (r.unitPrice ?? 0),
                0,
              )
              .toLocaleString()}{" "}
            원
          </span>
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || validMapped.length === 0 || !outboundDate}
          className={
            mode === "REPLACE"
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }
        >
          {isSubmitting
            ? "생성 중..."
            : mode === "REPLACE"
              ? `${basedOnPOIds.length}건 취소 후 ${validMapped.length}개 새로 생성`
              : mode === "DELTA"
                ? `차분 발주 적용 (${validMapped.length}건 비교)`
                : `${validMapped.length}개 발주서 생성`}
        </Button>
      </div>
    </div>
  );
}
