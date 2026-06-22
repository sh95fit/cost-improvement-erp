"use client";

import { useEffect, useState, useCallback } from "react";
import type { POStatus } from "@prisma/client";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  getPurchaseOrdersAction,
  deletePurchaseOrderAction,
} from "../actions/purchase-order.action";
import { PO_STATUS_LABELS } from "../schemas/purchase-order.schema";
import { PurchaseOrderStatusBadge } from "./purchase-order-status-badge";

export type PurchaseOrderRow = {
  id: string;
  orderNumber: string;
  status: POStatus;
  orderDate: Date;
  // ★ Phase 1.6 (D15-1, D15-2): deliveryDate → outboundDate + expectedReceiveDate
  outboundDate: Date | null;
  expectedReceiveDate: Date | null;
  totalAmount: number | null;
  isManual: boolean;
  supplier: { id: string; name: string; code: string };
  createdByUser: { id: string; name: string } | null;
  _count: { items: number };
  createdAt: Date;
};

type Props = {
  onNew: () => void;
  onSelect: (po: PurchaseOrderRow) => void;
};

const formatCurrency = (value: number | null) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0,
      }).format(value);

const formatDate = (d: Date | null) =>
  d == null ? "-" : new Date(d).toLocaleDateString("ko-KR");

const STATUS_OPTIONS: { value: POStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "DRAFT", label: PO_STATUS_LABELS.DRAFT },
  { value: "SUBMITTED", label: PO_STATUS_LABELS.SUBMITTED },
  { value: "APPROVED", label: PO_STATUS_LABELS.APPROVED },
  { value: "RECEIVED", label: PO_STATUS_LABELS.RECEIVED },
  { value: "CANCELLED", label: PO_STATUS_LABELS.CANCELLED },
];

export function PurchaseOrderList({ onNew, onSelect }: Props) {
  const [items, setItems] = useState<PurchaseOrderRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<POStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderRow | null>(null);

  const fetchPurchaseOrders = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getPurchaseOrdersAction({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          sortBy: "orderDate",
          sortOrder: "desc",
        });
        if (result.success) {
          const data = result.data as {
            items: PurchaseOrderRow[];
            pagination: typeof pagination;
          };
          setItems(data.items);
          setPagination(data.pagination);
        } else {
          toast.error(result.error.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  useEffect(() => {
    fetchPurchaseOrders(1);
  }, [fetchPurchaseOrders]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchPurchaseOrders(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deletePurchaseOrderAction(deleteTarget.id);
    if (result.success) {
      toast.success("발주서가 삭제되었습니다");
      fetchPurchaseOrders(pagination.page);
    } else {
      toast.error(result.error.message);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 필터 + 등록 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="발주번호, 비고로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as POStatus | "all")}
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
          발주 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">발주번호</TableHead>
              <TableHead className="w-[100px] text-center">상태</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead className="w-[110px]">발주일</TableHead>
              <TableHead className="w-[110px]">입고예정일</TableHead>
              <TableHead className="w-[80px] text-center">품목수</TableHead>
              <TableHead className="text-right">합계</TableHead>
              <TableHead className="w-[100px]">작성자</TableHead>
              <TableHead className="w-[50px] text-right">관리</TableHead>
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
                  등록된 발주서가 없습니다
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
                    {item.orderNumber}
                    {item.isManual && (
                      <span className="ml-2 inline-flex rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        수동
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <PurchaseOrderStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{item.supplier.name}</span>
                    <span className="ml-1 text-xs text-gray-400">
                      ({item.supplier.code})
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(item.orderDate)}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(item.outboundDate)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {item._count.items}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(item.totalAmount)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.createdByUser?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "DRAFT" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    ) : null}
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
              onClick={() => fetchPurchaseOrders(pagination.page - 1)}
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
              onClick={() => fetchPurchaseOrders(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>발주서 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              발주번호{" "}
              <span className="font-mono font-medium">
                {deleteTarget?.orderNumber}
              </span>
              {" "}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              <br />
              <span className="text-xs text-gray-500">
                ※ 작성중(DRAFT) 상태의 발주서만 삭제 가능합니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
