"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const DROPDOWN_WIDTH = 480;
const DROPDOWN_MAX_HEIGHT = 320;

export function SupplierItemPickerPortal({
  materialMasterId,
  value,
  onSelect,
  disabled,
}: Props) {
  const [items, setItems] = useState<SupplierItemWithSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: "below" | "above";
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ── 데이터 로드 (드롭다운이 처음 열렸을 때 1회) ──
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

  // ── 위치 계산 (뷰포트 상하단 자동 플립) ──
  const recomputePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const placement: "below" | "above" =
      spaceBelow >= DROPDOWN_MAX_HEIGHT || spaceBelow >= spaceAbove
        ? "below"
        : "above";

    // 좌측 좌표는 트리거와 정렬, 뷰포트 우측 넘침 방지 (8px 패딩)
    let left = rect.left;
    const overflowX = left + DROPDOWN_WIDTH - (window.innerWidth - 8);
    if (overflowX > 0) left = Math.max(8, left - overflowX);

    const top =
      placement === "below"
        ? rect.bottom + 4
        : rect.top - 4 - DROPDOWN_MAX_HEIGHT;

    setPosition({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    recomputePosition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => recomputePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true); // 캡처: 부모 스크롤도 감지
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isOpen]);

  // ── 외부 클릭 시 닫기 ──
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedItem = items.find((it) => it.id === value) ?? null;

  // ── 검색 필터링 (productName + supplier.name, 대소문자 무시) ──
  const filteredItems = searchQuery.trim()
    ? items.filter((it) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          it.productName.toLowerCase().includes(q) ||
          it.supplier.name.toLowerCase().includes(q)
        );
      })
    : items;

  return (
    <>
      <button
        ref={triggerRef}
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

      {isOpen &&
        position &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: DROPDOWN_WIDTH,
              maxHeight: DROPDOWN_MAX_HEIGHT,
              zIndex: 50,
            }}
            className="flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl"
          >
            {/* 검색 입력 */}
            <div className="border-b border-gray-100 p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                placeholder="공급업체명 또는 품목명 검색..."
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400"
              />
            </div>

            {/* 목록 */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <p className="px-3 py-3 text-xs text-gray-500">불러오는 중...</p>
              )}
              {!isLoading && items.length === 0 && (
                <p className="px-3 py-3 text-xs text-gray-500">
                  이 자재로 등록된 공급 품목이 없습니다. 공급업체 관리에서 먼저 등록하세요.
                </p>
              )}
              {!isLoading && items.length > 0 && filteredItems.length === 0 && (
                <p className="px-3 py-3 text-xs text-gray-500">
                  검색 결과가 없습니다.
                </p>
              )}
              {!isLoading &&
                filteredItems.map((it) => {
                  const isSelected = it.id === value;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        onSelect(it);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={`flex w-full items-start gap-2 border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-blue-50 ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-block w-3 shrink-0 text-center ${
                          isSelected ? "text-emerald-600" : "text-transparent"
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium text-gray-900">
                          {it.supplier.name}
                        </span>
                        <span className="block text-gray-700">
                          {it.productName}
                        </span>
                        <span className="mt-0.5 block text-gray-500">
                          {it.supplyUnitQty} {it.supplyUnit.name} ·{" "}
                          {it.currentPrice.toLocaleString()}원
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
