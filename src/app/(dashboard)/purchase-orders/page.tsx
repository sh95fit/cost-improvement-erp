"use client";

import { useState } from "react";
import { PurchaseOrderList } from "@/features/purchase-order/components/purchase-order-list";
import type { PurchaseOrderRow } from "@/features/purchase-order/components/purchase-order-list";
import { toast } from "sonner";

export default function PurchaseOrdersPage() {
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [refreshKey] = useState(0);

  // Phase 4-B′ (식단 기반 발주 위저드) 재설계 진행 중.
  // 그 전까지 신규 등록 UI는 비활성화 — 백엔드는 정상 동작.
  const handleNew = () => {
    toast.info(
      "발주 등록 UI를 식단(MealPlan) 기반 위저드로 재설계 중입니다. (Phase 4-B′ 진행 중)"
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">발주 관리</h1>
        <p className="text-sm text-gray-500">
          공급업체에 대한 발주서를 등록·관리하고 상태별로 추적합니다.
        </p>
      </div>

      {/* 재설계 안내 배너 */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">⚠ 발주 등록 UI 재설계 진행 중 (Phase 4-B′)</p>
        <p className="mt-1 text-amber-800">
          공급업체부터 선택하는 기존 흐름을 폐기하고, 식단(MealPlan) → 공장/라인 →
          자재 → 공급사 상품 매핑 순서의 위저드로 다시 만들고 있습니다. 그 전까지
          신규 발주는 시드/스크립트로만 생성됩니다. 목록·검색·상세·삭제는 정상
          동작합니다.
        </p>
      </div>

      <PurchaseOrderList
        key={refreshKey}
        onNew={handleNew}
        onSelect={(po) => setSelectedPO(po)}
      />

      {/* Phase 4-C: 상세/상태전이 다이얼로그 자리 */}
      {selectedPO && (
        <div className="hidden">{/* placeholder */}</div>
      )}
    </div>
  );
}
