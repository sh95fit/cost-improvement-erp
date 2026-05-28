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
  getLineupsAction,
  deleteLineupAction,
  checkLineupDependenciesAction,
} from "../actions/lineup.action";
import {
  Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
  Filter, Loader2,
} from "lucide-react";
import { toast } from "sonner";

type LineupRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ActiveFilter = "true" | "false" | "all";

type Props = {
  onNew: () => void;
  onEdit: (lineup: LineupRow) => void;
};

export function LineupList({ onNew, onEdit }: Props) {
  const [items, setItems] = useState<LineupRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [loading, setLoading] = useState(false);

  // 삭제 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<LineupRow | null>(null);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<string[] | null>(null);

  const fetchLineups = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getLineupsAction({
        page,
        limit: 20,
        search: search || undefined,
        isActive: activeFilter,
        sortBy: "sortOrder",
        sortOrder: "asc",
      });

      if (result.success) {
        setItems(result.data.items as LineupRow[]);
        setPagination(result.data.pagination);
      } else {
        toast.error(result.error.message || "목록을 불러오는데 실패했습니다");
      }
    } catch {
      toast.error("목록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    fetchLineups(1);
  }, [fetchLineups]);

  const handleSearch = () => {
    fetchLineups(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDeleteClick = async (lineup: LineupRow) => {
    setDeleteTarget(lineup);
    setDeleteBlocked(null);
    setDeleteChecking(true);
    try {
      const result = await checkLineupDependenciesAction(lineup.id);
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

    const result = await deleteLineupAction(deleteTarget.id);
    if (result.success) {
      toast.success("라인업이 삭제되었습니다");
      setDeleteTarget(null);
      if (items.length === 1 && pagination.page > 1) {
        fetchLineups(pagination.page - 1);
      } else {
        fetchLineups(pagination.page);
      }
    } else {
      toast.error(result.error.message || "삭제에 실패했습니다");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 활성 필터 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="라인업명 또는 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select
            value={activeFilter}
            onValueChange={(v: ActiveFilter) => setActiveFilter(v)}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">사용중만</SelectItem>
              <SelectItem value="false">미사용만</SelectItem>
              <SelectItem value="all">전체</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          라인업 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>라인업명</TableHead>
              <TableHead className="w-[80px] text-center">상태</TableHead>
              <TableHead className="w-[80px] text-right">정렬</TableHead>
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                  등록된 라인업이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="line-clamp-1 text-xs text-gray-500">
                        {item.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.isActive ? "사용중" : "미사용"}
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
              onClick={() => fetchLineups(pagination.page - 1)}
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
              onClick={() => fetchLineups(pagination.page + 1)}
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
            <AlertDialogTitle>라인업을 삭제하시겠습니까?</AlertDialogTitle>
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
