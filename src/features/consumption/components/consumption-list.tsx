"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { listConsumptionItemsAction } from "../actions/list-consumption-items.action";
import { getLocationOptionsAction } from "@/features/location/actions/location.action";

// ────────────────────────────────────────────────────────────
// Row 타입 — listConsumptionItems select 결과와 정합
// ────────────────────────────────────────────────────────────
type ConsumptionRow = {
  id: string;
  itemType: "MATERIAL" | "SUBSIDIARY";
  consumedQty: number;
  unit: string;
  consumedDate: Date | string;
  sourceType: "MEAL_PLAN_AUTO" | "MANUAL_ADDITION";
  disposition: "USED" | "RETURNED" | "DISPOSED";
  status: "DRAFT" | "CONFIRMED";
  note: string | null;
  createdAt: Date | string;
  materialMaster: { id: string; name: string; code: string } | null;
  subsidiaryMaster: { id: string; name: string; code: string } | null;
  cookingPlan: {
    id: string;
    productionLine: {
      id: string;
      name: string;
      location: { id: string; name: string; code: string };
    } | null;
  } | null;
};

type LocationOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type ItemTypeFilter = "MATERIAL" | "SUBSIDIARY" | "all";
type SourceTypeFilter = "MEAL_PLAN_AUTO" | "MANUAL_ADDITION" | "all";

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────
function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return toYmd(date);
}

function formatQty(n: number): string {
  // 소수점 존재 시 최대 3자리까지, 정수는 그대로
  return Number.isInteger(n) ? n.toString() : n.toFixed(3).replace(/\.?0+$/, "");
}

const SOURCE_TYPE_LABEL: Record<SourceTypeFilter, string> = {
  MEAL_PLAN_AUTO: "식단 자동",
  MANUAL_ADDITION: "수동 추가",
  all: "전체",
};

// 기본 기간: 오늘 포함 최근 7일
function defaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return { start: toYmd(start), end: toYmd(end) };
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export function ConsumptionList() {
  const initial = useMemo(defaultDateRange, []);

  const [items, setItems] = useState<ConsumptionRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [startDate, setStartDate] = useState<string>(initial.start);
  const [endDate, setEndDate] = useState<string>(initial.end);
  const [locationId, setLocationId] = useState<string>("all");
  const [itemType, setItemType] = useState<ItemTypeFilter>("all");
  const [sourceType, setSourceType] = useState<SourceTypeFilter>("all");

  // 사업장 옵션
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);

  // 사업장 옵션 로드
  useEffect(() => {
    (async () => {
      const result = await getLocationOptionsAction({});
      if (result.success) {
        setLocationOptions(result.data);
      } else {
        toast.error(result.error.message || "사업장 목록 조회에 실패했습니다");
      }
    })();
  }, []);

  // 목록 조회
  const fetchList = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await listConsumptionItemsAction({
          page,
          limit: pagination.limit,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          locationId: locationId === "all" ? undefined : locationId,
          itemType,
          sourceType,
          disposition: "all",
        });

        if (result.success) {
          setItems(result.data.items as ConsumptionRow[]);
          setPagination(result.data.pagination);
        } else {
          toast.error(result.error.message || "목록 조회에 실패했습니다");
        }
      } catch {
        toast.error("목록 조회에 실패했습니다");
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, locationId, itemType, sourceType, pagination.limit],
  );

  useEffect(() => {
    fetchList(1);
    // 필터 바뀔 때마다 1페이지부터
  }, [fetchList]);

  const handleReset = () => {
    const d = defaultDateRange();
    setStartDate(d.start);
    setEndDate(d.end);
    setLocationId("all");
    setItemType("all");
    setSourceType("all");
  };

  const handlePrev = () => {
    if (pagination.page > 1) fetchList(pagination.page - 1);
  };
  const handleNext = () => {
    if (pagination.page < pagination.totalPages) fetchList(pagination.page + 1);
  };

  return (
    <div className="space-y-4">
      {/* 상단 필터 바 */}
      <div className="rounded-md border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 시작일 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">시작일</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>

          {/* 종료일 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">종료일</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>

          {/* 사업장 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">사업장</label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {locationOptions.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 품목 유형 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">품목 유형</label>
            <Select
              value={itemType}
              onValueChange={(v) => setItemType(v as ItemTypeFilter)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="MATERIAL">식재료</SelectItem>
                <SelectItem value="SUBSIDIARY">부재료</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 출처 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">출처</label>
            <Select
              value={sourceType}
              onValueChange={(v) => setSourceType(v as SourceTypeFilter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="MEAL_PLAN_AUTO">식단 자동</SelectItem>
                <SelectItem value="MANUAL_ADDITION">수동 추가</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 초기화 */}
          <Button variant="outline" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-4 w-4" />
            초기화
          </Button>

          {/* 오른쪽 정렬 신규 버튼 */}
          <div className="ml-auto">
            <Button asChild>
              <Link href="/consumption/new" className="gap-1">
                <Plus className="h-4 w-4" />
                신규 사용 처리
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">사용일</TableHead>
              <TableHead className="w-36">사업장</TableHead>
              <TableHead className="w-20">유형</TableHead>
              <TableHead>품목</TableHead>
              <TableHead className="w-32 text-right">수량</TableHead>
              <TableHead className="w-24">출처</TableHead>
              <TableHead className="w-24">상태</TableHead>
              <TableHead>비고</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    불러오는 중...
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                    <Filter className="h-6 w-6" />
                    조회 결과가 없습니다
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => {
                const item =
                  row.itemType === "MATERIAL"
                    ? row.materialMaster
                    : row.subsidiaryMaster;
                const location = row.cookingPlan?.productionLine?.location;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDate(row.consumedDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {location ? (
                        <span title={location.code}>{location.name}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.itemType === "MATERIAL"
                            ? "rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700"
                            : "rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700"
                        }
                      >
                        {row.itemType === "MATERIAL" ? "식재료" : "부재료"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item ? (
                        <>
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-2 text-xs text-gray-500">
                            {item.code}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">(삭제된 품목)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatQty(row.consumedQty)}{" "}
                      <span className="text-xs text-gray-500">{row.unit}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span
                        className={
                          row.sourceType === "MEAL_PLAN_AUTO"
                            ? "rounded bg-gray-100 px-1.5 py-0.5 text-gray-700"
                            : "rounded bg-amber-50 px-1.5 py-0.5 text-amber-700"
                        }
                      >
                        {SOURCE_TYPE_LABEL[row.sourceType]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.status === "CONFIRMED" ? (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                          확정
                        </span>
                      ) : (
                        <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-yellow-700">
                          초안
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-gray-600">
                      {row.note ?? ""}
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
          <div className="text-sm text-gray-600">
            총 {pagination.total.toLocaleString()}건 · {pagination.page} /{" "}
            {pagination.totalPages} 페이지
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
