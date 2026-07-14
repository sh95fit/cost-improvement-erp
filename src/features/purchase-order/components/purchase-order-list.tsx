"use client";

import { useEffect, useState, useCallback } from "react";
import type { POStatus, PurchaseKind } from "@prisma/client";
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
import { PurchaseKindBadge } from "./purchase-kind-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "./bulk-action-bar";

export type PurchaseOrderRow = {
  id: string;
  orderNumber: string;
  status: POStatus;
  // ★ S4-1-f (P12): 발주 유형
  purchaseKind: PurchaseKind;
  orderDate: Date;
  outboundDate: Date | null;
  expectedReceiveDate: Date | null;
  totalAmount: number | null;
  isManual: boolean;
  supplier: { id: string; name: string; code: string };
  location: { id: string; name: string; code: string } | null;
  productionLine: { id: string; name: string; code: string } | null;
  mealPlanGroup: { id: string; planDate: Date } | null;
  createdByUser: { id: string; name: string } | null;
  _count: { items: number };
  createdAt: Date;
};

type Props = {
  onNew: () => void;
  // ★ Sprint 3.5 Phase S3.5-2: 수동 발주 진입점
  onManualNew: () => void;
  // ★ S4-1-b (P12): STOCK_KEEPING 발주 진입점
  onStockNew: () => void;
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

// ★ FIX-PO-LIST-CANCELLED (D27): C-1 정책 — 취소는 보존하되 기본 목록에서 숨김.
//   "활성" = CANCELLED 제외 (DRAFT/SUBMITTED/APPROVED/RECEIVED)
//   "전체" = CANCELLED 포함 모든 상태
type StatusFilter = POStatus | "active" | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "활성 (취소 제외)" },
  { value: "all", label: "전체 (취소 포함)" },
  { value: "DRAFT", label: PO_STATUS_LABELS.DRAFT },
  { value: "SUBMITTED", label: PO_STATUS_LABELS.SUBMITTED },
  { value: "APPROVED", label: PO_STATUS_LABELS.APPROVED },
  { value: "RECEIVED", label: PO_STATUS_LABELS.RECEIVED },
  { value: "CANCELLED", label: PO_STATUS_LABELS.CANCELLED },
];

export function PurchaseOrderList({ onNew, onManualNew, onStockNew, onSelect }: Props) {
  const [items, setItems] = useState<PurchaseOrderRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  // ★ S4-1-f (P12): 발주 유형 필터 (WIZARD / MANUAL_JIT / STOCK_KEEPING)
  const [purchaseKindFilter, setPurchaseKindFilter] = useState<"all" | PurchaseKind>("all");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderRow | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedRows = items.filter((it) => selectedIds.has(it.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((it) => it.id)),
    );
  };

  const clearSelection = () => setSelectedIds(new Set());

  const fetchPurchaseOrders = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getPurchaseOrdersAction({
          page,
          limit: 20,
          search: search || undefined,
          // ★ FIX-PO-LIST-CANCELLED (D27): "활성" 은 새 statusNotIn 파라미터 사용
          status:
            statusFilter === "all" || statusFilter === "active"
              ? undefined
              : statusFilter,
          excludeCancelled: statusFilter === "active" ? true : undefined,
          // ★ S4-1-f (P12): purchaseKind 필터
          purchaseKind:
            purchaseKindFilter === "all" ? undefined : purchaseKindFilter,
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
        setSelectedIds(new Set()); // 목록 갱신 시 선택 초기화
        setLoading(false);
      }
    },
    [search, statusFilter, purchaseKindFilter]
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
      <BulkActionBar
        selectedRows={selectedRows.map((r) => ({ id: r.id, status: r.status }))}
        onCompleted={() => fetchPurchaseOrders(pagination.page)}
        onClearSelection={clearSelection}
      />

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
        {/* ★ S4-1-f (P12): purchaseKind 3분할 필터 */}
        <Select
          value={purchaseKindFilter}
          onValueChange={(v) =>
            setPurchaseKindFilter(v as "all" | PurchaseKind)
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="발주 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            <SelectItem value="WIZARD">식단</SelectItem>
            <SelectItem value="MANUAL_JIT">수동 JIT</SelectItem>
            <SelectItem value="STOCK_KEEPING">재고 확보</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onManualNew} variant="outline" className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          수동 발주
        </Button>
        {/* ★ S4-1-b (P12): STOCK_KEEPING 발주 진입점 */}
        <Button onClick={onStockNew} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          재고 확보 발주
        </Button>
        <Button onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />
          발주 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
      <Table>
          <TableHeader>
            <TableRow>  
              <TableHead className="w-[40px] text-center">
                <Checkbox
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onCheckedChange={toggleAll}
                  aria-label="전체 선택"
                />
              </TableHead>
              <TableHead className="w-[160px]">발주번호</TableHead>
              <TableHead className="w-[100px] text-center">상태</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead className="w-[110px]">발주일</TableHead>
              <TableHead className="w-[110px]">공장</TableHead>
              <TableHead className="w-[100px]">라인</TableHead>
              <TableHead className="w-[110px]">식단기준일</TableHead>              
              {/* ★ Phase 1.6 (D15-1) */}
              <TableHead className="w-[110px]">출고일</TableHead>
              {/* ★ D20 (D-EXPECTED-RECEIVE-SIMPLIFIED): 헤더 입고예정일 컬럼 제거.
                  출고일이 헤더 단위 입고 기준일을 겸함 — 품목별은 상세에서 노출. */}
              <TableHead className="w-[80px] text-center">품목수</TableHead>
              <TableHead className="text-right">합계</TableHead>
              <TableHead className="w-[100px]">작성자</TableHead>
              <TableHead className="w-[50px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center text-gray-500">
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
                  <TableCell
                    className="w-[40px] text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleOne(item.id)}
                      aria-label={`${item.orderNumber} 선택`}
                    />
                  </TableCell>
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
                  <TableCell>
                    {item.location?.name ?? <span className="text-gray-400">-</span>}
                    {item.location?.code && (
                      <span className="ml-1 text-xs text-gray-400">({item.location.code})</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.productionLine?.name ?? (
                      <span className="text-gray-400">미지정</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <PurchaseKindBadge purchaseKind={item.purchaseKind} />
                      {item.mealPlanGroup?.planDate && (
                        <span className="text-xs text-gray-500">
                          {formatDate(item.mealPlanGroup.planDate)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {/* ★ Phase 1.6 (D15-1) */}
                  <TableCell className="text-sm">
                    {formatDate(item.outboundDate)}
                  </TableCell>
                  {/* ★ D20: expectedReceiveDate 컬럼 제거 — 출고일이 헤더 입고일 역할 겸함 */}
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
