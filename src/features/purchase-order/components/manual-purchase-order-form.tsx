"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { createPurchaseOrderAction } from "../actions/purchase-order.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import { getSuppliersAction } from "@/features/supplier/actions/supplier.action";
import { getLocationsAction } from "@/features/location/actions/location.action";
import { getProductionLinesAction } from "@/features/production-line/actions/production-line.action";
import { getLineupsAction } from "@/features/lineup/actions/lineup.action";
import { SupplierItemPicker } from "./wizard/supplier-item-picker";
import type { SupplierItemWithSupplier } from "@/features/supplier/actions/supplier.action";

// ────────────────────────────────────────
// 옵션 타입 (액션 반환에서 필요한 필드만 사용)
// ────────────────────────────────────────
type MaterialOption = { id: string; name: string; code: string };
type SupplierOption = { id: string; name: string; code: string };
type LocationOption = { id: string; name: string; code: string };
type ProductionLineOption = {
  id: string;
  name: string;
  locationId: string;
};
type LineupOption = { id: string; name: string; code: string };

// ────────────────────────────────────────
// 아이템 행 로컬 상태
// ────────────────────────────────────────
type ItemRow = {
  key: string;
  materialMasterId: string | null;
  materialName: string;
  supplierItemId: string | null;
  supplierItemLabel: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  onCreated: (id: string) => void;
  onCancel: () => void;
};

// ────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────
export function ManualPurchaseOrderForm({ onCreated, onCancel }: Props) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLineOption[]>([]);
  const [lineups, setLineups] = useState<LineupOption[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [productionLineId, setProductionLineId] = useState("");
  const [lineupId, setLineupId] = useState("");
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [outboundDate, setOutboundDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 초기 옵션 로드
  useEffect(() => {
    Promise.all([
      getMaterialsAction({ page: 1, limit: 200, isActive: true }),
      getSuppliersAction({ page: 1, limit: 200 }),
      getLocationsAction({ page: 1, limit: 100, isActive: true }),
      getProductionLinesAction({ page: 1, limit: 200 }),
      getLineupsAction({ page: 1, limit: 200, isActive: true }),
    ])
      .then(([mRes, sRes, lRes, plRes, luRes]) => {
        if (mRes.success) {
          setMaterials(
            mRes.data.items.map((m) => ({
              id: m.id,
              name: m.name,
              code: m.code,
            })),
          );
        } else {
          toast.error(mRes.error.message);
        }
        if (sRes.success) {
          setSuppliers(
            sRes.data.items.map((s) => ({
              id: s.id,
              name: s.name,
              code: s.code,
            })),
          );
        } else {
          toast.error(sRes.error.message);
        }
        if (lRes.success) {
          setLocations(
            lRes.data.items.map((l) => ({
              id: l.id,
              name: l.name,
              code: l.code,
            })),
          );
        } else {
          toast.error(lRes.error.message);
        }
        if (plRes.success) {
          setProductionLines(
            plRes.data.items.map((pl) => ({
              id: pl.id,
              name: pl.name,
              locationId: pl.locationId,
            })),
          );
        } else {
          toast.error(plRes.error.message);
        }
        if (luRes.success) {
          setLineups(
            luRes.data.items.map((lu) => ({
              id: lu.id,
              name: lu.name,
              code: lu.code,
            })),
          );
        } else {
          toast.error(luRes.error.message);
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "옵션 조회 실패");
      });
  }, []);

  // 파생 값
  const filteredProductionLines = productionLines.filter(
    (pl) => !locationId || pl.locationId === locationId,
  );
  const totalAmount = items.reduce(
    (sum, it) => sum + it.quantity * it.unitPrice,
    0,
  );

  // 아이템 조작
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        materialMasterId: null,
        materialName: "",
        supplierItemId: null,
        supplierItemLabel: "",
        quantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((row) => row.key !== key));
  };

  const selectMaterial = (key: string, materialId: string) => {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;
    updateItem(key, {
      materialMasterId: mat.id,
      materialName: mat.name,
      supplierItemId: null,
      supplierItemLabel: "",
      unitPrice: 0,
    });
  };

  // ★ SupplierItemWithSupplier: supplier.name / productName / currentPrice
  const selectSupplierItem = (key: string, si: SupplierItemWithSupplier) => {
    updateItem(key, {
      supplierItemId: si.id,
      supplierItemLabel: `${si.supplier.name} · ${si.productName}`,
      unitPrice: si.currentPrice ?? 0,
    });
  };

  // 검증
  const validate = (): string | null => {
    if (!supplierId) return "공급업체를 선택하세요";
    if (!locationId) return "공장/창고를 선택하세요";
    if (!lineupId) return "라인업을 선택하세요 (수동 발주 필수)";
    if (!orderDate) return "발주일을 입력하세요";
    if (items.length === 0) return "발주 품목을 1개 이상 추가하세요";
    for (const [i, it] of items.entries()) {
      if (!it.materialMasterId) return `${i + 1}번 행: 자재를 선택하세요`;
      if (!it.supplierItemId) return `${i + 1}번 행: 공급 품목을 선택하세요`;
      if (!(it.quantity > 0)) return `${i + 1}번 행: 수량은 0보다 커야 합니다`;
      if (!(it.unitPrice >= 0)) return `${i + 1}번 행: 단가는 0 이상이어야 합니다`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPurchaseOrderAction({
        supplierId,
        locationId,
        productionLineId: productionLineId || null,
        lineupId,
        orderDate,
        outboundDate: outboundDate || undefined,
        note: note || undefined,
        isManual: true, // ★ 핵심
        items: items.map((it) => ({
          supplierItemId: it.supplierItemId!,
          itemType: "MATERIAL" as const,
          materialMasterId: it.materialMasterId!,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          sourceType: "MANUAL",
        })),
      });
      if (result.success) {
        toast.success("수동 발주서가 생성되었습니다 (DRAFT)");
        onCreated(result.data.id);
      } else {
        toast.error(result.error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 정보 */}
      <section className="grid gap-4 rounded-md border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label>공급업체 *</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>공장/창고 *</Label>
          <Select
            value={locationId}
            onValueChange={(v) => {
              setLocationId(v);
              setProductionLineId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>생산 라인 (선택)</Label>
          <Select
            value={productionLineId}
            onValueChange={setProductionLineId}
            disabled={!locationId}
          >
            <SelectTrigger>
              <SelectValue placeholder="선택 안 함" />
            </SelectTrigger>
            <SelectContent>
              {filteredProductionLines.map((pl) => (
                <SelectItem key={pl.id} value={pl.id}>
                  {pl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>
            라인업 *{" "}
            <span className="text-xs text-purple-700">(수동 발주 필수)</span>
          </Label>
          <Select value={lineupId} onValueChange={setLineupId}>
            <SelectTrigger>
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {lineups.map((lu) => (
                <SelectItem key={lu.id} value={lu.id}>
                  {lu.name} ({lu.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>발주일 *</Label>
          <Input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>출고일 (선택)</Label>
          <Input
            type="date"
            value={outboundDate}
            onChange={(e) => setOutboundDate(e.target.value)}
          />
        </div>

        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <Label>비고</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="발주 비고 (선택)"
          />
        </div>
      </section>

      {/* 품목 테이블 */}
      <section className="rounded-md border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h3 className="text-sm font-medium">발주 품목 *</h3>
          <Button onClick={addItem} size="sm" variant="outline">
            <Plus className="mr-1 h-3.5 w-3.5" /> 품목 추가
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">자재</TableHead>
              <TableHead>공급 품목</TableHead>
              <TableHead className="w-[100px]">수량</TableHead>
              <TableHead className="w-[120px]">단가</TableHead>
              <TableHead className="w-[120px] text-right">합계</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-gray-500">
                  &apos;품목 추가&apos; 버튼을 눌러 시작하세요
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <Select
                      value={row.materialMasterId ?? ""}
                      onValueChange={(v) => selectMaterial(row.key, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="자재 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {row.materialMasterId ? (
                      <SupplierItemPicker
                        materialMasterId={row.materialMasterId}
                        value={row.supplierItemId}
                        onSelect={(si) => selectSupplierItem(row.key, si)}
                      />
                    ) : (
                      <span className="text-xs text-gray-400">자재 먼저 선택</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) =>
                        updateItem(row.key, { quantity: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={row.unitPrice}
                      onChange={(e) =>
                        updateItem(row.key, { unitPrice: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {(row.quantity * row.unitPrice).toLocaleString()} 원
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(row.key)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end border-t px-4 py-2 text-sm">
          <span className="text-gray-600">
            총 합계:{" "}
            <span className="font-semibold text-gray-900">
              {totalAmount.toLocaleString()} 원
            </span>
          </span>
        </div>
      </section>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "생성 중..." : "DRAFT 저장"}
        </Button>
      </div>
    </div>
  );
}
