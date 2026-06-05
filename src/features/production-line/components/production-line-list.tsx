"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getProductionLinesAction,
  deleteProductionLineAction,
  checkProductionLineDependenciesAction,
  getFactoryLocationOptionsAction,
} from "../actions/production-line.action";
import {
  Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
  Filter, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ProductionLineStatusValue } from "../schemas/production-line.schema";

type ProductionLineRow = {
  id: string;
  name: string;
  code: string;
  status: ProductionLineStatusValue;
  sortOrder: number;
  note: string | null;
  locationId: string;
  location: { id: string; code: string; name: string; type: string };
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StatusFilter = "all" | ProductionLineStatusValue;
type LocationFilter = "all" | string;

const STATUS_LABELS: Record<ProductionLineStatusValue, string> = {
  ACTIVE: "가동중",
  INACTIVE: "중지",
  MAINTENANCE: "정비중",
};

const STATUS_BADGE_COLORS: Record<ProductionLineStatusValue, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  MAINTENANCE: "bg-amber-50 text-amber-700",
};

type Props = {
  onNew: () => void;
  onEdit: (line: ProductionLineRow) => void;
};

export function ProductionLineList({ onNew, onEdit }: Props) {
  const [items, setItems] = useState<ProductionLineRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [locationOptions, setLocationOptions] = useState<
    { id: string; code: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductionLineRow | null>(
    null
  );
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<string[] | null>(null);

  // 위치 필터 옵션 로드
  useEffect(() => {
    (async () => {
      const result = await getFactoryLocationOptionsAction();
      if (result.success) {
        setLocationOptions(
          result.data.map((l) => ({ id: l.id, code: l.code, name: l.name }))
        );
      }
    })();
  }, []);

  const fetchLines = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getProductionLinesAction({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          locationId: locationFilter === "all" ? undefined : locationFilter,
          sortBy: "sortOrder",
          sortOrder: "asc",
        });

        if (result.success) {
          setItems(result.data.items as ProductionLineRow[]);
          setPagination(result.data.pagination);
        } else {
          toast.error(result.error.message || "목록을 불러오는데 실패했습니다");
        }
      } catch {
        toast.error("목록을 불러오는데 실패했습니다");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, locationFilter]
  );

  useEffect(() => {
    fetchLines(1);
  }, [fetchLines]);

  const handleSearch = () => fetchLines(1);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDeleteClick = async (line: ProductionLineRow) => {
    setDeleteTarget(line);
    setDeleteBlocked(null);
    setDeleteChecking(true);
    try {
      const result = await checkProductionLineDependenciesAction(line.id);
      if (!result.success) {
        toast.error(result.error.message || "의존성 확인에 실패했습니다");
        setDeleteTarget(null);
        return;
      }
      if (!result.data.canDelete) {
        setDeleteBlocked(result.data.reasons);
      }
    } finally {
      setDeleteChecking(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const result = await deleteProductionLineAction(deleteTarget.id);
    if (result.success) {
      toast.success("생산라인이 삭제되었습니다");
      setDeleteTarget(null);
      if (items.length === 1 && pagination.page > 1) {
        fetchLines(pagination.page - 1);
      } else {
        fetchLines(pagination.page);
      }
    } else {
      toast.error(result.error.message || "삭제에 실패했습니다");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 필터 + 등록 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="라인명 또는 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select
            value={locationFilter}
            onValueChange={(v: LocationFilter) => setLocationFilter(v)}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 공장</SelectItem>
              {locationOptions.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  [{loc.code}] {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v: StatusFilter) => setStatusFilter(v)}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="ACTIVE">가동중</SelectItem>
            <SelectItem value="INACTIVE">중지</SelectItem>
            <SelectItem value="MAINTENANCE">정비중</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          생산라인 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>라인명</TableHead>
              <TableHead>소속 공장</TableHead>
              <TableHead className="w-[90px] text-center">상태</TableHead>
              <TableHead className="w-[80px] text-right">정렬</TableHead>
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  등록된 생산라인이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {item.note && (
                      <div className="line-clamp-1 text-xs text-gray-500">
                        {item.note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    [{item.location.code}] {item.location.name}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_COLORS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.sortOrder}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
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
            총 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchLines(pagination.page - 1)}
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
              onClick={() => fetchLines(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteBlocked(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>생산라인을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteChecking ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    의존성 확인 중...
                  </div>
                ) : deleteBlocked ? (
                  <>
                    <div className="text-sm">
                      &apos;{deleteTarget?.name}&apos; ({deleteTarget?.code})은(는)
                      다음 사유로 삭제할 수 없습니다:
                    </div>
                    <ul className="list-disc pl-5 text-sm text-red-600">
                      {deleteBlocked.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="text-sm">
                    &apos;{deleteTarget?.name}&apos; ({deleteTarget?.code})을(를)
                    삭제합니다.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            {!deleteChecking && !deleteBlocked && (
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                삭제
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
