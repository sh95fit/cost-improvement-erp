"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ManualPurchaseOrderForm } from "@/features/purchase-order/components/manual-purchase-order-form";

export default function ManualPurchaseOrderNewPage() {
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
        <h1 className="text-2xl font-bold">수동 발주 등록</h1>
        <p className="text-sm text-gray-500">
          식단과 무관하게 라인업 단위로 발주를 직접 생성합니다.
        </p>
      </div>
      <ManualPurchaseOrderForm
        onCreated={(id) => router.push(`/purchase-orders/${id}`)}
        onCancel={() => router.push("/purchase-orders")}
      />
    </div>
  );
}
