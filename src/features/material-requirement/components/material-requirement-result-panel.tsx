// src/features/material-requirement/components/material-requirement-result-panel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, ChevronRight, ChevronDown, Loader2, Factory, Cog,
} from "lucide-react";
import { toast } from "sonner";
import {
  listMaterialRequirementsAction,
  type MaterialRequirementListItem,
} from "../actions/material-requirement.action";
import {
  MaterialRequirementResultToolbar,
  type ResultFilters,
} from "./material-requirement-result-toolbar";
import { formatGrams, formatGramsAuxiliary } from "../utils/format";

type Props = {
  mealPlanGroupId: string;
  countSource: "ESTIMATED" | "FINAL";
};

const PAGE_LIMIT = 200; // 공장·라인 그룹핑이 필요해 한 페이지에 충분히 큰 수로

type LocationGroup = {
  locationId: string;
  locationName: string;
  locationCode: string;
  totalQty: number;
  itemCount: number;
  lines: LineGroup[];
};

type LineGroup = {
  productionLineId: string;
  productionLineName: string;
  productionLineCode: string;
  totalQty: number;
  rows: MaterialRequirementListItem[];
};

export function MaterialRequirementResultPanel({
  mealPlanGroupId,
  countSource,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MaterialRequirementListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<ResultFilters>({
    search: "",
    locationId: "all",
    productionLineId: "all",
  });

  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(
    new Set(),
  );

  const fetchData = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      try {
        const result = await listMaterialRequirementsAction({
          mealPlanGroupId,
          countSource,
          // 서버 필터(공장은 클라이언트 필터, 라인만 서버 필터)
          productionLineId:
            filters.productionLineId === "all"
              ? undefined
              : filters.productionLineId,
          activeOnly: true,
          page: nextPage,
          limit: PAGE_LIMIT,
        });

        if (result.success) {
          setItems(result.data.items as MaterialRequirementListItem[]);
          setTotal(result.data.total);
          setPage(nextPage);
        } else {
          toast.error(result.error.message || "결과 조회에 실패했습니다");
          setItems([]);
          setTotal(0);
        }
      } catch {
        toast.error("결과 조회에 실패했습니다");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [mealPlanGroupId, countSource, filters.productionLineId],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // ── 클라이언트 필터(공장 + 검색) ─────────────────────────────────
  const filteredItems = useMemo(() => {
    let arr = items;
    if (filters.locationId !== "all") {
      arr = arr.filter((r) => r.locationId === filters.locationId);
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      arr = arr.filter(
        (r) =>
          r.materialMaster.name.toLowerCase().includes(q) ||
          r.materialMaster.code.toLowerCase().includes(q),
      );
    }
    return arr;
  }, [items, filters.locationId, filters.search]);

  // ── 공장 → 라인 → 자재 트리 구성 ────────────────────────────────
  const tree = useMemo<LocationGroup[]>(() => {
    const locMap = new Map<string, LocationGroup>();

    for (const row of filteredItems) {
      const locKey = row.locationId;
      if (!locMap.has(locKey)) {
        locMap.set(locKey, {
          locationId: row.locationId,
          locationName: row.location.name,
          locationCode: row.location.code,
          totalQty: 0,
          itemCount: 0,
          lines: [],
        });
      }
      const loc = locMap.get(locKey)!;

      let line = loc.lines.find(
        (l) => l.productionLineId === row.productionLineId,
      );
      if (!line) {
        line = {
          productionLineId: row.productionLineId,
          productionLineName: row.productionLine.name,
          productionLineCode: row.productionLine.code,
          totalQty: 0,
          rows: [],
        };
        loc.lines.push(line);
      }

      line.rows.push(row);
      line.totalQty += row.requiredQty;
      loc.totalQty += row.requiredQty;
      loc.itemCount += 1;
    }

    // 공장 정렬: 이름 asc / 라인 정렬: 이름 asc / 자재 정렬: 이름 asc
    const result = Array.from(locMap.values()).sort((a, b) =>
      a.locationName.localeCompare(b.locationName),
    );
    for (const loc of result) {
      loc.lines.sort((a, b) =>
        a.productionLineName.localeCompare(b.productionLineName),
      );
      for (const ln of loc.lines) {
        ln.rows.sort((a, b) =>
          a.materialMaster.name.localeCompare(b.materialMaster.name),
        );
      }
    }
    return result;
  }, [filteredItems]);

  const grandTotal = useMemo(
    () => tree.reduce((s, loc) => s + loc.totalQty, 0),
    [tree],
  );

  const toggleLocation = (locId: string) => {
    setCollapsedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  };

  // ── 렌더 ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <MaterialRequirementResultToolbar
        value={filters}
        onChange={setFilters}
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-md border bg-white py-12 text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          결과를 불러오는 중...
        </div>
      ) : total === 0 ? (
        <div className="rounded-md border border-dashed bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            해당 source({countSource})로 산출된 결과가 없습니다.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            상단 산출 버튼을 눌러 소요량을 생성하세요.
          </p>
        </div>
      ) : tree.length === 0 ? (
        <div className="rounded-md border border-dashed bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            필터 조건에 해당하는 자재가 없습니다.
          </p>
        </div>
      ) : (
        <>
          {/* 그룹 총계 카드 */}
          <div className="rounded-md border bg-white px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              총 <strong>{tree.length}</strong>개 공장 ·{" "}
              <strong>
                {tree.reduce((s, loc) => s + loc.lines.length, 0)}
              </strong>
              개 라인 ·{" "}
              <strong>
                {tree.reduce(
                  (s, loc) =>
                    s + loc.lines.reduce((ss, ln) => ss + ln.rows.length, 0),
                  0,
                )}
              </strong>
              개 자재 행
            </div>
            <div className="text-sm">
              <span className="text-gray-500">그룹 합계: </span>
              <strong className="tabular-nums">{formatGrams(grandTotal)}</strong>{" "}
              <span className="text-xs text-gray-400">
                {formatGramsAuxiliary(grandTotal)}
              </span>
            </div>
          </div>

          {/* 공장 → 라인 → 자재 트리 */}
          {tree.map((loc) => {
            const isCollapsed = collapsedLocations.has(loc.locationId);
            return (
              <div
                key={loc.locationId}
                className="rounded-md border bg-white overflow-hidden"
              >
                {/* 공장 헤더 */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 hover:bg-gray-100"
                  onClick={() => toggleLocation(loc.locationId)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                    <Factory className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold">{loc.locationName}</span>
                    <span className="text-xs text-gray-400">
                      [{loc.locationCode}]
                    </span>
                    <span className="text-xs text-gray-500">
                      · 라인 {loc.lines.length}개 · 자재 {loc.itemCount}건
                    </span>
                  </div>
                  <div className="text-sm tabular-nums">
                    <strong>{formatGrams(loc.totalQty)}</strong>{" "}
                    <span className="text-xs text-gray-400">
                      {formatGramsAuxiliary(loc.totalQty)}
                    </span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="divide-y">
                    {loc.lines.map((ln) => (
                      <div key={ln.productionLineId}>
                        {/* 라인 헤더 */}
                        <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-100">
                          <div className="flex items-center gap-2 text-sm">
                            <Cog className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium">
                              {ln.productionLineName}
                            </span>
                            <span className="text-xs text-gray-400">
                              [{ln.productionLineCode}]
                            </span>
                            <span className="text-xs text-gray-500">
                              · 자재 {ln.rows.length}건
                            </span>
                          </div>
                          <div className="text-sm tabular-nums">
                            <strong>{formatGrams(ln.totalQty)}</strong>{" "}
                            <span className="text-xs text-gray-400">
                              {formatGramsAuxiliary(ln.totalQty)}
                            </span>
                          </div>
                        </div>

                        {/* 자재 테이블 */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px]">자재 코드</TableHead>
                              <TableHead>자재명</TableHead>
                              <TableHead className="w-[100px] text-center">분류</TableHead>
                              <TableHead className="w-[180px] text-right">소요량 (g)</TableHead>
                              <TableHead className="w-[120px] text-right">환산 (kg)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ln.rows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs">
                                  {row.materialMaster.code}
                                </TableCell>
                                <TableCell>
                                  {row.materialMaster.name}
                                </TableCell>
                                <TableCell className="text-center text-xs text-gray-500">
                                  {row.materialMaster.materialType}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.requiredQty.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell className="text-right text-xs text-gray-500 tabular-nums">
                                  {(row.requiredQty / 1000).toLocaleString(
                                    undefined,
                                    { maximumFractionDigits: 3 },
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 페이지네이션 (한 페이지 200건 초과 시) */}
          {total > PAGE_LIMIT && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                총 {total}건 중 {(page - 1) * PAGE_LIMIT + 1}-
                {Math.min(page * PAGE_LIMIT, total)}건
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => fetchData(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page} / {Math.ceil(total / PAGE_LIMIT)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * PAGE_LIMIT >= total}
                  onClick={() => fetchData(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
