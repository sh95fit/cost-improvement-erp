"use client";

import { useRouter } from "next/navigation";
import { PurchaseOrderList } from "@/features/purchase-order/components/purchase-order-list";

export default function PurchaseOrdersPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">발주 관리</h1>
        <p className="text-sm text-gray-500">
          공급업체별 발주서를 등록·관리하고 상태별로 추적합니다.
        </p>
      </div>

      <PurchaseOrderList
        onNew={() => router.push("/purchase-orders/new")}
        onManualNew={() => router.push("/purchase-orders/manual/new")}
        onSelect={(po) => router.push(`/purchase-orders/${po.id}`)}
      />
    </div>
  );
}