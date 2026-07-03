"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { listReceivingDiscrepanciesAction } from "../actions/list-receiving-discrepancies.action";
import { ReceivingDiscrepancyBadge } from "./receiving-discrepancy-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type ListResult = Awaited<ReturnType<typeof listReceivingDiscrepanciesAction>>;
type ListData = Extract<ListResult, { success: true }>["data"];
type DiscrepancyRow = ListData["items"][number];

type TypeFilter =
  | "all"
  | "QUANTITY" // SHORT + OVER 묶음
  | "UNIT_PRICE_DIFF"
  | "ITEM_MISSING";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "QUANTITY", label: "수량 차이" },
  { value: "UNIT_PRICE_DIFF", label: "단가 차이" },
  { value: "ITEM_MISSING", label: "품목 누락" },
];

/**
 * 월 옵션 생성: 이번 달부터 12개월 과거까지 + "전체".
 * value: "all" | "YYYY-MM"
 */
function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [{ value: "all", label: "전체 기간" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const value = `${y}-${String(m).padStart(2, "0")}`;
    const label = `${y}년 ${m}월`;
    opts.push({ value, label });
  }
  return opts;
}

/**
 * 초기 월 값: URL 쿼리 파라미터 우선 → 없으면 이번 달 (YYYY-MM).
 */
function getInitialMonth(defaultMonth?: string): string {
  if (defaultMonth && /^\d{4}-\d{2}$/.test(defaultMonth)) return defaultMonth;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type Props = {
  initialMonth?: string; // URL ?month=YYYY-MM
};

export function ReceivingDiscrepancyList({ initialMonth }: Props) {
  const router = useRouter();
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const [items, setItems] = useState<DiscrepancyRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [month, setMonth] = useState<string>(getInitialMonth(initialMonth));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await listReceivingDiscrepanciesAction({
          page,
          limit: 20,
          month: month === "all" ? undefined : month,
          type: typeFilter === "all" ? undefined : typeFilter,
          search: search || undefined,
          sortBy: "recordedAt",
          sortOrder: "desc",
        });
        if (res.success) {
          setItems(res.data.items);
          setPagination(res.data.pagination);
        } else {
          toast.error(res.error.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [month, typeFilter, search],
  );

  useEffect(() => {
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, typeFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchList(1);
  };

  return (
    <div className="space-y-4">
      {/* 상단: 월 + 타입 + 검색 */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="월" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="유형" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="발주번호 또는 입고번호로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">기록일시</TableHead>
              <TableHead className="w-[140px]">발주번호</TableHead>
              <TableHead className="w-[160px]">입고번호</TableHead>
              <TableHead>품목</TableHead>
              <TableHead className="w-[120px]">유형</TableHead>
              <TableHead className="text-right">예상</TableHead>
              <TableHead className="text-right">실제</TableHead>
              <TableHead className="text-right">차이</TableHead>
              <TableHead>사유</TableHead>
              <TableHead className="w-[90px]">기록자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                  조건에 맞는 불일치 이력이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((d) => {
                const poItem = d.purchaseOrderItem;
                const itemName =
                  poItem?.materialMaster?.name ??
                  poItem?.subsidiaryMaster?.name ??
                  poItem?.supplierItem?.productName ??
                  "-";
                const itemCode =
                  poItem?.materialMaster?.code ??
                  poItem?.subsidiaryMaster?.code ??
                  "";
                const isPriceDiff = d.type === "UNIT_PRICE_DIFF";

                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">
                      {formatDateTime(d.recordedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/purchase-orders/${d.purchaseOrder.id}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.purchaseOrder.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.receivingNote ? (
                        <Link
                          href={`/receiving/notes/${d.receivingNote.id}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {d.receivingNote.receiveNumber}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{itemName}</div>
                      {itemCode && (
                        <div className="text-xs text-gray-500">{itemCode}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ReceivingDiscrepancyBadge type={d.type} />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {isPriceDiff
                        ? formatCurrency(
                            d.expectedUnitPrice != null
                              ? Number(d.expectedUnitPrice)
                              : null,
                          )
                        : d.expectedQty != null
                          ? Number(d.expectedQty).toLocaleString("ko-KR")
                          : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {isPriceDiff
                        ? formatCurrency(
                            d.actualUnitPrice != null
                              ? Number(d.actualUnitPrice)
                              : null,
                          )
                        : d.actualQty != null
                          ? Number(d.actualQty).toLocaleString("ko-KR")
                          : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {d.diffValue != null
                        ? isPriceDiff
                          ? formatCurrency(Number(d.diffValue))
                          : Number(d.diffValue).toLocaleString("ko-KR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {d.reason ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.recordedByUser?.name ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            총 {pagination.total}건 중{" "}
            {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchList(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchList(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
