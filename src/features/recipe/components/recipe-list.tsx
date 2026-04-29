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
import { getRecipesAction, deleteRecipeAction } from "../actions/recipe.action";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export type RecipeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ingredients: { id: string; ingredientType: string; sortOrder: number }[];
  recipeBoms: { id: string; version: number; status: string }[];
  createdAt: Date;
};

type Props = {
  onNew: () => void;
  onSelect: (recipe: RecipeRow) => void;
};

export function RecipeList({ onNew, onSelect }: Props) {
  const [items, setItems] = useState<RecipeRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecipeRow | null>(null);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getRecipesAction({
          page,
          limit: 20,
          search: search || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        if (result.success) {
          const data = result.data as unknown as {
            items: RecipeRow[];
            pagination: typeof pagination;
          };
          setItems(data.items);
          setPagination(data.pagination);
        }
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchData(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteRecipeAction(deleteTarget.id);
    if (result.success) {
      fetchData(pagination.page);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="레시피명, 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          레시피 등록
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>레시피명</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="w-[80px] text-center">재료 수</TableHead>
              <TableHead className="w-[80px] text-center">BOM</TableHead>
              <TableHead className="w-[100px]">등록일</TableHead>
              <TableHead className="w-[50px] text-right">관리</TableHead>
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
                  등록된 레시피가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onSelect(item)}
                >
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-gray-500">
                    {item.description || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {item.ingredients.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.recipeBoms.length > 0 ? (
                      <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        {item.recipeBoms.length}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>레시피를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteTarget?.name}&apos; ({deleteTarget?.code})을(를) 삭제합니다.
              연결된 재료와 BOM도 함께 비활성화됩니다.
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
