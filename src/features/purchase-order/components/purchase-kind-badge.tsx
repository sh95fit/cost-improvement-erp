// src/features/purchase-order/components/purchase-kind-badge.tsx
// ★ S4-1-f (P12): 발주 유형 배지

import type { PurchaseKind } from "@prisma/client";

const PURCHASE_KIND_LABELS: Record<PurchaseKind, string> = {
  WIZARD: "식단",
  MANUAL_JIT: "수동 JIT",
  STOCK_KEEPING: "재고 확보",
};

const PURCHASE_KIND_COLORS: Record<PurchaseKind, string> = {
  WIZARD: "bg-blue-100 text-blue-700 border-blue-200",
  MANUAL_JIT: "bg-amber-100 text-amber-700 border-amber-200",
  STOCK_KEEPING: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

interface Props {
  purchaseKind: PurchaseKind;
  className?: string;
}

export function PurchaseKindBadge({ purchaseKind, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${PURCHASE_KIND_COLORS[purchaseKind]} ${className}`}
    >
      {PURCHASE_KIND_LABELS[purchaseKind]}
    </span>
  );
}
