"use client";

import { useState } from "react";
import { PurchaseOrderList } from "@/features/purchase-order/components/purchase-order-list";
import type { PurchaseOrderRow } from "@/features/purchase-order/components/purchase-order-list";

export default function PurchaseOrdersPage() {
  const [, setShowCreateDialog] = useState(false);
  const [, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [refreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">발주 관리</h1>
        <p className="text-sm text-gray-500">
          공급업체에 대한 발주서를 등록·관리하고 상태별로 추적합니다.
        </p>
      </div>

      <PurchaseOrderList
        key={refreshKey}
        onNew={() => setShowCreateDialog(true)}
        onSelect={(po) => setSelectedPO(po)}
      />

      {/* Phase 4-B: 생성/수정 다이얼로그가 여기에 추가됨 */}
      {/* Phase 4-C: 상세/상태전이 다이얼로그가 여기에 추가됨 */}
    </div>
  );
}
