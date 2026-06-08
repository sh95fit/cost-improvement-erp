// src/features/material-requirement/components/material-requirement-result-toolbar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { getActiveProductionLinesAction } from "@/features/meal-plan/actions/meal-plan.action";

export type ResultFilters = {
  search: string;
  locationId: "all" | string;
  productionLineId: "all" | string;
};

type LineOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

type Props = {
  value: ResultFilters;
  onChange: (next: ResultFilters) => void;
};

export function MaterialRequirementResultToolbar({ value, onChange }: Props) {
  const [lines, setLines] = useState<LineOption[]>([]);

  useEffect(() => {
    (async () => {
      const result = await getActiveProductionLinesAction();
      if (result.success) {
        setLines(result.data);
      }
    })();
  }, []);

  // 공장(Location) 옵션 - lines에서 unique 추출
  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lines) {
      if (!map.has(l.locationId)) map.set(l.locationId, l.locationName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [lines]);

  // 선택된 공장에 종속된 라인 옵션
  const filteredLineOptions = useMemo(() => {
    if (value.locationId === "all") return lines;
    return lines.filter((l) => l.locationId === value.locationId);
  }, [lines, value.locationId]);

  const handleLocationChange = (next: string) => {
    onChange({
      ...value,
      locationId: next,
      // 공장이 바뀌면 라인 셀렉트도 reset
      productionLineId: "all",
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="자재명 또는 코드로 검색"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Filter className="h-4 w-4 text-gray-400" />
        <Select
          value={value.locationId}
          onValueChange={handleLocationChange}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 공장</SelectItem>
            {locationOptions.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select
        value={value.productionLineId}
        onValueChange={(v) => onChange({ ...value, productionLineId: v })}
      >
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {value.locationId === "all" ? "전체 라인" : "공장 내 전체 라인"}
          </SelectItem>
          {filteredLineOptions.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
