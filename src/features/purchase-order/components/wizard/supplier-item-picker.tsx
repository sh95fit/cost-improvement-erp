"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSupplierItemsByMaterialAction } from "@/features/supplier/actions/supplier.action";
import type { SupplierItemWithSupplier } from "@/features/supplier/actions/supplier.action";

interface Props {
  materialMasterId: string;
  /** 현재 선택된 supplierItemId (있으면 표시용) */
  value: string | null;
  onSelect: (item: SupplierItemWithSupplier) => void;
  disabled?: boolean;
}

export function SupplierItemPicker({
  materialMasterId,
  value,
  onSelect,
  disabled,
}: Props) {
  const [items, setItems] = useState<SupplierItemWithSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || items.length > 0) return;
    let cancelled = false;
    setIsLoading(true);
    getSupplierItemsByMaterialAction(materialMasterId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          toast.error(res.error.message);
          return;
        }
        setItems(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "공급 품목 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, materialMasterId, items.length]);

  const selectedItem = items.find((it) => it.id === value) ?? null;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full rounded-md border px-3 py-1.5 text-left text-xs ${
          value
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-red-300 bg-red-50 text-red-900"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400"}`}
      >
        {selectedItem ? (
          <span>
            <span className="font-medium">{selectedItem.supplier.name}</span>
            {" · "}
            <span>{selectedItem.productName}</span>
          </span>
        ) : (
          <span>공급업체 / 품목 선택...</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-[420px] max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {isLoading && (
            <p className="px-3 py-3 text-xs text-gray-500">불러오는 중...</p>
          )}
          {!isLoading && items.length === 0 && (
            <p className="px-3 py-3 text-xs text-gray-500">
              이 자재로 등록된 공급 품목이 없습니다. 공급업체 관리에서 먼저 등록하세요.
            </p>
          )}
          {!isLoading &&
            items.map((it) => {
              const isSelected = it.id === value;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onSelect(it);
                    setIsOpen(false);
                  }}
                  className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-blue-50 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {it.supplier.name}
                  </div>
                  <div className="text-gray-700">{it.productName}</div>
                  <div className="mt-0.5 text-gray-500">
                    {it.supplyUnitQty} {it.supplyUnit.name} ·{" "}
                    {it.currentPrice.toLocaleString()}원
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
