// src/components/lineup/lineup-select.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { getLineupsAction } from "@/features/lineup/actions/lineup.action";
import { loadAllPages } from "@/lib/action-helpers";

export type LineupOption = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  value?: string;
  onChange: (lineupId: string, option: LineupOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function LineupSelect({
  value,
  onChange,
  placeholder = "라인업을 선택하세요",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LineupOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { items } = await loadAllPages<LineupOption>(
        getLineupsAction as never,
        "name"
      );
      if (!cancelled) {
        setOptions(items);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn("w-full justify-between", className)}
        >
          {selected
            ? `${selected.name} (${selected.code})`
            : loading
            ? "불러오는 중..."
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="라인업명/코드 검색..." />
          <CommandList>
            <CommandEmpty>라인업이 없습니다.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.code}`}
                  onSelect={() => {
                    onChange(opt.id, opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium">{opt.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {opt.code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
