"use client";

import { useState } from "react";
import { PurchaseOrderList } from "@/features/purchase-order/components/purchase-order-list";
import type { PurchaseOrderRow } from "@/features/purchase-order/components/purchase-order-list";
import { PurchaseOrderFormDialog } from "@/features/purchase-order/components/purchase-order-form-dialog";

export default function PurchaseOrdersPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    setSelectedPO(null);
  };

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

      {/* 신규 등록 */}
      <PurchaseOrderFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSaved={handleSaved}
      />

      {/* Phase 4-C: selectedPO 기반 상세/상태전이 다이얼로그가 추가될 예정.
          현재는 행 클릭만 받아두고 다음 phase에서 연결. */}
      {selectedPO && (
        <div className="hidden">{/* placeholder to keep handler reachable */}</div>
      )}
    </div>
  );
}
