"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createPurchaseOrdersBatchAction } from "@/features/purchase-order/actions/purchase-order.action";
import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";

interface Props {
  mealPlanGroupId: string;
  mapped: POItemCandidate[];
  orderDate: Date;
  deliveryDate: Date | null;
  note: string;
  onChangeOrderDate: (d: Date) => void;
  onChangeDeliveryDate: (d: Date | null) => void;
  onChangeNote: (s: string) => void;
  onClearPersistence: () => void;
}

export function StepConfirmCreate({
  mealPlanGroupId,
  mapped,
  orderDate,
  deliveryDate,
  note,
  onChangeOrderDate,
  onChangeDeliveryDate,
  onChangeNote,
  onClearPersistence,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validMapped = mapped.filter(
    (r) =>
      r.supplierItem !== null &&
      (r.orderQuantity ?? 0) > 0 &&
      (r.unitPrice ?? 0) >= 0,
  );

  async function handleSubmit() {
    if (validMapped.length === 0) {
      toast.warning("생성할 발주 항목이 없습니다");
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
      }));

      const res = await createPurchaseOrdersBatchAction({
        mealPlanGroupId,
        orderDate,
        deliveryDate: deliveryDate ?? undefined,
        note: note.trim() || undefined,
        items,
      });

      if (!res.success) {
        toast.error(res.error.message);
        return;
      }

      onClearPersistence();
      toast.success(
        `${res.data.count} 개 발주서를 생성했습니다 (총 ${res.data.totalAmount.toLocaleString()}원)`,
      );
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
          주문일·납기일·메모를 입력하고 발주서를 일괄 생성합니다. 모든 PO는
          DRAFT 상태로 생성되며, 단가 적층은 DRAFT → SUBMITTED 전이 시점에
          반영됩니다.
        </p>
      </div>

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
          <Label htmlFor="deliveryDate">납기일 (선택)</Label>
          <input
            id="deliveryDate"
            type="date"
            value={deliveryDate ? deliveryDate.toISOString().slice(0, 10) : ""}
            onChange={(e) =>
              onChangeDeliveryDate(
                e.target.value ? new Date(e.target.value) : null,
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
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
          disabled={isSubmitting || validMapped.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSubmitting ? "생성 중..." : `${validMapped.length}개 발주서 생성`}
        </Button>
      </div>
    </div>
  );
}
