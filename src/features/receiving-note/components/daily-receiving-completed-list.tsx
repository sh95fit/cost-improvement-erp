"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, PackageCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyReceivingBundle } from "../services/daily-receiving.service";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 - 완료(completed) 리스트 (읽기 전용)
//   - RECEIVED PO 를 표시
//   - 확정된 입고서 상세로 이동 링크 제공 (Q2 정책)
// ════════════════════════════════════════

type Props = {
  completed: DailyReceivingBundle["completed"];
};

const fmtNumber = (n: number) =>
  new Intl.NumberFormat("ko-KR").format(Number.isFinite(n) ? n : 0);

const fmtDateTime = (d: Date | string | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mm}`;
};

export function DailyReceivingCompletedList({ completed }: Props) {
  if (completed.length === 0) {
    return (
      <section className="space-y-2">
        <SectionHeader count={0} />
        <div className="rounded-md border bg-white p-6 text-center text-sm text-gray-500">
          <PackageCheck className="mx-auto mb-2 h-6 w-6 text-gray-300" />
          이 날짜에 확정 완료된 발주가 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <SectionHeader count={completed.length} />
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">발주번호</TableHead>
              <TableHead className="w-[160px]">입고번호</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead className="w-[120px]">창고</TableHead>
              <TableHead className="w-[70px] text-center">품목</TableHead>
              <TableHead className="w-[120px] text-right">확정금액</TableHead>
              <TableHead className="w-[150px]">확정일시</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {completed.map((c) => (
              <TableRow key={c.purchaseOrderId}>
                <TableCell className="font-mono text-sm">
                  {c.orderNumber}
                </TableCell>
                <TableCell className="font-mono text-xs text-gray-600">
                  {c.receiveNumber ?? "-"}
                </TableCell>
                <TableCell>{c.supplierName}</TableCell>
                <TableCell>{c.locationName}</TableCell>
                <TableCell className="text-center text-sm">
                  {c.itemCount}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmtNumber(c.totalAmount)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {fmtDateTime(c.confirmedAt)}
                </TableCell>
                <TableCell className="text-right">
                  {c.receivingNoteId ? (
                    <Link
                      href={`/receiving/notes/${c.receivingNoteId}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      상세
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      <h2 className="text-sm font-semibold text-gray-900">확정 완료</h2>
      <span className="text-xs text-gray-500">({count}건)</span>
    </div>
  );
}
