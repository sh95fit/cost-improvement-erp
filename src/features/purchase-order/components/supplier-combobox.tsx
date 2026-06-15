"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { getSuppliersAction } from "@/features/supplier/actions/supplier.action";

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

type Props = {
  value: string;
  onChange: (id: string, supplier: SupplierOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SupplierCombobox({
  value,
  onChange,
  placeholder = "공급업체 선택",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSuppliersAction({ page: 1, limit: 200 })
      .then((result) => {
        if (active && result.success) {
          const list = (result.data as { items: SupplierOption[] }).items;
          setOptions(list.map((s) => ({ id: s.id, code: s.code, name: s.name })));
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

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
              <Loader2 className="h-4 w-4 animate-spin" /> 공급업체 로딩 중...
            </span>
          ) : selected ? (
            <span>
              {selected.name}
              <span className="ml-2 text-xs text-muted-foreground">({selected.code})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const opt = options.find((o) => o.id === itemValue);
            if (!opt) return 0;
            const h = `${opt.code} ${opt.name}`.toLowerCase();
            return h.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="공급업체 검색 (이름, 코드)" />
          <CommandList>
            <CommandEmpty>등록된 공급업체가 없습니다</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => { onChange(opt.id, opt); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", opt.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{opt.name}</span>
                  <span className="text-xs text-muted-foreground">{opt.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
