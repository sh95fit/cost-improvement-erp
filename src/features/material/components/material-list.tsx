"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  getMaterialsAction,
  deleteMaterialAction,
  getMaterialDependenciesAction,
  setMaterialActiveAction,
} from "../actions/material.action";
import {
  Search,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  DependencyActionDialog,
  Stat,
  type BaseDependencies,
} from "./dependency-action-dialog";

type MaterialRow = {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string;
  unitCategory: string;
  stockGrade: string;
  isActive: boolean;                              // ★ M-Fix-R1 (D14-7)
  minStock: number | null;
  maxStock: number | null;
  shelfLifeDays: number | null;
  defaultSupplierItemId: string | null;
  defaultSupplierItem: {
    id: string;
    productName: string;
    currentPrice: number;
    supplyUnit: string;
    supplyUnitQty: number;
    supplier: { id: string; name: string; code: string };
  } | null;
  createdAt: Date;
};

// ★ M-Fix-R1: 의존성 카운트 (action 반환 타입과 동일하게)
type MaterialDeps = BaseDependencies & {
  activeSupplierItems: number;
  totalSupplierItems: number;
  materialRequirements: number;
  recipeIngredients: number;
  recipeBomSlotItems: number;
  bomItems: number;
  totalPurchaseOrderItems: number;
  activePurchaseOrderItems: number;
  totalMealPlanSlots: number;
  activeMealPlanSlots: number;
};


type Props = {
  onNew: () => void;
  onSelect: (material: MaterialRow) => void;
};

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  RAW: "원자재",
  OTHER: "기타",
};

const GRADE_LABELS: Record<string, string> = {
  A: "가",
  B: "나",
  C: "다",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(value);

export type { MaterialRow };

export function MaterialList({ onNew, onSelect }: Props) {
  const [items, setItems] = useState<MaterialRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [stockGrade, setStockGrade] = useState("");
  const [loading, setLoading] = useState(false);
  // ★ M-Fix-R1: 삭제/활성토글 통합 다이얼로그
  const [manageTarget, setManageTarget] = useState<MaterialRow | null>(null);

  const fetchMaterials = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getMaterialsAction({
          page,
          limit: 20,
          search: search || undefined,
          materialType: materialType || undefined,
          stockGrade: stockGrade || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        if (result.success) {
          const data = result.data as {
            items: MaterialRow[];
            pagination: typeof pagination;
          };
          setItems(data.items);
          setPagination(data.pagination);
        }
      } finally {
        setLoading(false);
      }
    },
    [search, materialType, stockGrade]
  );

  useEffect(() => {
    fetchMaterials(1);
  }, [fetchMaterials]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchMaterials(1);
  };

  // ★ M-Fix-R1: 의존성 조회
  const fetchDependencies = async (): Promise<MaterialDeps | null> => {
    if (!manageTarget) return null;
    const result = await getMaterialDependenciesAction(manageTarget.id);
    if (!result.success) {
      toast.error(result.error?.message ?? "의존성 조회에 실패했습니다");
      return null;
    }
    return result.data as MaterialDeps;
  };

  // ★ M-Fix-R1: 삭제 (소프트 삭제 + 의존성 가드)
  const handleDelete = async () => {
    if (!manageTarget) return;
    const result = await deleteMaterialAction(manageTarget.id);
    if (result.success) {
      toast.success("자재가 삭제되었습니다");
      fetchMaterials(pagination.page);
    } else {
      toast.error(result.error?.message ?? "자재 삭제에 실패했습니다");
    }
  };

  // ★ M-Fix-R1: 활성/비활성 토글
  const handleSetActive = async (isActive: boolean) => {
    if (!manageTarget) return;
    const result = await setMaterialActiveAction(manageTarget.id, isActive);
    if (result.success) {
      toast.success(isActive ? "활성화되었습니다" : "비활성화되었습니다");
      fetchMaterials(pagination.page);
    } else {
      toast.error(result.error?.message ?? "상태 변경에 실패했습니다");
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 필터 + 등록 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="자재명, 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <Select value={materialType} onValueChange={setMaterialType}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="RAW">원자재</SelectItem>
            <SelectItem value="OTHER">기타</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockGrade} onValueChange={setStockGrade}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="등급" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="A">가</SelectItem>
            <SelectItem value="B">나</SelectItem>
            <SelectItem value="C">다</SelectItem>
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
              <TableHead className="w-[80px]">유형</TableHead>
              <TableHead className="w-[60px]">단위</TableHead>
              <TableHead className="w-[60px] text-center">등급</TableHead>
              <TableHead className="w-[60px] text-center">상태</TableHead>{/* ★ M-Fix-R1 */}
              <TableHead>기본 공급업체</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="w-[50px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                  등록된 자재가 없습니다
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
                  <TableCell>
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {MATERIAL_TYPE_LABELS[item.materialType] ?? item.materialType}
                    </span>
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.stockGrade === "A"
                          ? "bg-red-50 text-red-700"
                          : item.stockGrade === "B"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-green-50 text-green-700"
                      }`}
                    >
                      {GRADE_LABELS[item.stockGrade] ?? item.stockGrade}
                    </span>
                  </TableCell>
                  {/* ★ M-Fix-R1: 활성 상태 표시 */}
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.isActive ? "활성" : "비활성"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.defaultSupplierItem ? (
                      <span className="text-sm">
                        {item.defaultSupplierItem.supplier.name}
                        <span className="ml-1 text-xs text-gray-400">
                          ({item.defaultSupplierItem.productName})
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">미지정</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* ★ M-Fix-R1: 휴지통 → 관리(설정) 아이콘 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setManageTarget(item);
                      }}
                      title="관리(삭제/활성)"
                    >
                      <Settings className="h-4 w-4 text-gray-600" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* ★ M-Fix-R1: 휴지통 → 관리(설정) 아이콘 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setManageTarget(item);
                      }}
                      title="관리(삭제/활성)"
                    >
                      <Settings className="h-4 w-4 text-gray-600" />
                    </Button>
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

      {/* 삭제 확인 */}
      {/* ★ M-Fix-R1: 의존성 다이얼로그 (삭제/활성 토글 통합) */}
      <DependencyActionDialog<MaterialDeps>
        open={!!manageTarget}
        onClose={() => setManageTarget(null)}
        entityLabel="자재"
        entityName={manageTarget ? `${manageTarget.code} ${manageTarget.name}` : ""}
        isCurrentlyActive={manageTarget?.isActive ?? false}
        fetchDependencies={fetchDependencies}
        onDelete={handleDelete}
        onSetActive={handleSetActive}
        renderCounts={(d) => (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="공급 품목 (활성/전체)" value={`${d.activeSupplierItems} / ${d.totalSupplierItems}`} />
            <Stat label="MR (소요량)" value={d.materialRequirements} />
            <Stat label="레시피" value={d.recipeIngredients + d.recipeBomSlotItems} />
            <Stat label="BOM" value={d.bomItems} />
            <Stat label="PO (진행/전체)" value={`${d.activePurchaseOrderItems} / ${d.totalPurchaseOrderItems}`} />
            <Stat label="식단 슬롯 (진행/전체)" value={`${d.activeMealPlanSlots} / ${d.totalMealPlanSlots}`} />
          </div>
        )}
      />
    </div>
  );
}