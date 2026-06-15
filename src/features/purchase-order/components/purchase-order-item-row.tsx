"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { TableCell, TableRow } from "@/components/ui/table";
import { getSupplierItemsAction } from "@/features/supplier/actions/supplier.action";

export type SupplierItemOption = {
  id: string;
  itemType: "MATERIAL" | "SUBSIDIARY";
  productName: string;
  spec: string | null;
  currentPrice: number;
  supplyUnit: { code: string; name: string };
  supplyUnitQty: number;
  materialMaster: { id: string; name: string; code: string } | null;
  subsidiaryMaster: { id: string; name: string; code: string } | null;
};

export type POItemFormRow = {
  key: string;                 // React key (uuid)
  supplierItemId: string;
  itemType: "MATERIAL" | "SUBSIDIARY";
  materialMasterId?: string;
  subsidiaryMasterId?: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  row: POItemFormRow;
  supplierId: string;
  supplierItemsCache: SupplierItemOption[] | null;   // 부모가 캐시 공유
  onCacheLoaded: (items: SupplierItemOption[]) => void;
  onChange: (next: POItemFormRow) => void;
  onRemove: () => void;
  disabled?: boolean;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(v);

export function PurchaseOrderItemRow({
  row, supplierId, supplierItemsCache, onCacheLoaded, onChange, onRemove, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 공급사가 바뀌면 캐시 로드 (캐시 없을 때만)
  useEffect(() => {
    if (!supplierId || supplierItemsCache) return;
    let active = true;
    setLoading(true);
    getSupplierItemsAction(supplierId)
      .then((result) => {
        if (active && result.success) {
          onCacheLoaded(result.data as SupplierItemOption[]);
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [supplierId, supplierItemsCache, onCacheLoaded]);

  const options = supplierItemsCache ?? [];
  const selected = useMemo(
    () => options.find((o) => o.id === row.supplierItemId) ?? null,
    [options, row.supplierItemId]
  );

  const lineTotal = row.quantity * row.unitPrice;

  const handleSelect = (opt: SupplierItemOption) => {
    onChange({
      ...row,
      supplierItemId: opt.id,
      itemType: opt.itemType,
      materialMasterId: opt.itemType === "MATERIAL" ? opt.materialMaster?.id : undefined,
      subsidiaryMasterId: opt.itemType === "SUBSIDIARY" ? opt.subsidiaryMaster?.id : undefined,
      unitPrice: opt.currentPrice, // 기본 단가 자동 채움
    });
    setOpen(false);
  };

  return (
    <TableRow>
      {/* 공급 품목 선택 */}
      <TableCell className="min-w-[280px]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled || !supplierId || loading}
              className="w-full justify-between font-normal h-9"
            >
              {loading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 로딩...
                </span>
              ) : !supplierId ? (
                <span className="text-muted-foreground">공급업체를 먼저 선택</span>
              ) : selected ? (
                <span className="truncate">
                  <span className={cn(
                    "mr-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                    selected.itemType === "MATERIAL"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-purple-50 text-purple-700",
                  )}>
                    {selected.itemType === "MATERIAL" ? "식자재" : "부자재"}
                  </span>
                  {selected.productName}
                  {selected.spec && (
                    <span className="ml-1 text-xs text-muted-foreground">({selected.spec})</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">품목 선택</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command
              filter={(itemValue, search) => {
                const opt = options.find((o) => o.id === itemValue);
                if (!opt) return 0;
                const h = `${opt.productName} ${opt.spec ?? ""} ${opt.materialMaster?.name ?? ""} ${opt.subsidiaryMaster?.name ?? ""}`.toLowerCase();
                return h.includes(search.toLowerCase()) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="제품명, 규격으로 검색" />
              <CommandList>
                <CommandEmpty>해당 공급업체에 등록된 품목이 없습니다</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.id}
                      onSelect={() => handleSelect(opt)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", opt.id === row.supplierItemId ? "opacity-100" : "opacity-0")} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                            opt.itemType === "MATERIAL"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700",
                          )}>
                            {opt.itemType === "MATERIAL" ? "식자재" : "부자재"}
                          </span>
                          <span className="font-medium">{opt.productName}</span>
                          {opt.spec && <span className="text-xs text-muted-foreground">{opt.spec}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {opt.supplyUnit.name} ({opt.supplyUnitQty}) · 단가 {formatCurrency(opt.currentPrice)}원
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* 단위 */}
      <TableCell className="w-[100px] text-sm text-gray-600">
        {selected ? selected.supplyUnit.name : "-"}
      </TableCell>

      {/* 수량 */}
      <TableCell className="w-[110px]">
        <Input
          type="number"
          min={0}
          step="any"
          value={row.quantity || ""}
          onChange={(e) => onChange({ ...row, quantity: Number(e.target.value) || 0 })}
          disabled={disabled}
          className="h-9 text-right"
        />
      </TableCell>

      {/* 단가 */}
      <TableCell className="w-[130px]">
        <Input
          type="number"
          min={0}
          step="any"
          value={row.unitPrice || ""}
          onChange={(e) => onChange({ ...row, unitPrice: Number(e.target.value) || 0 })}
          disabled={disabled}
          className="h-9 text-right"
        />
      </TableCell>

      {/* 소계 */}
      <TableCell className="w-[120px] text-right font-mono text-sm">
        {formatCurrency(lineTotal)}원
      </TableCell>

      {/* 삭제 */}
      <TableCell className="w-[50px] text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
