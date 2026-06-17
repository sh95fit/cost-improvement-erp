"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getSubsidiariesAction,
  deleteSubsidiaryAction,
  getSubsidiaryDependenciesAction,    // ★ M-Fix-R1 (D14-9)
  setSubsidiaryActiveAction,          // ★ M-Fix-R1 (D14-10)
} from "../actions/material.action";
import { UNIT_CATEGORY_LABELS } from "@/lib/constants/unit-options";
import type { UnitCategory } from "@prisma/client";
import {
  Search, Plus, Settings, ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  DependencyActionDialog,
  Stat,
  type BaseDependencies,
} from "./dependency-action-dialog";

export type SubsidiaryRow = {
  id: string;
  name: string;
  code: string;
  unit: string;
  unitCategory: string;
  subsidiaryType: string;
  stockGrade: string;
  isActive: boolean;                              // ★ M-Fix-R1 (D14-7)
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

// ★ M-Fix-R1: 부자재 의존성 카운트 타입 (subsidiary.service.ts의 SubsidiaryDependencies와 동일)
type SubsidiaryDeps = BaseDependencies & {
  activeSupplierItems: number;
  totalSupplierItems: number;
  mealPlanAccessories: number;
  mealPlanSlots: number;
  activeMealPlanSlots: number;
  containerSlots: number;
  mealTemplateContainers: number;
  mealTemplateAccessories: number;
  recipeBomSlots: number;
  totalPurchaseOrderItems: number;
  activePurchaseOrderItems: number;
};

type Props = {
  onNew: () => void;
  onSelect: (item: SubsidiaryRow) => void;
  refreshKey?: number;
};

const GRADE_LABELS: Record<string, string> = {
  A: "가",
  B: "나",
  C: "다",
};

const GRADE_STYLES: Record<string, string> = {
  A: "bg-red-50 text-red-700",
  B: "bg-yellow-50 text-yellow-700",
  C: "bg-green-50 text-green-700",
};

const SUBSIDIARY_TYPE_LABELS: Record<string, string> = {
  CONTAINER: "용기",
  ACCESSORY: "악세서리",
  CONSUMABLE: "소모품",
};

const SUBSIDIARY_TYPE_STYLES: Record<string, string> = {
  CONTAINER: "bg-purple-50 text-purple-700",
  ACCESSORY: "bg-orange-50 text-orange-700",
  CONSUMABLE: "bg-blue-50 text-blue-700",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(value);

export function SubsidiaryList({ onNew, onSelect, refreshKey }: Props) {
  const [items, setItems] = useState<SubsidiaryRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  // ★ M-Fix-R1: 삭제/활성토글 통합 다이얼로그
  const [manageTarget, setManageTarget] = useState<SubsidiaryRow | null>(null);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getSubsidiariesAction({
          page,
          limit: 20,
          search: search || undefined,
          subsidiaryType: typeFilter !== "ALL" ? typeFilter : undefined,
          sortBy: "name",
          sortOrder: "asc",
        });
        if (result.success) {
          const data = result.data as {
            items: SubsidiaryRow[];
            pagination: typeof pagination;
          };
          setItems(data.items);
          setPagination(data.pagination);
        }
      } finally {
        setLoading(false);
      }
    },
    [search, typeFilter, refreshKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchData(1);
  };

  // ★ M-Fix-R1: 의존성 조회
  const fetchDependencies = async (): Promise<SubsidiaryDeps | null> => {
    if (!manageTarget) return null;
    const result = await getSubsidiaryDependenciesAction(manageTarget.id);
    if (!result.success) {
      toast.error(result.error?.message ?? "의존성 조회에 실패했습니다");
      return null;
    }
    return result.data as SubsidiaryDeps;
  };

  // ★ M-Fix-R1: 삭제 (소프트 삭제 + 의존성 가드)
  const handleDelete = async () => {
    if (!manageTarget) return;
    const result = await deleteSubsidiaryAction(manageTarget.id);
    if (result.success) {
      toast.success("부자재가 삭제되었습니다");
      fetchData(pagination.page);
    } else {
      toast.error(result.error?.message ?? "삭제에 실패했습니다");
    }
  };

  // ★ M-Fix-R1: 활성/비활성 토글
  const handleSetActive = async (isActive: boolean) => {
    if (!manageTarget) return;
    const result = await setSubsidiaryActiveAction(manageTarget.id, isActive);
    if (result.success) {
      toast.success(isActive ? "활성화되었습니다" : "비활성화되었습니다");
      fetchData(pagination.page);
    } else {
      toast.error(result.error?.message ?? "상태 변경에 실패했습니다");
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 유형 필터 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="부자재명, 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 유형</SelectItem>
              <SelectItem value="CONTAINER">용기</SelectItem>
              <SelectItem value="ACCESSORY">악세서리</SelectItem>
              <SelectItem value="CONSUMABLE">소모품</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          부자재 등록
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코드</TableHead>
              <TableHead>부자재명</TableHead>
              <TableHead className="text-center">유형</TableHead>
              <TableHead>단위 분류</TableHead>
              <TableHead>단위</TableHead>
              <TableHead className="text-center">재고 등급</TableHead>
              <TableHead className="w-[60px] text-center">상태</TableHead>{/* ★ M-Fix-R1 (D14-7) */}
              <TableHead>기본 공급업체</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="w-[50px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                  등록된 부자재가 없습니다
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
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        SUBSIDIARY_TYPE_STYLES[item.subsidiaryType] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {SUBSIDIARY_TYPE_LABELS[item.subsidiaryType] ?? item.subsidiaryType}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {UNIT_CATEGORY_LABELS[item.unitCategory as keyof typeof UNIT_CATEGORY_LABELS] ?? item.unitCategory as string}
                    </span>
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        GRADE_STYLES[item.stockGrade] ?? "bg-gray-100 text-gray-700"
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
                    {item.defaultSupplierItem ? (
                      <span className="font-mono text-sm">
                        {formatCurrency(item.defaultSupplierItem.currentPrice)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* ★ M-Fix-R1: 휴지통 → 관리(설정) 아이콘, 클릭 시 의존성 다이얼로그 */}
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

      {/* ★ M-Fix-R1 (D14-9, D14-10): 의존성 다이얼로그 (삭제/활성 토글 통합) */}
      <DependencyActionDialog<SubsidiaryDeps>
        open={!!manageTarget}
        onClose={() => setManageTarget(null)}
        entityLabel="부자재"
        entityName={manageTarget ? `${manageTarget.code} ${manageTarget.name}` : ""}
        isCurrentlyActive={manageTarget?.isActive ?? false}
        fetchDependencies={fetchDependencies}
        onDelete={handleDelete}
        onSetActive={handleSetActive}
        renderCounts={(d) => (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat
              label="공급 품목 (활성/전체)"
              value={`${d.activeSupplierItems} / ${d.totalSupplierItems}`}
            />
            <Stat label="식단 악세서리" value={d.mealPlanAccessories} />
            <Stat
              label="식단 슬롯 (진행/전체)"
              value={`${d.activeMealPlanSlots} / ${d.mealPlanSlots}`}
            />
            <Stat label="용기 슬롯" value={d.containerSlots} />
            <Stat
              label="템플릿 (용기+악세서리)"
              value={d.mealTemplateContainers + d.mealTemplateAccessories}
            />
            <Stat label="레시피 BOM 슬롯" value={d.recipeBomSlots} />
            <Stat
              label="PO (진행/전체)"
              value={`${d.activePurchaseOrderItems} / ${d.totalPurchaseOrderItems}`}
            />
          </div>
        )}
      />
    </div>
  );
}
