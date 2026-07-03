"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceivingNoteStatusBadge } from "./receiving-note-status-badge";
import type { getReceivingDashboardSummaryAction } from "../actions/get-receiving-dashboard-summary.action";
import { DISCREPANCY_TYPE_LABELS } from "../schemas/receiving-note.schema";
import type { DiscrepancyType } from "@prisma/client";

type SummaryData = Extract<
  Awaited<ReturnType<typeof getReceivingDashboardSummaryAction>>,
  { success: true }
>["data"];

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

const DISCREPANCY_KEYS: DiscrepancyType[] = [
  "QUANTITY_SHORT",
  "QUANTITY_OVER",
  "UNIT_PRICE_DIFF",
  "ITEM_MISSING",
];

export function ReceivingDashboard({ summary }: { summary: SummaryData }) {
  const { counts, recentNotes, eligiblePOs, discrepancySummary30d } = summary;

  return (
    <div className="space-y-6">
      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="총 입고서" value={counts.totalNotes} suffix="건" />
        <StatCard
          label="확정 대기 (DRAFT)"
          value={counts.draftNotes}
          suffix="건"
          tone="amber"
        />
        <StatCard
          label="이번 달 확정"
          value={counts.confirmedThisMonth}
          suffix="건"
          tone="emerald"
        />
        <StatCard
          label="확정 대기 발주"
          value={counts.eligiblePOs}
          suffix="건"
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 최근 입고서 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">최근 입고서</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/receiving/notes">전체 보기 →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                등록된 입고서가 없습니다
              </p>
            ) : (
              <ul className="divide-y">
                {recentNotes.map((rn) => (
                  <li key={rn.id}>
                    <Link
                      href={`/receiving/notes/${rn.id}`}
                      className="flex items-center justify-between py-2 hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {rn.receiveNumber}
                          </span>
                          <ReceivingNoteStatusBadge status={rn.status} />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">
                          {rn.purchaseOrder.supplier?.name ?? "-"} ·{" "}
                          {rn.purchaseOrder.location?.name ?? "-"} ·{" "}
                          {rn._count.items}품목
                        </div>
                      </div>
                      <div className="ml-4 text-xs text-gray-500">
                        {formatDate(rn.receivedDate)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 확정 대기 PO */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">확정 대기 발주</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/receiving/notes/new">새 입고서 →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {eligiblePOs.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                입고 대기 발주가 없습니다
              </p>
            ) : (
              <ul className="divide-y">
                {eligiblePOs.map((po) => (
                  <li key={po.id}>
                    <Link
                      href={`/receiving/notes/new?poId=${po.id}`}
                      className="flex items-center justify-between py-2 hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm">{po.orderNumber}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">
                          {po.supplier?.name ?? "-"} ·{" "}
                          {po.location?.name ?? "-"} · {po._count.items}품목
                        </div>
                      </div>
                      <div className="ml-4 text-right text-xs text-gray-500">
                        <div>{formatDate(po.orderDate)}</div>
                        <div className="font-mono">
                          {formatCurrency(
                            po.totalAmount ? Number(po.totalAmount) : null,
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 30일 불일치 요약 */}
      <Link
        href="/receiving/discrepancies"
        className="block transition-shadow hover:shadow-md"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              최근 30일 불일치 요약 (총 {discrepancySummary30d.total}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {DISCREPANCY_KEYS.map((k) => (
                <div
                  key={k}
                  className="rounded-md border bg-gray-50 p-3 text-center"
                >
                  <div className="text-xs text-gray-500">
                    {DISCREPANCY_TYPE_LABELS[k]}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {discrepancySummary30d[k]}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  tone = "default",
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "default" | "amber" | "emerald" | "blue";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "blue"
          ? "text-blue-700"
          : "text-gray-900";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${toneClass}`}>
          {value.toLocaleString("ko-KR")}
          {suffix && (
            <span className="ml-1 text-sm font-normal text-gray-500">
              {suffix}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
