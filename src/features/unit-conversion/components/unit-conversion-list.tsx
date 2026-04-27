"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getUnitConversionsAction,
  deleteUnitConversionAction,
} from "../actions/unit-conversion.action";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Globe,
  Package,
} from "lucide-react";

type MaterialInfo = { id: string; name: string; code: string; unit: string };

export type UnitConversionRow = {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  unitCategory: string;
  materialMasterId: string | null;
  materialMaster: MaterialInfo | null;
};

type Props = {
  materialId?: string;
  onNew: () => void;
  onEdit: (item: UnitConversionRow) => void;
  compact?: boolean;
};

const UNIT_CATEGORY_LABELS: Record<string, string> = {
  WEIGHT: "중량",
  VOLUME: "용량",
  COUNT: "수량",
  LENGTH: "길이",
};

export function UnitConversionList({ materialId, onNew, onEdit, compact = false }: Props) {
  const [items, setItems] = useState<UnitConversionRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "global" | "material">("all");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnitConversionRow | null>(null);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getUnitConversionsAction({
          page,
          limit: 20,
          search: search || undefined,
          materialId: materialId || undefined,
          scope: materialId ? undefined : scope,
        });
        if (result.success) {
          const data = result.data as {
            items: UnitConversionRow[];
            pagination: typeof pagination;
          };
          setItems(data.items);
          setPagination(data.pagination);
        }
      } finally {
        setLoading(false);
      }
    },
    [search, materialId, scope]
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchData(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteUnitConversionAction(deleteTarget.id);
    if (result.success) {
      fetchData(pagination.page);
    }
    setDeleteTarget(null);
  };

  const getConversionLabel = (item: UnitConversionRow) => {
    if (item.materialMaster) {
      return `${item.materialMaster.name}: 1 ${item.fromUnit} = ${item.factor} ${item.toUnit}`;
    }
    return `1 ${item.fromUnit} = ${item.factor} ${item.toUnit}`;
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 필터 + 등록 */}
      <div className="flex items-center gap-3">
        {!compact && (
          <>
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="자재명, 단위로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            {!materialId && (
              <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="global">글로벌</SelectItem>
                  <SelectItem value="material">자재별</SelectItem>
                </SelectContent>
              </Select>
            )}
          </>
        )}
        <Button onClick={onNew} size={compact ? "sm" : "default"} className={compact ? "" : "ml-auto"}>
          <Plus className="mr-2 h-4 w-4" />
          환산 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              {!compact && <TableHead>자재</TableHead>}
              <TableHead>변환 전</TableHead>
              <TableHead className="w-[40px] text-center" />
              <TableHead>변환 후</TableHead>
              <TableHead className="text-right">계수</TableHead>
              <TableHead>분류</TableHead>
              <TableHead className="w-[80px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={compact ? 7 : 8}
                  className="h-24 text-center text-gray-500"
                >
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={compact ? 7 : 8}
                  className="h-24 text-center text-gray-500"
                >
                  등록된 단위 환산이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.materialMaster ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <Package className="h-3 w-3" />
                        자재별
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <Globe className="h-3 w-3" />
                        글로벌
                      </span>
                    )}
                  </TableCell>
                  {!compact && (
                    <TableCell className="font-medium">
                      {item.materialMaster
                        ? `${item.materialMaster.code} - ${item.materialMaster.name}`
                        : "-"}
                    </TableCell>
                  )}
                  <TableCell>{item.fromUnit}</TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="mx-auto h-4 w-4 text-gray-400" />
                  </TableCell>
                  <TableCell>{item.toUnit}</TableCell>
                  <TableCell className="text-right font-mono">
                    {item.factor}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {UNIT_CATEGORY_LABELS[item.unitCategory] ?? item.unitCategory}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
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
            총 {pagination.total}건 중{" "}
            {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchData(pagination.page - 1)}
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
              onClick={() => fetchData(pagination.page + 1)}
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
            <AlertDialogTitle>단위 환산을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && getConversionLabel(deleteTarget)} 환산 규칙을 삭제합니다.
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
