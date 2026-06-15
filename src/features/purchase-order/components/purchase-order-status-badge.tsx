"use client";

import type { POStatus } from "@prisma/client";
import {
  PO_STATUS_LABELS,
  PO_STATUS_BADGE_COLOR,
} from "../schemas/purchase-order.schema";

const COLOR_CLASS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function PurchaseOrderStatusBadge({ status }: { status: POStatus }) {
  const color = PO_STATUS_BADGE_COLOR[status] ?? "gray";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_CLASS[color]}`}
    >
      {PO_STATUS_LABELS[status]}
    </span>
  );
}
