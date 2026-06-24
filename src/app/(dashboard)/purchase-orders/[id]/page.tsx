import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPurchaseOrderByIdAction } from "@/features/purchase-order/actions/purchase-order.action";
import { PurchaseOrderDetail } from "@/features/purchase-order/components/purchase-order-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getPurchaseOrderByIdAction(id);

  if (!result.success) {
    return (
      <div className="space-y-4">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          발주 목록으로
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error.message}
        </div>
      </div>
    );
  }

  if (!result.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/purchase-orders"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        발주 목록으로
      </Link>
      <PurchaseOrderDetail po={result.data} />
    </div>
  );
}
