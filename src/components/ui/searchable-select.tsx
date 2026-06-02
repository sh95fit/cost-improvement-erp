// src/components/ui/searchable-select.tsx
"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableOption = {
  /** 내부 식별자 (onChange로 전달되는 값) */
  id: string;
  /** 메인 라벨 (검색 대상에 자동 포함) */
  label: string;
  /** 보조 라벨 — 라벨 옆 회색 텍스트, 검색 대상에 포함 */
  sublabel?: string;
  /** 우측 정렬 보조 정보 — 검색 대상에 포함하지 않음 (예: 단위) */
  rightLabel?: string;
};

type Props = {
  options: SearchableOption[];
  /** "" 또는 null이면 미선택 상태로 표시 */
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  /** 검색 결과가 없을 때 보여줄 텍스트 */
  emptyText?: string;
  /** 검색창 placeholder */
  searchPlaceholder?: string;
  disabled?: boolean;
  /** true면 "미선택" 옵션을 맨 위에 노출 + 트리거 우측 ✕ 버튼 노출 */
  allowClear?: boolean;
  /** allowClear=true일 때 미선택 옵션의 표시 텍스트 (기본: "미선택") */
  clearLabel?: string;
  /** 트리거 버튼에 추가 클래스 */
  triggerClassName?: string;
  /** Popover 내용 영역에 추가 클래스 (기본 width: 트리거에 맞춤) */
  contentClassName?: string;
  /** 트리거 버튼 크기 (기본 h-9, "sm"이면 h-8 text-xs) */
  size?: "default" | "sm";
};

/**
 * 검색 가능한 단일 선택 콤보박스.
 *
 * 사용 예:
 *   <SearchableSelect
 *     options={recipes.map(r => ({ id: r.id, label: r.name, sublabel: r.code }))}
 *     value={recipeId}
 *     onChange={setRecipeId}
 *     placeholder="레시피 선택"
 *     allowClear
 *     clearLabel="미배정"
 *   />
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "선택하세요",
  emptyText = "검색 결과가 없습니다",
  searchPlaceholder = "이름 또는 코드 검색...",
  disabled,
  allowClear = false,
  clearLabel = "미선택",
  triggerClassName,
  contentClassName,
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const isSelected = !!selected;

  const sizeClass =
    size === "sm" ? "h-8 text-xs" : "h-9 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            sizeClass,
            !isSelected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="flex-1 truncate text-left">
            {isSelected ? (
              <>
                {selected.label}
                {selected.sublabel && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({selected.sublabel})
                  </span>
                )}
              </>
            ) : (
              placeholder
            )}
          </span>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {allowClear && isSelected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="선택 해제"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
                onPointerDown={(e) => {
                  // PopoverTrigger가 열리지 않도록
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-gray-200"
              >
                <X className="h-3 w-3 opacity-60" />
              </span>
            )}
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          // 트리거 너비에 자동 맞춤 (radix 변수 활용)
          "w-[var(--radix-popover-trigger-width)] p-0",
          contentClassName,
        )}
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            className={size === "sm" ? "text-xs" : undefined}
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-gray-400">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={size === "sm" ? "text-xs" : undefined}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === "" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-gray-400">{clearLabel}</span>
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  // cmdk 자체 검색 — label + sublabel을 매칭 키로
                  value={`${opt.label} ${opt.sublabel ?? ""}`}
                  onSelect={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={size === "sm" ? "text-xs" : undefined}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="ml-1 text-gray-400">
                      ({opt.sublabel})
                    </span>
                  )}
                  {opt.rightLabel && (
                    <span className="ml-auto text-gray-400">
                      {opt.rightLabel}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
