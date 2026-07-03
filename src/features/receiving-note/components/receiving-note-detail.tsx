"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { getReceivingNoteByIdAction } from "../actions/get-receiving-note.action";
import { ReceivingNoteStatusBadge } from "./receiving-note-status-badge";
import { ReceivingDiscrepancyBadge } from "./receiving-discrepancy-badge";
import { ConfirmReceivingNoteDialog } from "./confirm-receiving-note-dialog";
import { PurchaseOrderStatusBadge } from "@/features/purchase-order/components/purchase-order-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ActionData = Extract<
  Awaited<ReturnType<typeof getReceivingNoteByIdAction>>,
  { success: true }
>["data"];
type NoteData = NonNullable<ActionData>;

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

export function ReceivingNoteDetail({ note }: { note: NoteData }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDraft = note.status === "DRAFT";
  const po = note.purchaseOrder;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{note.receiveNumber}</h1>
            <ReceivingNoteStatusBadge status={note.status} />
          </div>
          <p className="text-sm text-gray-500">
            입고일 {formatDate(note.receivedDate)}
            {note.confirmedAt && (
              <>
                {" · "}확정 {formatDateTime(note.confirmedAt)}
                {note.confirmedByUser && <> · {note.confirmedByUser.name}</>}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button onClick={() => setConfirmOpen(true)}>입고 확정</Button>
          )}
          {!isDraft && (
            <span className="text-sm text-gray-400">확정 완료 (잠금)</span>
          )}
        </div>
      </div>

      {/* 메타 그리드 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border bg-white p-4 text-sm md:grid-cols-4">
        <Meta
          label="발주서"
          value={
            <Link
              href={`/purchase-orders/${po.id}`}
              className="text-blue-600 hover:underline"
            >
              {po.orderNumber}
            </Link>
          }
        />
        <Meta
          label="발주 상태"
          value={<PurchaseOrderStatusBadge status={po.status} />}
        />
        <Meta label="공급업체" value={po.supplier?.name ?? "-"} />
        <Meta label="공장" value={po.location?.name ?? "-"} />
        <Meta label="라인" value={po.productionLine?.name ?? "-"} />
        <Meta label="품목 수" value={`${note.items.length}건`} />
        {note.note && (
          <Meta
            label="비고"
            value={note.note}
            className="col-span-2 md:col-span-4"
          />
        )}
      </div>

      {/* 입고 품목 테이블 */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">입고 품목</h2>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목</TableHead>
                <TableHead>공급업체 품목</TableHead>
                <TableHead className="text-right">발주 수량</TableHead>
                <TableHead className="text-right">입고 수량</TableHead>
                <TableHead>단위</TableHead>
                <TableHead className="text-right">발주 단가</TableHead>
                <TableHead className="text-right">입고 단가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {note.items.map((it) => {
                const poItem = it.purchaseOrderItem;
                const name =
                  poItem?.materialMaster?.name ??
                  poItem?.subsidiaryMaster?.name ??
                  "-";
                const code =
                  poItem?.materialMaster?.code ??
                  poItem?.subsidiaryMaster?.code ??
                  "";
                const qtyDiff =
                  poItem != null
                    ? Number(it.receivedQty) - Number(poItem.quantity)
                    : 0;
                const priceDiff =
                  poItem != null
                    ? Number(it.unitPrice) - Number(poItem.unitPrice)
                    : 0;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-gray-500">{code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {poItem?.supplierItem?.productName ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {poItem
                        ? Number(poItem.quantity).toLocaleString("ko-KR")
                        : "-"}
                    </TableCell>
                    <TableCell
                      className={`text-right ${qtyDiff !== 0 ? "font-semibold text-amber-600" : ""}`}
                    >
                      {Number(it.receivedQty).toLocaleString("ko-KR")}
                      {qtyDiff !== 0 && (
                        <span className="ml-1 text-xs">
                          ({qtyDiff > 0 ? "+" : ""}
                          {qtyDiff.toLocaleString("ko-KR")})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {poItem?.supplierItem?.supplyUnit?.code ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        poItem ? Number(poItem.unitPrice) : null,
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right ${priceDiff !== 0 ? "font-semibold text-blue-600" : ""}`}
                    >
                      {formatCurrency(Number(it.unitPrice))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 불일치 이력 (확정 후에만 존재) */}
      {note.discrepancies && note.discrepancies.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            불일치 이력 ({note.discrepancies.length}건)
          </h2>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">유형</TableHead>
                  <TableHead className="text-right">예상</TableHead>
                  <TableHead className="text-right">실제</TableHead>
                  <TableHead className="text-right">차이</TableHead>
                  <TableHead>사유</TableHead>
                  <TableHead className="w-[110px]">기록일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {note.discrepancies.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <ReceivingDiscrepancyBadge type={d.type} />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {d.type === "UNIT_PRICE_DIFF"
                        ? formatCurrency(
                            d.expectedUnitPrice
                              ? Number(d.expectedUnitPrice)
                              : null,
                          )
                        : d.expectedQty != null
                          ? Number(d.expectedQty).toLocaleString("ko-KR")
                          : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {d.type === "UNIT_PRICE_DIFF"
                        ? formatCurrency(
                            d.actualUnitPrice
                              ? Number(d.actualUnitPrice)
                              : null,
                          )
                        : d.actualQty != null
                          ? Number(d.actualQty).toLocaleString("ko-KR")
                          : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {d.diffValue != null
                        ? Number(d.diffValue).toLocaleString("ko-KR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {d.reason ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(d.recordedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 확정 다이얼로그 */}
      <ConfirmReceivingNoteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        receivingNoteId={note.id}
        receiveNumber={note.receiveNumber}
        onSuccess={() => {
          setConfirmOpen(false);
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
