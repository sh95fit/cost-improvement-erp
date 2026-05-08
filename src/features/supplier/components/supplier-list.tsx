"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getSuppliersAction, deleteSupplierAction } from "../actions/supplier.action";
import type { Supplier } from "@prisma/client";
import { Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { toast } from "sonner";

type SupplierWithCount = Supplier & { _count: { supplierItems: number } };

type Props = {
  onNew: () => void;
  onEdit: (supplier: Supplier) => void;
  onViewItems: (supplier: Supplier) => void;
};

export function SupplierList({ onNew, onEdit, onViewItems }: Props) {
  const [items, setItems] = useState<SupplierWithCount[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithCount | null>(null);

  const fetchSuppliers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getSuppliersAction({
        page,
        limit: 20,
        search: search || undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (result.success) {
        setItems(result.data.items);
        setPagination(result.data.pagination);
      } else {
        toast.error("목록을 불러오는데 실패했습니다");
      }
    } catch {
      toast.error("목록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchSuppliers(1);
  }, [fetchSuppliers]);

  const handleSearch = () => {
    fetchSuppliers(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const result = await deleteSupplierAction(deleteTarget.id);
    if (result.success) {
      toast.success("공급업체가 삭제되었습니다");
      fetchSuppliers(pagination.page);
    } else {
      toast.error(result.error.message || "삭제에 실패했습니다");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="업체명, 코드, 담당자로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          업체 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>업체명</TableHead>
              <TableHead className="w-[100px]">담당자</TableHead>
              <TableHead className="w-[130px]">연락처</TableHead>
              <TableHead className="w-[180px]">이메일</TableHead>
              <TableHead className="w-[90px] text-center">공급 품목</TableHead>
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                  등록된 공급업체가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.contactName || "-"}</TableCell>
                  <TableCell>{item.contactPhone || "-"}</TableCell>
                  <TableCell className="text-sm">{item.contactEmail || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewItems(item)}
                      className="gap-1"
                    >
                      <Package className="h-3.5 w-3.5" />
                      {item._count.supplierItems}건
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(item)}
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
              onClick={() => fetchSuppliers(pagination.page - 1)}
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
              onClick={() => fetchSuppliers(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공급업체를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteTarget?.name}&apos; ({deleteTarget?.code})을(를) 삭제합니다.
              등록된 공급 품목 {deleteTarget?._count.supplierItems}건도 함께 비활성화됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
