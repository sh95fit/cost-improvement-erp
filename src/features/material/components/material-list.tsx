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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getMaterialsAction, deleteMaterialAction } from "../actions/material.action";
import type { MaterialMaster } from "@prisma/client";
import { Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  RAW: "원자재",
  SEASONING: "양념류",
  PROCESSED: "가공식품",
  SEMI: "반제품",
  OTHER: "기타",
};

const STOCK_GRADE_LABELS: Record<string, string> = {
  A: "가",
  B: "나",
  C: "다",
};

const STOCK_GRADE_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-yellow-100 text-yellow-700",
  C: "bg-green-100 text-green-700",
};

type Props = {
  onEdit: (material: MaterialMaster) => void;
  onNew: () => void;
};

export function MaterialList({ onEdit, onNew }: Props) {
  const [items, setItems] = useState<MaterialMaster[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [materialType, setMaterialType] = useState<string>("ALL");
  const [stockGrade, setStockGrade] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaterialMaster | null>(null);

  const fetchMaterials = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getMaterialsAction({
        page,
        limit: 20,
        search: search || undefined,
        materialType: materialType !== "ALL" ? materialType : undefined,
        stockGrade: stockGrade !== "ALL" ? stockGrade : undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (result.success) {
        setItems(result.data.items);
        setPagination(result.data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [search, materialType, stockGrade]);

  useEffect(() => {
    fetchMaterials(1);
  }, [fetchMaterials]);

  const handleSearch = () => {
    fetchMaterials(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const result = await deleteMaterialAction(deleteTarget.id);
    if (result.success) {
      fetchMaterials(pagination.page);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 필터 + 등록 버튼 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="자재명 또는 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Select value={materialType} onValueChange={setMaterialType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="전체 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 유형</SelectItem>
            <SelectItem value="RAW">원자재</SelectItem>
            <SelectItem value="SEASONING">양념류</SelectItem>
            <SelectItem value="PROCESSED">가공식품</SelectItem>
            <SelectItem value="SEMI">반제품</SelectItem>
            <SelectItem value="OTHER">기타</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockGrade} onValueChange={setStockGrade}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="전체 등급" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 등급</SelectItem>
            <SelectItem value="A">가 등급</SelectItem>
            <SelectItem value="B">나 등급</SelectItem>
            <SelectItem value="C">다 등급</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          자재 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>자재명</TableHead>
              <TableHead className="w-[90px]">유형</TableHead>
              <TableHead className="w-[60px]">단위</TableHead>
              <TableHead className="w-[60px]">등급</TableHead>
              <TableHead className="w-[90px] text-right">최소 재고</TableHead>
              <TableHead className="w-[90px] text-right">최대 재고</TableHead>
              <TableHead className="w-[80px]">유통기한</TableHead>
              <TableHead className="w-[90px] text-right">관리</TableHead>
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
                  등록된 자재가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                      {MATERIAL_TYPE_LABELS[item.materialType] ?? item.materialType}
                    </span>
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STOCK_GRADE_COLORS[item.stockGrade]}`}>
                      {STOCK_GRADE_LABELS[item.stockGrade] ?? item.stockGrade}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.minStock != null ? item.minStock : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.maxStock != null ? item.maxStock : "-"}
                  </TableCell>
                  <TableCell>
                    {item.shelfLifeDays != null ? `${item.shelfLifeDays}일` : "-"}
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
              onClick={() => fetchMaterials(pagination.page - 1)}
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
              onClick={() => fetchMaterials(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>자재를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteTarget?.name}&apos; ({deleteTarget?.code})을(를) 삭제합니다.
              이 작업은 되돌릴 수 있습니다 (소프트 삭제).
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
