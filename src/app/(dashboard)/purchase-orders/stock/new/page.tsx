"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ManualPurchaseOrderForm } from "@/features/purchase-order/components/manual-purchase-order-form";

export default function StockKeepingPurchaseOrderNewPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Link
        href="/purchase-orders"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        발주 목록으로
      </Link>
      <div>
        <h1 className="text-2xl font-bold">재고 확보 발주 등록</h1>
        <p className="text-sm text-gray-500">
          특정 라인업/출고일에 귀속시키지 않고, 재고를 미리 확보하기 위한 발주를 생성합니다.
          입고 후 사용 처리 시점에 라인업 원가 축이 확보됩니다 (P12/P13).
        </p>
      </div>
      <ManualPurchaseOrderForm
        purchaseKind="STOCK_KEEPING"
        onCreated={() => router.push("/purchase-orders")}
        onCancel={() => router.push("/purchase-orders")}
      />
    </div>
  );
}
