// src/features/material-requirement/components/material-requirement-group-list.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Filter, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { getMealPlanGroupsAction } from "@/features/meal-plan/actions/meal-plan.action";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import {
  STATUS_LABEL,
  STATUS_COLOR,
} from "@/features/meal-plan/constants/status-label";

// ★ Phase 4-G G-4: features/meal-plan/constants/status-label.ts 공통 상수 재사용
//   - CONFIRMED 라벨: "확정" → "준비중" (Phase 9-D-Sym 결정)
//   - IN_PROGRESS/COMPLETED 색상: G-4 UX 재배정
type StatusFilter = "all" | keyof typeof STATUS_LABEL;

// ── Group 행 타입 (getMealPlanGroups 응답 일부) ──────────────────
export type MealPlanGroupRow = {
  id: string;
  planDate: string | Date;
  status: string;
  note: string | null;
  _count: { mealPlans: number; mealCounts: number };
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Props = {
  onSelect: (group: MealPlanGroupRow) => void;
};

export function MaterialRequirementGroupList({ onSelect }: Props) {
  const [items, setItems] = useState<MealPlanGroupRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getMealPlanGroupsAction({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          sortBy: "planDate",
          sortOrder: "desc",
        });

        if (result.success) {
          setItems(result.data.items as unknown as MealPlanGroupRow[]);
          setPagination(result.data.pagination);
        } else {
          toast.error(result.error.message || "식단 그룹 조회에 실패했습니다");
        }
      } catch {
        toast.error("식단 그룹 조회에 실패했습니다");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter],
  );

  useEffect(() => {
    fetchGroups(1);
  }, [fetchGroups]);

  const handleSearch = () => fetchGroups(1);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="비고 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select
            value={statusFilter}
            onValueChange={(v: StatusFilter) => setStatusFilter(v)}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">계획 날짜</TableHead>
              <TableHead className="w-[100px] text-center">상태</TableHead>
              <TableHead className="w-[110px] text-right">식단 수</TableHead>
              <TableHead className="w-[110px] text-right">식수 행 수</TableHead>
              <TableHead>비고</TableHead>
              <TableHead className="w-[120px] text-right">결과 보기</TableHead>
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
                  표시할 식단 그룹이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((g) => {
                const dateStr = format(new Date(g.planDate), "yyyy.MM.dd (eee)", {
                  locale: ko,
                });
                return (
                  <TableRow
                    key={g.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => onSelect(g)}
                  >
                    <TableCell className="font-medium tabular-nums">
                      {dateStr}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLOR[g.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABEL[g.status] ?? g.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g._count.mealPlans.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g._count.mealCounts.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 line-clamp-1">
                      {g.note ?? <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(g);
                        }}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        열기
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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
              onClick={() => fetchGroups(pagination.page - 1)}
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
              onClick={() => fetchGroups(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
