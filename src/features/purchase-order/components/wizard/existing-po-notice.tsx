"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  getExistingPOsForMealPlanGroupAction,
  type ExistingPOSummary,
  type ExistingPOsSummaryResult,
} from "@/features/purchase-order/actions/purchase-order.action";
import type { POStatus } from "@prisma/client";

const STATUS_LABEL: Record<POStatus, string> = {
  DRAFT: "작성중",
  SUBMITTED: "발주등록",
  APPROVED: "발주확정",
  RECEIVED: "입고완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<POStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

interface Props {
  mealPlanGroupId: string;
  context: "step1" | "step5";
  /** ★ R1-b3: pos + counts 를 모두 부모에 전달 (모드 가용성 판정용) */
  onLoaded?: (result: ExistingPOsSummaryResult) => void;
}

/**
 * ★ R1-b1: 동일 식단그룹의 활성 PO 사전 안내 카드
 *
 * 차단이 아닌 정보 제공. PO가 없으면 아무것도 렌더링하지 않음.
 */
export function ExistingPONotice({ mealPlanGroupId, context, onLoaded }: Props) {
  const [pos, setPos] = useState<ExistingPOSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getExistingPOsForMealPlanGroupAction(mealPlanGroupId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error.message);
          onLoaded?.({
            pos: [],
            counts: { total: 0, draft: 0, submitted: 0, approved: 0, received: 0 },
          });
          return;
        }
        setPos(res.data.pos);
        onLoaded?.(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "기존 PO 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mealPlanGroupId, onLoaded]);

  if (isLoading || error || pos.length === 0) {
    return null;
  }

  const headline =
    context === "step1"
      ? `이 식단그룹에 이미 생성된 발주서가 ${pos.length}건 있습니다`
      : `생성 전 확인: 이 식단그룹에 활성 발주서 ${pos.length}건 존재`;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">{headline}</p>
          <p className="mt-1 text-xs text-amber-800">
            {(() => {
              const draft = pos.filter((p) => p.status === "DRAFT").length;
              const submitted = pos.filter((p) => p.status === "SUBMITTED").length;
              const locked = pos.filter(
                (p) => p.status === "APPROVED" || p.status === "RECEIVED",
              ).length;
              const parts: string[] = [];
              if (draft > 0) parts.push(`작성중 ${draft}건`);
              if (submitted > 0) parts.push(`발주등록 ${submitted}건`);
              if (locked > 0) parts.push(`발주확정·입고완료 ${locked}건 (변경 불가)`);
              return `상태별: ${parts.join(" · ")}`;
            })()}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            작성중·발주등록 PO는 차분 발주(DELTA)로 수정 가능, 작성중은 덮어쓰기(REPLACE)도
            가능합니다. 발주확정 이상은 변경 불가 — 부족분은 신규 발주로, 오배송·과다는
            재고 실사로 처리하세요.
          </p>

          <ul className="mt-3 space-y-1.5 text-xs">
            {pos.map((po) => (
              <li
                key={po.id}
                className="flex items-center justify-between rounded border border-amber-200 bg-white px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      STATUS_COLOR[po.status]
                    }`}
                  >
                    {STATUS_LABEL[po.status]}
                  </span>
                  <span className="font-mono text-gray-900">{po.orderNumber}</span>
                  <span className="text-gray-600">
                    {po.locationName}
                    {po.productionLineName ? ` · ${po.productionLineName}` : ""}
                  </span>
                  <span className="text-gray-600">· {po.supplierName}</span>
                  <span className="text-gray-500">· {po.itemCount}건</span>
                  <span className="font-medium text-gray-900">
                    · {po.totalAmount.toLocaleString()}원
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  {po.createdByName && <span>{po.createdByName}</span>}
                  <span>
                    {new Date(po.createdAt).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    target="_blank"
                    className="text-blue-600 hover:text-blue-800"
                    title="새 탭에서 상세보기"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
