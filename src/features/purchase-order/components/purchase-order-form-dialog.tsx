"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPurchaseOrderAction,
  updatePurchaseOrderAction,
} from "../actions/purchase-order.action";
import { SupplierCombobox } from "./supplier-combobox";
import {
  PurchaseOrderItemRow,
  type POItemFormRow,
  type SupplierItemOption,
} from "./purchase-order-item-row";

type EditingPurchaseOrder = {
  id: string;
  supplierId: string;
  orderDate: Date | string;
  deliveryDate: Date | string | null;
  note: string | null;
  items: Array<{
    id: string;
    supplierItemId: string;
    itemType: "MATERIAL" | "SUBSIDIARY";
    materialMasterId: string | null;
    subsidiaryMasterId: string | null;
    quantity: number;
    unitPrice: number;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EditingPurchaseOrder | null;   // null/undefined면 신규
  onSaved: () => void;
};

const newKey = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const toDateInput = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export function PurchaseOrderFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const isEdit = !!editing;

  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? "");
  const [orderDate, setOrderDate] = useState(
    toDateInput(editing?.orderDate) || new Date().toISOString().slice(0, 10),
  );
  const [deliveryDate, setDeliveryDate] = useState(toDateInput(editing?.deliveryDate));
  const [note, setNote] = useState(editing?.note ?? "");
  const [rows, setRows] = useState<POItemFormRow[]>(
    editing?.items.map((it) => ({
      key: newKey(),
      supplierItemId: it.supplierItemId,
      itemType: it.itemType,
      materialMasterId: it.materialMasterId ?? undefined,
      subsidiaryMasterId: it.subsidiaryMasterId ?? undefined,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })) ?? [],
  );
  const [supplierItemsCache, setSupplierItemsCache] = useState<SupplierItemOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 공급사 변경 시 캐시/품목 초기화
  const handleSupplierChange = (id: string) => {
    if (id !== supplierId) {
      setSupplierId(id);
      setSupplierItemsCache(null);
      setRows([]);
    }
  };

  const handleCacheLoaded = useCallback((items: SupplierItemOption[]) => {
    setSupplierItemsCache(items);
  }, []);

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: newKey(),
        supplierItemId: "",
        itemType: "MATERIAL",
        quantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const handleRowChange = (idx: number, next: POItemFormRow) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? next : r)));
  };

  const handleRowRemove = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0),
    [rows],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) return setError("공급업체를 선택해주세요");
    if (!orderDate) return setError("발주일을 입력해주세요");
    if (rows.length === 0) return setError("품목을 1개 이상 추가해주세요");
    for (const [i, r] of rows.entries()) {
      if (!r.supplierItemId) return setError(`${i + 1}번째 행: 품목을 선택해주세요`);
      if (r.quantity <= 0) return setError(`${i + 1}번째 행: 수량은 0보다 커야 합니다`);
      if (r.unitPrice < 0) return setError(`${i + 1}번째 행: 단가는 0 이상이어야 합니다`);
    }

    setLoading(true);
    try {
      const items = rows.map((r) => ({
        supplierItemId: r.supplierItemId,
        itemType: r.itemType,
        materialMasterId: r.materialMasterId,
        subsidiaryMasterId: r.subsidiaryMasterId,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
      }));

      const result = isEdit
        ? await updatePurchaseOrderAction(editing!.id, {
            supplierId,
            orderDate: new Date(orderDate),
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            note: note || null,
            items,
          })
        : await createPurchaseOrderAction({
            supplierId,
            orderDate: new Date(orderDate),
            deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
            note: note || undefined,
            isManual: true, // 수동 등록 UI 경유
            items,
          });

      if (result.success) {
        toast.success(isEdit ? "발주서가 수정되었습니다" : "발주서가 등록되었습니다");
        onSaved();
        onOpenChange(false);
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("요청 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "발주서 수정" : "발주서 등록"}</DialogTitle>
          <DialogDescription>
            공급업체와 품목을 선택하고 수량/단가를 입력하세요. 합계는 자동 계산됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label>공급업체 *</Label>
              <SupplierCombobox
                value={supplierId}
                onChange={(id) => handleSupplierChange(id)}
                disabled={isEdit /* 수정 시 변경 불가 (단순화) */}
              />
              {isEdit && (
                <p className="text-xs text-gray-500">
                  ※ 수정 시 공급업체 변경은 새 발주서를 등록해 주세요.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderDate">발주일 *</Label>
              <Input
                id="orderDate"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryDate">입고예정일</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="note">비고</Label>
              <Textarea
                id="note"
                placeholder="발주서 메모 (선택)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* 품목 그리드 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">발주 품목</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                disabled={!supplierId}
              >
                <Plus className="mr-1 h-4 w-4" /> 품목 추가
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>품목</TableHead>
                    <TableHead className="w-[100px]">단위</TableHead>
                    <TableHead className="w-[110px] text-right">수량</TableHead>
                    <TableHead className="w-[130px] text-right">단가(원)</TableHead>
                    <TableHead className="w-[120px] text-right">소계</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <td colSpan={6} className="h-20 text-center text-sm text-gray-500">
                        {supplierId
                          ? "품목 추가 버튼을 눌러 발주 품목을 입력하세요"
                          : "공급업체를 먼저 선택해주세요"}
                      </td>
                    </TableRow>
                  ) : (
                    rows.map((row, idx) => (
                      <PurchaseOrderItemRow
                        key={row.key}
                        row={row}
                        supplierId={supplierId}
                        supplierItemsCache={supplierItemsCache}
                        onCacheLoaded={handleCacheLoaded}
                        onChange={(next) => handleRowChange(idx, next)}
                        onRemove={() => handleRowRemove(idx)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 합계 */}
            <div className="flex items-center justify-end gap-3 rounded-md bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">총 합계</span>
              <span className="font-mono text-lg font-semibold">
                {new Intl.NumberFormat("ko-KR", {
                  style: "currency",
                  currency: "KRW",
                  maximumFractionDigits: 0,
                }).format(totalAmount)}
              </span>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
