"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getUnitOptionsAction } from "@/features/unit-master/actions/unit-master.action";
import { UNIT_CATEGORY_LABELS } from "@/lib/constants/unit-options";

export type UnitOption = {
  id: string;
  code: string;
  name: string;
  unitCategory: string;
};

type Props = {
  value: string;
  onChange: (value: string, unit: UnitOption | null) => void;
  itemType: "MATERIAL" | "SUBSIDIARY";
  valueMode?: "id" | "code";
  placeholder?: string;
  disabled?: boolean;
  excludeValue?: string;       // 같은 값(예: fromUnit과 같은 단위) 제외
  emptyHint?: string;           // 옵션이 없을 때 안내
  className?: string;
};

const UNIT_CATEGORY_ORDER = ["WEIGHT", "VOLUME", "COUNT", "LENGTH", "PACKAGE"];

export function UnitCombobox({
  value,
  onChange,
  itemType,
  valueMode = "id",
  placeholder = "단위 선택",
  disabled,
  excludeValue,
  emptyHint = "등록된 단위가 없습니다",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getUnitOptionsAction(itemType)
      .then((result) => {
        if (active && result.success) {
          setOptions(result.data as UnitOption[]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemType]);

  const selectedUnit = useMemo(
    () =>
      options.find((o) =>
        valueMode === "id" ? o.id === value : o.code === value
      ) ?? null,
    [options, value, valueMode]
  );

  const grouped = useMemo(() => {
    const map: Record<string, UnitOption[]> = {};
    for (const opt of options) {
      if (excludeValue) {
        const key = valueMode === "id" ? opt.id : opt.code;
        if (key === excludeValue) continue;
      }
      if (!map[opt.unitCategory]) map[opt.unitCategory] = [];
      map[opt.unitCategory].push(opt);
    }
    return map;
  }, [options, excludeValue, valueMode]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn("w-full justify-between font-normal", className)}
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              단위 로딩 중...
            </span>
          ) : selectedUnit ? (
            <span>
              {selectedUnit.name}
              <span className="ml-2 text-xs text-muted-foreground">
                ({UNIT_CATEGORY_LABELS[selectedUnit.unitCategory as keyof typeof UNIT_CATEGORY_LABELS] ?? selectedUnit.unitCategory})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(value, search) => {
            // value는 CommandItem의 value prop (code 또는 id)
            // 한글 검색을 위해 options에서 매칭 확인
            const opt = options.find((o) =>
              valueMode === "id" ? o.id === value : o.code === value
            );
            if (!opt) return 0;
            const haystack = `${opt.code} ${opt.name} ${opt.unitCategory}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="단위 검색 (예: kg, 봉, 포)" />
          <CommandList>
            <CommandEmpty>
              <div className="space-y-1 py-2">
                <p>{emptyHint}</p>
                <a
                  href="/units"
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  단위 관리에서 등록하기
                </a>
              </div>
            </CommandEmpty>
            {UNIT_CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat, idx) => (
              <div key={cat}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={UNIT_CATEGORY_LABELS[cat as keyof typeof UNIT_CATEGORY_LABELS] ?? cat}>
                  {grouped[cat].map((opt) => {
                    const itemValue = valueMode === "id" ? opt.id : opt.code;
                    const isSelected = itemValue === value;
                    return (
                      <CommandItem
                        key={opt.id}
                        value={itemValue}
                        onSelect={() => {
                          onChange(itemValue, opt);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1">{opt.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {opt.code}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}