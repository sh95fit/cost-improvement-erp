"use client";

import { useEffect, useState, useCallback } from "react";
import type { ReceivingNoteStatus } from "@prisma/client";
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
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { listReceivingNotesAction } from "../actions/list-receiving-notes.action";
import { RECEIVING_NOTE_STATUS_LABELS } from "../schemas/receiving-note.schema";
import { ReceivingNoteStatusBadge } from "./receiving-note-status-badge";

type ListResult = Awaited<ReturnType<typeof listReceivingNotesAction>>;
type ListData = Extract<ListResult, { success: true }>["data"];
export type ReceivingNoteRow = ListData["items"][number];

type Props = {
  onNew: () => void;
  onSelect: (rn: ReceivingNoteRow) => void;
};

const formatDate = (d: Date | string | null | undefined) =>
  d == null ? "-" : new Date(d).toLocaleDateString("ko-KR");

type StatusFilter = ReceivingNoteStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "DRAFT", label: RECEIVING_NOTE_STATUS_LABELS.DRAFT },
  { value: "CONFIRMED", label: RECEIVING_NOTE_STATUS_LABELS.CONFIRMED },
];

export function ReceivingNoteList({ onNew, onSelect }: Props) {
  const [items, setItems] = useState<ReceivingNoteRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await listReceivingNotesAction({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          sortBy: "receivedDate",
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
    [search, statusFilter],
  );

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchList(1);
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 필터 + 등록 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="입고번호로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          새 입고서
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">입고번호</TableHead>
              <TableHead className="w-[100px] text-center">상태</TableHead>
              <TableHead className="w-[140px]">발주번호</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead className="w-[120px]">공장</TableHead>
              <TableHead className="w-[110px]">입고일</TableHead>
              <TableHead className="w-[80px] text-center">품목수</TableHead>
              <TableHead className="w-[110px]">확정일</TableHead>
              <TableHead className="w-[100px]">확정자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                  등록된 입고서가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onSelect(item)}
                >
                  <TableCell className="font-mono text-sm">
                    {item.receiveNumber}
                  </TableCell>
                  <TableCell className="text-center">
                    <ReceivingNoteStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {item.purchaseOrder.orderNumber}
                  </TableCell>
                  <TableCell>
                    {item.purchaseOrder.supplier?.name ?? "-"}
                  </TableCell>
                  <TableCell>
                    {item.purchaseOrder.location?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(item.receivedDate)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {item._count.items}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(item.confirmedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.confirmedByUser?.name ?? "-"}
                  </TableCell>
                </TableRow>
              ))
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
