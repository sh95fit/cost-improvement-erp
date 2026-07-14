"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { createPurchaseOrdersBatchAction } from "@/features/purchase-order/actions/purchase-order.action";
import {
  getMaterialsAction,
  getSubsidiariesAction,
} from "@/features/material/actions/material.action";
import {
  getSupplierItemsByMaterialAction,
  getSupplierItemsBySubsidiaryAction,
  type SupplierItemWithSupplier,
} from "@/features/supplier/actions/supplier.action";
import {
  getFactoryLocationOptionsAction,
  getProductionLinesAction,
} from "@/features/production-line/actions/production-line.action";
import { getLineupsAction } from "@/features/lineup/actions/lineup.action";
import { PurchaseKind } from "@prisma/client";

// ─────────────────────────────────────
// Props (page.tsx 와 일치)
// ★ S4-1-b: purchaseKind 로 두 모드(MANUAL_JIT / STOCK_KEEPING) 공용화
// ─────────────────────────────────────
interface Props {
  onCreated: () => void;
  onCancel: () => void;
  /** 발주 유형 (P12). default = MANUAL_JIT */
  purchaseKind?: "MANUAL_JIT" | "STOCK_KEEPING";
}

// ─────────────────────────────────────
// 내부 타입
// ─────────────────────────────────────
interface MaterialOption {
  id: string;
  name: string;
  code: string;
}
interface SubsidiaryOption {
  id: string;
  name: string;
  code: string;
}
interface LocationOption {
  id: string;
  name: string;
  code: string;
}
interface ProductionLineOption {
  id: string;
  name: string;
  code: string;
  locationId: string;
}
interface LineupOption {
  id: string;
  name: string;
}

// ★ S4-1-a: itemType 축 추가.
//   SUBSIDIARY 인 경우 itemMasterId 는 subsidiaryMasterId 값을 담고,
//   itemName 은 부자재 명을 담음. 제출 시 payload 에서만 분기.
interface Row {
  key: string;
  itemType: "MATERIAL" | "SUBSIDIARY";
  itemMasterId: string;
  itemName: string;
  supplierItemId: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  supplyUnitLabel: string;
  quantity: string;
  unitPrice: string;
  supplierItems: SupplierItemWithSupplier[];
  loading: boolean;
}

// 외부 의존 없는 간이 uuid
function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────
export function ManualPurchaseOrderForm({
  onCreated,
  onCancel,
  purchaseKind = "MANUAL_JIT",
}: Props) {
  const isStockKeeping = purchaseKind === "STOCK_KEEPING";
  // 헤더 상태
  const [locationId, setLocationId] = useState<string>("");
  const [productionLineId, setProductionLineId] = useState<string>("");
  const [lineupId, setLineupId] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [outboundDate, setOutboundDate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // 옵션 로드
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLineOption[]>([]);
  const [lineups, setLineups] = useState<LineupOption[]>([]);

  // 행
  const [rows, setRows] = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 컴포넌트 마운트 시 1회 생성되는 멱등성 키
  const [idempotencyKey] = useState<string>(() => `manual-${uuid()}`);

  // ─── 옵션 로드 ────────────────────────
  useEffect(() => {
    (async () => {
      const [matRes, subRes, locRes, plRes, lnRes] = await Promise.all([
        getMaterialsAction({ page: 1, limit: 100, isActive: true }),
        getSubsidiariesAction({ page: 1, limit: 100, isActive: true }),
        getFactoryLocationOptionsAction(),
        getProductionLinesAction({ page: 1, limit: 200 }),
        getLineupsAction({ page: 1, limit: 200, isActive: true }),
      ]);

      if (matRes.success) {
        setMaterials(
          matRes.data.items.map((m) => ({
            id: m.id,
            name: m.name,
            code: m.code,
          }))
        );
      } else {
        toast.error(matRes.error.message);
      }

      // ★ S4-1-a: 부자재 옵션 로드
      if (subRes.success) {
        setSubsidiaries(
          subRes.data.items.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
          }))
        );
      } else {
        toast.error(subRes.error.message);
      }

      if (locRes.success) {
        setLocations(
          locRes.data.map((l) => ({ id: l.id, name: l.name, code: l.code }))
        );
      } else {
        toast.error(locRes.error.message);
      }

      if (plRes.success) {
        setProductionLines(
          plRes.data.items.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            locationId: p.locationId,
          }))
        );
      } else {
        toast.error(plRes.error.message);
      }

      if (lnRes.success) {
        setLineups(
          lnRes.data.items.map((l) => ({ id: l.id, name: l.name }))
        );
      } else {
        toast.error(lnRes.error.message);
      }
    })();
  }, []);

  // 공장이 바뀌면 productionLine 초기화
  useEffect(() => {
    setProductionLineId("");
  }, [locationId]);

  const filteredLines = useMemo(
    () =>
      productionLines.filter(
        (p) => !locationId || p.locationId === locationId
      ),
    [productionLines, locationId]
  );

  // ─── 행 조작 ─────────────────────────
  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: uuid(),
        itemType: "MATERIAL",
        itemMasterId: "",
        itemName: "",
        supplierItemId: "",
        supplierId: "",
        supplierName: "",
        productName: "",
        supplyUnitLabel: "",
        quantity: "",
        unitPrice: "",
        supplierItems: [],
        loading: false,
      },
    ]);
  };

  const removeRow = (key: string) =>
    setRows((prev) => prev.filter((r) => r.key !== key));

  const patchRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  // ★ S4-1-a: itemType 전환 시 관련 필드 전부 초기화
  const handleItemTypeChange = useCallback(
    (key: string, itemType: "MATERIAL" | "SUBSIDIARY") => {
      patchRow(key, {
        itemType,
        itemMasterId: "",
        itemName: "",
        supplierItemId: "",
        supplierId: "",
        supplierName: "",
        productName: "",
        supplyUnitLabel: "",
        unitPrice: "",
        supplierItems: [],
        loading: false,
      });
    },
    [patchRow]
  );

  // ★ S4-1-a: 자재/부자재 통합 핸들러
  const handleItemMasterChange = useCallback(
    async (
      key: string,
      itemType: "MATERIAL" | "SUBSIDIARY",
      itemMasterId: string
    ) => {
      const found =
        itemType === "MATERIAL"
          ? materials.find((m) => m.id === itemMasterId)
          : subsidiaries.find((s) => s.id === itemMasterId);
      patchRow(key, {
        itemMasterId,
        itemName: found?.name ?? "",
        supplierItemId: "",
        supplierId: "",
        supplierName: "",
        productName: "",
        supplyUnitLabel: "",
        unitPrice: "",
        supplierItems: [],
        loading: true,
      });
      const res =
        itemType === "MATERIAL"
          ? await getSupplierItemsByMaterialAction(itemMasterId)
          : await getSupplierItemsBySubsidiaryAction(itemMasterId);
      if (res.success) {
        const active = res.data.filter((si) => si.isActive);
        patchRow(key, { supplierItems: active, loading: false });
      } else {
        toast.error(res.error.message);
        patchRow(key, { loading: false });
      }
    },
    [materials, subsidiaries, patchRow]
  );

  const handleSupplierItemChange = (key: string, supplierItemId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const si = r.supplierItems.find((s) => s.id === supplierItemId);
        if (!si) return { ...r, supplierItemId };
        return {
          ...r,
          supplierItemId,
          supplierId: si.supplier.id,
          supplierName: si.supplier.name,
          productName: si.productName,
          supplyUnitLabel: si.supplyUnit?.name ?? si.supplyUnit?.code ?? "",
          unitPrice: String(si.currentPrice ?? 0),
        };
      })
    );
  };

  // ─── 합계 계산 ────────────────────────
  const totalAmount = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const q = Number(r.quantity) || 0;
        const p = Number(r.unitPrice) || 0;
        return sum + q * p;
      }, 0),
    [rows]
  );

  // supplier 그룹 미리보기 (몇 건의 PO가 생성될지 안내)
  const supplierGroupCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.supplierId) set.add(r.supplierId);
    }
    return set.size;
  }, [rows]);

  // ─── 저장 ────────────────────────────
  const handleSubmit = async () => {
    if (!locationId) return toast.error("공장(Location)을 선택하세요.");
    // ★ S4-1-b (P12): MANUAL_JIT 만 라인업 필수. STOCK_KEEPING 은 lineup 무귀속.
    if (!isStockKeeping && !lineupId)
      return toast.error("라인업(Lineup)은 필수입니다.");
    if (rows.length === 0) return toast.error("품목을 1개 이상 추가하세요.");

    for (const [idx, r] of rows.entries()) {
      const rowNo = idx + 1;
      if (!r.itemMasterId)
        return toast.error(
          `${rowNo}번 행: ${r.itemType === "MATERIAL" ? "자재" : "부자재"}를 선택하세요.`
        );
      if (!r.supplierItemId)
        return toast.error(`${rowNo}번 행: 공급 품목을 선택하세요.`);
      const q = Number(r.quantity);
      const p = Number(r.unitPrice);
      if (!(q > 0)) return toast.error(`${rowNo}번 행: 수량은 0보다 커야 합니다.`);
      if (!(p >= 0)) return toast.error(`${rowNo}번 행: 단가는 0 이상이어야 합니다.`);
    }

    setSubmitting(true);
    try {
      const res = await createPurchaseOrdersBatchAction({
        // companyId / createdByUserId 는 서버 액션이 세션에서 강제 주입
        idempotencyKey,
        mode: "NEW",
        isManual: true,
        purchaseKind, // ★ S4-1-b (P12): MANUAL_JIT | STOCK_KEEPING
        countSource: "ESTIMATED",
        basedOnPOIds: [],
        orderDate: new Date(orderDate),
        // ★ S4-1-b (P12): STOCK_KEEPING 은 outboundDate 무귀속
        outboundDate:
          !isStockKeeping && outboundDate ? new Date(outboundDate) : undefined,
        note: note || undefined,
        // ★ S4-1-a: itemType 분기로 materialMasterId / subsidiaryMasterId 를 상호배타적으로 전송
        items: rows.map((r) => ({
          supplierId: r.supplierId,
          supplierItemId: r.supplierItemId,
          itemType: r.itemType,
          materialMasterId:
            r.itemType === "MATERIAL" ? r.itemMasterId : undefined,
          subsidiaryMasterId:
            r.itemType === "SUBSIDIARY" ? r.itemMasterId : undefined,
          locationId,
          productionLineId: productionLineId || null,
          // ★ S4-1-b (P12): STOCK_KEEPING 은 lineupId 무귀속
          lineupId: isStockKeeping ? null : lineupId,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unitPrice),
          setAsDefault: false, // ★ P9' 수동 발주는 마스터 미변경
        })),
      });

      if (!res.success) {
        toast.error(res.error.message);
        setSubmitting(false);
        return;
      }

      const created = res.data.createdPurchaseOrders;
      if (created.length === 0) {
        toast.error("발주가 생성되지 않았습니다.");
        setSubmitting(false);
        return;
      }

      const label = isStockKeeping ? "재고 확보 발주" : "수동 발주";
      toast.success(
        created.length === 1
          ? `${label}가 생성되었습니다.`
          : `${label} ${created.length}건이 생성되었습니다.`
      );

      onCreated();
      // 성공 시 setSubmitting(false) 호출하지 않음 → 리다이렉트까지 버튼 비활성 유지
    } catch (e) {
      toast.error("발주 생성 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  // ─── 렌더 ────────────────────────────
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="rounded-md border bg-white p-4">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>
              공장 <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
            options={locations.map((l) => ({
                id: l.id,
                label: l.name,
                sublabel: l.code,
            }))}
            value={locationId}
            onChange={setLocationId}
            placeholder="공장 선택"
            searchPlaceholder="공장명 또는 코드 검색..."
            />
          </div>

          {/* ★ S4-1-b (P12): STOCK_KEEPING 은 lineup 무귀속 → 필드 자체를 렌더링하지 않음 */}
          {!isStockKeeping && (
            <div className="space-y-1.5">
              <Label>
                라인업 <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
              options={lineups.map((l) => ({
                  id: l.id,
                  label: l.name,
              }))}
              value={lineupId}
              onChange={setLineupId}
              placeholder="라인업 선택"
              searchPlaceholder="라인업명 검색..."
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>생산라인 (선택)</Label>
            <SearchableSelect
            options={filteredLines.map((p) => ({
                id: p.id,
                label: p.name,
                sublabel: p.code,
            }))}
            value={productionLineId}
            onChange={setProductionLineId}
            disabled={!locationId}
            placeholder={
                !locationId ? "공장 미선택" : "생산라인 선택 (선택)"
            }
            searchPlaceholder="라인명 또는 코드 검색..."
            allowClear
            clearLabel="선택 안 함"
            />

          </div>

          <div className="space-y-1.5">
            <Label>
              발주일 <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>

          {/* ★ S4-1-b (P12): STOCK_KEEPING 은 outboundDate 무귀속 → 필드 자체를 렌더링하지 않음 */}
          {!isStockKeeping && (
            <div className="space-y-1.5">
              <Label>출고 예정일</Label>
              <Input
                type="date"
                value={outboundDate}
                onChange={(e) => setOutboundDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5 md:col-span-3">
            <Label>비고</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
        </div>
      </div>

      {/* 품목 테이블 */}
      <div className="rounded-md border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">발주 품목</h2>
            <p className="text-xs text-gray-500">
              자재 또는 부자재를 먼저 선택한 뒤 공급업체·품목을 고르세요. 공급업체가 서로
              달라도 저장 시 자동으로 공급업체 단위로 분리되어 발주서가 생성됩니다.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" /> 품목 추가
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
                {/* ★ S4-1-a: 품목 유형 컬럼 추가 */}
                <TableHead className="w-[140px]">품목 유형</TableHead>
                <TableHead className="w-[220px]">품목</TableHead>
                <TableHead>공급업체 · 공급 품목</TableHead>
                <TableHead className="w-[140px]">단가</TableHead>
                <TableHead className="w-[80px]">단위</TableHead>
                <TableHead className="w-[120px]">수량</TableHead>
                <TableHead className="w-[140px] text-right">합계</TableHead>
                <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                  아직 품목이 없습니다. 우측 상단 &quot;품목 추가&quot; 버튼을
                  클릭하세요.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const rowTotal =
                  (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
                const itemOptions =
                  r.itemType === "MATERIAL"
                    ? materials.map((m) => ({
                        id: m.id,
                        label: m.name,
                        sublabel: m.code,
                      }))
                    : subsidiaries.map((s) => ({
                        id: s.id,
                        label: s.name,
                        sublabel: s.code,
                      }));
                return (
                  <TableRow key={r.key}>
                    {/* ★ S4-1-a: 자재 / 부자재 토글 */}
                    <TableCell>
                      <div className="inline-flex rounded-md border p-0.5">
                        <button
                          type="button"
                          onClick={() => handleItemTypeChange(r.key, "MATERIAL")}
                          className={`px-2.5 py-1 text-xs rounded ${
                            r.itemType === "MATERIAL"
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          자재
                        </button>
                        <button
                          type="button"
                          onClick={() => handleItemTypeChange(r.key, "SUBSIDIARY")}
                          className={`px-2.5 py-1 text-xs rounded ${
                            r.itemType === "SUBSIDIARY"
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          부자재
                        </button>
                      </div>
                    </TableCell>

                    <TableCell>
                        <SearchableSelect
                            options={itemOptions}
                            value={r.itemMasterId}
                            onChange={(v) => handleItemMasterChange(r.key, r.itemType, v)}
                            placeholder={
                              r.itemType === "MATERIAL" ? "자재 선택" : "부자재 선택"
                            }
                            searchPlaceholder={
                              r.itemType === "MATERIAL"
                                ? "자재명 또는 코드 검색..."
                                : "부자재명 또는 코드 검색..."
                            }
                            emptyText="검색 결과가 없습니다"
                        />
                    </TableCell>

                    <TableCell>
                        <SearchableSelect
                            options={r.supplierItems.map((si) => ({
                            id: si.id,
                            label: `[${si.supplier.name}] ${si.productName}`,
                            rightLabel: `${si.currentPrice.toLocaleString()}원`,
                            }))}
                            value={r.supplierItemId}
                            onChange={(v) => handleSupplierItemChange(r.key, v)}
                            disabled={
                            !r.itemMasterId ||
                            r.loading ||
                            r.supplierItems.length === 0
                            }
                            placeholder={
                            !r.itemMasterId
                                ? `먼저 ${r.itemType === "MATERIAL" ? "자재" : "부자재"} 선택`
                                : r.loading
                                ? "불러오는 중..."
                                : r.supplierItems.length === 0
                                    ? "등록된 공급 품목 없음"
                                    : "공급업체·품목 선택"
                            }
                            searchPlaceholder="공급업체 또는 품목명 검색..."
                            emptyText="검색 결과가 없습니다"
                        />
                    </TableCell>

                    <TableCell>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={r.unitPrice}
                            onChange={(e) =>
                            patchRow(r.key, { unitPrice: e.target.value })
                            }
                        />
                    </TableCell>

                    <TableCell className="text-sm text-gray-600">
                        {r.supplyUnitLabel || "-"}
                    </TableCell>

                    <TableCell>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={r.quantity}
                            onChange={(e) =>
                            patchRow(r.key, { quantity: e.target.value })
                            }
                            placeholder="0"
                        />
                    </TableCell>

                    <TableCell className="text-right font-mono">
                      {rowTotal.toLocaleString()}원
                    </TableCell>

                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.key)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 요약 + 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-gray-50 p-4">
        <div className="text-sm text-gray-600">
          공급업체 <span className="font-semibold">{supplierGroupCount}</span>곳
          → 발주서 <span className="font-semibold">{supplierGroupCount}</span>건
          생성 예정
        </div>
        <div className="text-lg font-semibold">
          합계{" "}
          <span className="ml-2 font-mono">{totalAmount.toLocaleString()}원</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "생성 중..." : "발주 생성 (DRAFT)"}
        </Button>
      </div>
    </div>
  );
}
