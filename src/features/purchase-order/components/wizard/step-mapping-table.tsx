"use client";

import { useState } from "react";
import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";
import type { SupplierItemWithSupplier } from "@/features/supplier/actions/supplier.action";
import { SupplierItemPickerPortal } from "./supplier-item-picker-portal";
import {
  UnitConversionInlineDialog,
  type ConversionRegisteredPayload,
} from "./unit-conversion-inline-dialog";

interface Props {
  mapped: POItemCandidate[];
  mappedPartialStock: POItemCandidate[];
  mappedFullStock: POItemCandidate[];
  unmapped: POItemCandidate[];
  onUpdateQuantity: (materialRequirementId: string, value: number) => void;
  onUpdateUnitPrice: (materialRequirementId: string, value: number) => void;
  onResolveUnmapped: (
    materialRequirementId: string,
    supplierItem: SupplierItemWithSupplier,
  ) => void;
  /** R1-c: 단위 환산 인라인 등록 성공 시 해당 행 재계산 트리거 */
  onRegisterConversion: (payload: ConversionRegisteredPayload) => void;
  // ★ D19: 기본 공급업체 변경 동의 체크박스 (자재 단위)
  setAsDefaultMap: Record<string, boolean>;
  onToggleSetAsDefault: (materialRequirementId: string, value: boolean) => void;
}

export function StepMappingTable({
  mapped,
  mappedPartialStock,
  mappedFullStock,
  unmapped,
  onUpdateQuantity,
  onUpdateUnitPrice,
  onResolveUnmapped,
  onRegisterConversion,
  setAsDefaultMap,
  onToggleSetAsDefault,
}: Props) {
  // Fix-R1-a (D10·D11): 매핑된 모든 행(전량/일부/전체)을 하나의 섹션에 통합. 뱃지로 구분.
  const allMapped = [...mapped, ...mappedPartialStock, ...mappedFullStock];
  const totalAmount = allMapped.reduce(
    (sum, r) => sum + (r.orderQuantity ?? 0) * (r.unitPrice ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 3 — 자재 매핑·편집</h2>
        <p className="mt-1 text-sm text-gray-600">
          매핑된 항목은 수량·단가를 인라인 편집할 수 있습니다. 미매핑 항목은
          공급업체와 공급품목을 선택해야 다음 단계로 진행할 수 있습니다.
        </p>
      </div>

      {/* 미매핑 섹션 (우선 노출) */}
      {unmapped.length > 0 && (
        <section className="rounded-md border border-red-200 bg-red-50">
          <header className="border-b border-red-200 px-4 py-2 text-sm font-medium text-red-900">
            ⚠ 미매핑 자재 ({unmapped.length}건) — 공급업체 선택 필요
          </header>
          <RowsTable
            rows={unmapped}
            mode="unmapped"
            onUpdateQuantity={onUpdateQuantity}
            onUpdateUnitPrice={onUpdateUnitPrice}
            onResolveUnmapped={onResolveUnmapped}
            onRegisterConversion={onRegisterConversion}
            setAsDefaultMap={setAsDefaultMap}
            onToggleSetAsDefault={onToggleSetAsDefault}
          />
        </section>
      )}

      {/* 매핑됨 섹션 (전량/일부 활용/전체 활용 통합) */}
      <section className="rounded-md border border-gray-200">
        <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900">
          <span>
            ✓ 자동 매핑됨 ({allMapped.length}건)
            {mappedPartialStock.length > 0 && (
              <span className="ml-2 text-amber-700">
                · 일부 활용 {mappedPartialStock.length}
              </span>
            )}
            {mappedFullStock.length > 0 && (
              <span className="ml-2 text-gray-500">
                · 전체 활용 {mappedFullStock.length}
              </span>
            )}
          </span>
          <span className="text-gray-600">
            예상 합계:{" "}
            <span className="font-semibold text-gray-900">
              {totalAmount.toLocaleString()} 원
            </span>
          </span>
        </header>
        {allMapped.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            자동 매핑된 자재가 없습니다.
          </p>
        ) : (
          <RowsTable
            rows={allMapped}
            mode="mapped"
            onUpdateQuantity={onUpdateQuantity}
            onUpdateUnitPrice={onUpdateUnitPrice}
            onResolveUnmapped={onResolveUnmapped}
            onRegisterConversion={onRegisterConversion}
            setAsDefaultMap={setAsDefaultMap}
            onToggleSetAsDefault={onToggleSetAsDefault}
          />
        )}
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 내부: 행 테이블
// ────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────
// 내부: 행 테이블
// ────────────────────────────────────────────────────────
function RowsTable({
  rows,
  mode,
  onUpdateQuantity,
  onUpdateUnitPrice,
  onResolveUnmapped,
  onRegisterConversion,
  setAsDefaultMap,
  onToggleSetAsDefault,
}: {
  rows: POItemCandidate[];
  mode: "mapped" | "unmapped";
  onUpdateQuantity: (id: string, v: number) => void;
  onUpdateUnitPrice: (id: string, v: number) => void;
  onResolveUnmapped: (
    id: string,
    si: SupplierItemWithSupplier,
  ) => void;
  onRegisterConversion: (payload: ConversionRegisteredPayload) => void;
  setAsDefaultMap: Record<string, boolean>;
  onToggleSetAsDefault: (materialRequirementId: string, value: boolean) => void;
}) {
  // R1-c: 단위 환산 인라인 다이얼로그 상태 (이 RowsTable 인스턴스 로컬)
  const [conversionDialog, setConversionDialog] = useState<{
    materialMasterId: string;
    materialName: string;
    suggestedFromUnit: string;
  } | null>(null);

  // mapped 모드면 모든 행이 편집 가능. MAPPED_FULL_STOCK는 orderQuantity=0이라
  // 사용자가 직접 늘리지 않는 한 발주서에 포함되지 않음.
  const editable = mode === "mapped";

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/60 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">자재</th>
              <th className="px-3 py-2">필요량(g)</th>
              <th className="px-3 py-2">재고(g)</th>
              <th className="px-3 py-2">순필요</th>
              <th className="px-3 py-2 w-[200px]">공급업체 · 품목</th>
              <th className="px-3 py-2 w-20">발주수량</th>
              <th className="px-3 py-2 w-24">단가</th>
              <th className="px-3 py-2 w-24 text-right">합계</th>
              <th className="px-3 py-2">알림</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowTotal =
                (r.orderQuantity ?? 0) * (r.unitPrice ?? 0);
              return (
                <tr
                  key={r.materialRequirementId}
                  className="border-t border-gray-100 align-middle"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">
                        {r.materialName}
                      </span>
                      {r.status === "MAPPED_PARTIAL_STOCK" && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          일부 활용
                        </span>
                      )}
                      {r.status === "MAPPED_FULL_STOCK" && (
                        <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                          전체 활용
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500">{r.materialCode}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {r.requiredQtyG.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {r.stockQtyG.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {r.netRequiredG.toLocaleString()}
                    {r.fromUnitName && r.netRequiredInFromUnit != null && (
                      <div className="text-[10px] text-gray-400">
                        = {r.netRequiredInFromUnit.toFixed(2)} {r.fromUnitName}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {mode === "unmapped" ? (
                      <>
                        <SupplierItemPickerPortal
                          materialMasterId={r.materialMasterId}
                          value={r.supplierItem?.id ?? null}
                          onSelect={(si) =>
                            onResolveUnmapped(r.materialRequirementId, si)
                          }
                        />
                        {/* ★ D19: 미매핑 → 선택 직후 안내/체크박스 */}
                        {r.supplierItem &&
                          r.currentDefaultSupplierItemId === null && (
                            <div className="mt-1 text-[10px] text-blue-600">
                              ℹ 자동으로 기본 공급업체 품목 등록
                            </div>
                          )}
                        {r.supplierItem &&
                          r.currentDefaultSupplierItemId !== null &&
                          r.currentDefaultSupplierItemId !== r.supplierItem.id && (
                            <label className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                              <input
                                type="checkbox"
                                checked={
                                  setAsDefaultMap[r.materialRequirementId] ?? false
                                }
                                onChange={(e) =>
                                  onToggleSetAsDefault(
                                    r.materialRequirementId,
                                    e.target.checked,
                                  )
                                }
                              />
                              기본 공급업체 품목으로 변경
                            </label>
                          )}
                      </>
                    ) : r.supplierItem ? (
                      <div>
                        <div className="font-medium">
                          {r.supplierItem.supplierName}
                        </div>
                        <div className="text-gray-600">
                          {r.supplierItem.productName}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {r.supplierItem.supplyUnitQty}{" "}
                          {r.fromUnitName ?? "g"}/{r.supplierItem.supplyUnitName}
                        </div>
                        {/* ★ D19: 기본 공급업체 안내/체크박스 */}
                        {r.currentDefaultSupplierItemId === null && (
                          <div className="mt-1 text-[10px] text-blue-600">
                            ℹ 자동으로 기본 공급업체 품목 등록
                          </div>
                        )}
                        {r.currentDefaultSupplierItemId !== null &&
                          r.currentDefaultSupplierItemId !== r.supplierItem.id && (
                            <label className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                              <input
                                type="checkbox"
                                checked={
                                  setAsDefaultMap[r.materialRequirementId] ?? false
                                }
                                onChange={(e) =>
                                  onToggleSetAsDefault(
                                    r.materialRequirementId,
                                    e.target.checked,
                                  )
                                }
                              />
                              기본 공급업체 품목으로 변경
                            </label>
                          )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <QuantityCell
                        currentValue={r.orderQuantity}
                        rawValue={r.orderQuantityRaw}
                        onChange={(v) =>
                          onUpdateQuantity(r.materialRequirementId, v)
                        }
                      />
                    ) : (
                      <span className="text-gray-700">
                        {r.orderQuantity ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <UnitPriceCell
                        currentValue={r.unitPrice}
                        systemValue={r.supplierItem?.currentPrice ?? null}
                        onChange={(v) =>
                          onUpdateUnitPrice(r.materialRequirementId, v)
                        }
                      />
                    ) : (
                      <span className="text-gray-700">
                        {r.unitPrice != null
                          ? r.unitPrice.toLocaleString()
                          : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {rowTotal > 0 ? rowTotal.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.warnings.length > 0 && (
                      <ul className="space-y-0.5 text-[10px] text-amber-700">
                        {r.warnings.map((w, i) => (
                          <li key={i}>⚠ {w}</li>
                        ))}
                      </ul>
                    )}
                    {/* R1-c: 단위 환산 미등록 경고가 있으면 인라인 등록 버튼 노출 */}
                    {r.supplierItem !== null && r.warnings.some(
                      (w) =>
                        w.includes("단위 환산 등록 필요") ||
                        w.includes("단위 환산 계수") ||
                        w.includes("공급단위 계수") ||
                        w.includes("단위 환산 정보 미등록"),
                    ) && (
                      <button
                        type="button"
                        onClick={() =>
                          setConversionDialog({
                            materialMasterId: r.materialMasterId,
                            materialName: r.materialName,
                            // ★ D17-10: 공급단위 code를 명시적으로 전달 (자유 입력 방지)
                            suggestedFromUnit: r.supplierItem!.supplyUnitCode,
                          })
                        }
                        className="mt-1 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                      >
                        ↗ 단위 환산 등록
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* R1-c: 인라인 단위 환산 다이얼로그 */}
      {conversionDialog && (
        <UnitConversionInlineDialog
          open
          materialMasterId={conversionDialog.materialMasterId}
          materialName={conversionDialog.materialName}
          suggestedFromUnit={conversionDialog.suggestedFromUnit}
          onClose={() => setConversionDialog(null)}
          onSuccess={(payload) => {
            onRegisterConversion(payload);
          }}
        />
      )}
    </>
  );
}


// ────────────────────────────────────────────────────────
// 발주수량 셀 — 시스템 권장값 표시 + 수동 조정 감지 + 되돌리기
// ────────────────────────────────────────────────────────
function QuantityCell({
  currentValue,
  rawValue,
  onChange,
}: {
  /** 현재 입력값 (사용자 편집 반영) */
  currentValue: number | null;
  /** 시스템이 계산한 원본 박스 수량 (소수점 포함, 올림 전) */
  rawValue: number | null;
  onChange: (v: number) => void;
}) {
  // 시스템 권장값 = raw 수량을 올림한 값
  const systemRecommended =
    rawValue !== null ? Math.ceil(rawValue) : null;

  // 사용자가 시스템 권장값에서 벗어났는지 감지 (소수점 비교 안전 위해 0.0001 오차 허용)
  const isManuallyAdjusted =
    systemRecommended !== null &&
    currentValue !== null &&
    Math.abs(currentValue - systemRecommended) > 0.0001;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step="0.01"
          value={currentValue ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-20 rounded border px-2 py-1 text-right ${
            isManuallyAdjusted
              ? "border-amber-400 bg-amber-50"
              : "border-gray-300"
          }`}
        />
        {isManuallyAdjusted && systemRecommended !== null && (
          <button
            type="button"
            onClick={() => onChange(systemRecommended)}
            className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
            title={`시스템 권장값 ${systemRecommended} 박스로 되돌리기`}
          >
            ↻
          </button>
        )}
      </div>
      {systemRecommended !== null && rawValue !== null && (
        <div className="text-[10px] text-gray-400">
          시스템: {systemRecommended}
          {Math.abs(rawValue - systemRecommended) > 0.0001 && (
            <span className="ml-0.5">(원시 {rawValue.toFixed(2)})</span>
          )}
          {isManuallyAdjusted && (
            <span className="ml-1 text-amber-700">· 수동 조정됨</span>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 단가 셀 — 시스템 권장값(currentPrice) 표시 + 수동 조정 감지 + 되돌리기
// ────────────────────────────────────────────────────────
function UnitPriceCell({
  currentValue,
  systemValue,
  onChange,
}: {
  /** 현재 입력 단가 */
  currentValue: number | null;
  /** 시스템 권장 단가 (SupplierItem.currentPrice) */
  systemValue: number | null;
  onChange: (v: number) => void;
}) {
  const isManuallyAdjusted =
    systemValue !== null &&
    currentValue !== null &&
    currentValue !== systemValue;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={1}
          value={currentValue ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-24 rounded border px-2 py-1 text-right ${
            isManuallyAdjusted
              ? "border-purple-400 bg-purple-50"
              : "border-gray-300"
          }`}
        />
        {isManuallyAdjusted && systemValue !== null && (
          <button
            type="button"
            onClick={() => onChange(systemValue)}
            className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
            title={`시스템 단가 ${systemValue.toLocaleString()}원으로 되돌리기`}
          >
            ↻
          </button>
        )}
      </div>
      {systemValue !== null && (
        <div className="text-[10px] text-gray-400">
          시스템: {systemValue.toLocaleString()}원
          {isManuallyAdjusted && (
            <span className="ml-1 text-purple-700">· 수동 조정됨</span>
          )}
        </div>
      )}
    </div>
  );
}


