"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // ★ D30 C-3-b1
import { PurchaseOrderStatusBadge } from "./purchase-order-status-badge";
import { POStatusTransitionDialog } from "./po-status-transition-dialog";
import { ReceivingNoteStatusBadge } from "@/features/receiving-note/components/receiving-note-status-badge"; // ★ D30 C-3-b1
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isPurchaseOrderLocked,
  getNextAllowedStatuses,
} from "../schemas/purchase-order.schema";
import type { getPurchaseOrderByIdAction } from "../actions/purchase-order.action";
import { formatExpectedReceiveDate } from "../lib/format-lead-time";

type ActionData = Extract<
  Awaited<ReturnType<typeof getPurchaseOrderByIdAction>>,
  { success: true }
>["data"];
type POData = NonNullable<ActionData>;

const formatCurrency = (v: number | null | undefined) =>
  v == null
    ? "-"
    : new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0,
      }).format(v);

const formatDate = (d: Date | string | null | undefined) =>
  d == null ? "-" : new Date(d).toLocaleDateString("ko-KR");

const formatDateTime = (d: Date | string | null | undefined) =>
  d == null ? "-" : new Date(d).toLocaleString("ko-KR");

export function PurchaseOrderDetail({ po }: { po: POData }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const locked = isPurchaseOrderLocked(po.status);
  const nextStatuses = getNextAllowedStatuses(po.status);

  // ★ D30 C-3-b1: 입고서 작성/보기 버튼 상태 결정
  //   - SUBMITTED 이고 노트 없음     → "입고서 작성" (/receiving/notes/new?poId=...)
  //   - 노트 존재 (DRAFT/CONFIRMED)  → "입고서 보기" (/receiving/notes/[id])
  //   - 그 외 (DRAFT/APPROVED/CANCELLED 등 노트 없음) → 버튼 숨김
  const existingNote = po.receivingNotes?.[0] ?? null;
  const canCreateNote = po.status === "SUBMITTED" && !existingNote;
  const noteButton = existingNote ? (
    <Button asChild variant="outline">
      <Link href={`/receiving/notes/${existingNote.id}`}>입고서 보기</Link>
    </Button>
  ) : canCreateNote ? (
    <Button asChild variant="outline">
      <Link href={`/receiving/notes/new?poId=${po.id}`}>입고서 작성</Link>
    </Button>
  ) : null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{po.orderNumber}</h1>
            <PurchaseOrderStatusBadge status={po.status} />
            {po.isManual && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                수동 발주
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            발주일 {formatDate(po.orderDate)} · 생성자{" "}
            {po.createdByUser?.name ?? "-"}
          </p>
        </div>
        <div className="flex gap-2">
          {noteButton /* ★ D30 C-3-b1 */}
          {!locked && nextStatuses.length > 0 && (
            <Button onClick={() => setDialogOpen(true)}>상태 변경</Button>
          )}
          {locked && (
            <span className="text-sm text-gray-400">
              {po.status === "RECEIVED" ? "입고 완료 (잠금)" : "취소됨 (잠금)"}
            </span>
          )}
        </div>
      </div>

      {/* 메타 그리드 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border bg-white p-4 text-sm md:grid-cols-4">
        <Meta label="공급업체" value={po.supplier?.name ?? "-"} />
        <Meta label="공장" value={po.location?.name ?? "-"} />
        <Meta label="라인" value={po.productionLine?.name ?? "-"} />
        <Meta label="총액" value={formatCurrency(Number(po.totalAmount))} />
        <Meta label="출고일" value={formatDate(po.outboundDate)} />
        <Meta label="식단 기준일" value={formatDate(po.mealPlanGroup?.planDate)} />
        <Meta label="품목 수" value={`${po.items.length}건`} />
        {po.submittedAt && (
          <Meta label="발주 등록" value={formatDateTime(po.submittedAt)} />
        )}
        {po.approvedAt && (
          <Meta
            label="승인"
            value={`${formatDateTime(po.approvedAt)} · ${po.approvedByUser?.name ?? "-"}`}
          />
        )}
        {po.cancelledAt && (
          <Meta
            label="취소"
            value={`${formatDateTime(po.cancelledAt)} · ${po.cancelledByUser?.name ?? "-"}`}
          />
        )}
        {po.cancelReason && (
          <Meta label="취소 사유" value={po.cancelReason} className="col-span-2 md:col-span-4" />
        )}
        {po.note && (
          <Meta label="비고" value={po.note} className="col-span-2 md:col-span-4" />
        )}
      </div>

      {/* 품목 테이블 */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">발주 품목</h2>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목</TableHead>
                <TableHead>공급업체 품목</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead>단위</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>예상 입고일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...po.items]
                .sort((a, b) => {
                  const da = a.itemExpectedReceiveDate
                    ? new Date(a.itemExpectedReceiveDate).getTime()
                    : Infinity;
                  const db = b.itemExpectedReceiveDate
                    ? new Date(b.itemExpectedReceiveDate).getTime()
                    : Infinity;
                  return da - db;
                })
                .map((it) => {
                  const name =
                    it.materialMaster?.name ??
                    it.subsidiaryMaster?.name ??
                    "-";
                  const code =
                    it.materialMaster?.code ??
                    it.subsidiaryMaster?.code ??
                    "";
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-gray-500">{code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {it.supplierItem?.productName ?? "-"}
                        </div>
                        {(it.supplierItem?.spec || it.supplierItem?.supplierItemCode) && (
                          <div className="text-xs text-gray-500">
                            {it.supplierItem?.spec && <span>{it.supplierItem.spec}</span>}
                            {it.supplierItem?.spec && it.supplierItem?.supplierItemCode && (
                              <span> · </span>
                            )}
                            {it.supplierItem?.supplierItemCode && (
                              <span>코드: {it.supplierItem.supplierItemCode}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(it.quantity).toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell>
                        {it.supplierItem?.supplyUnit?.code ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(it.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(it.totalPrice))}
                      </TableCell>
                      <TableCell>
                        {formatExpectedReceiveDate(
                          it.itemExpectedReceiveDate
                            ? new Date(it.itemExpectedReceiveDate)
                            : null,
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 입고 이력 — ★ D30 C-3-b1: 배지 + 행 클릭 이동 */}
      {po.receivingNotes && po.receivingNotes.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">입고 이력</h2>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>입고번호</TableHead>
                  <TableHead>입고일</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.receivingNotes.map((rn) => (
                  <TableRow
                    key={rn.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/receiving/notes/${rn.id}`)}
                  >
                    <TableCell className="font-medium text-blue-600">
                      {rn.receiveNumber}
                    </TableCell>
                    <TableCell>{formatDate(rn.receivedDate)}</TableCell>
                    <TableCell>
                      <ReceivingNoteStatusBadge status={rn.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 상태 전이 다이얼로그 */}
      <POStatusTransitionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        poId={po.id}
        orderNumber={po.orderNumber}
        currentStatus={po.status}
        onSuccess={() => {
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function Meta({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
    </div>
  );
}
