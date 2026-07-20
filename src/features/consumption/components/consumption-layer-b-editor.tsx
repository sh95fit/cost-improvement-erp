"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { ItemType } from "@prisma/client";
import type { LayerBItem } from "../types/layer-b-item.type";
import type { ConsumptionDraftItem } from "../services/consumption-draft.service";
import { ConsumptionItemPickerDialog, type PickedItem } from "./consumption-item-picker-dialog";

type Props = {
  layerAItems: ConsumptionDraftItem[];       // 중복 경고용
  items: LayerBItem[];
  onChange: (next: LayerBItem[]) => void;
};

const numberFmt = (v: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 }).format(v);

export function ConsumptionLayerBEditor({ layerAItems, items, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // 자재/부자재 별 Layer A 매핑 (중복 검사용)
  // S4-3-c-4-3: expectedQty → theoreticalQty
  const layerAKey = (t: ItemType, id: string) => `${t}::${id}`;
  const layerAMap = new Map(
    layerAItems.map((a) => [layerAKey(a.itemType, a.itemId), a.theoreticalQty]),
  );

  const handlePick = (picked: PickedItem) => {
    // 이미 Layer B에 같은 아이템이 있으면 (중복 방지)
    const dupIdx = items.findIndex(
      (it) => it.itemType === picked.itemType && it.itemId === picked.itemId,
    );
    if (dupIdx >= 0) {
      alert("이미 추가된 품목입니다. 수량을 수정해 주세요.");
      return;
    }

    onChange([
      ...items,
      {
        clientId: crypto.randomUUID(),
        itemType: picked.itemType,
        itemId: picked.itemId,
        itemName: picked.itemName,
        itemCode: picked.itemCode,
        unit: picked.unit,
        quantity: 0,
        note: "",
      },
    ]);
  };

  const updateItem = (clientId: string, patch: Partial<LayerBItem>) => {
    onChange(
      items.map((it) => (it.clientId === clientId ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (clientId: string) => {
    onChange(items.filter((it) => it.clientId !== clientId));
  };

  const totalCount = items.length;
  const invalidRows = items.filter((it) => it.quantity <= 0).length;
  const overlapWithLayerA = items.filter((it) =>
    layerAMap.has(layerAKey(it.itemType, it.itemId)),
  ).length;

  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          Layer B — 수동 추가 ({totalCount}건)
        </h2>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          품목 추가
        </Button>
      </div>

      {overlapWithLayerA > 0 && (
        <div className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          Layer A 와 중복되는 품목이 {overlapWithLayerA}건 있습니다. 추가 사용분으로 합산 처리되며,
          최종 재고 검증은 확정 시 수행됩니다.
        </div>
      )}
      {invalidRows > 0 && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          수량이 0 이하인 항목이 {invalidRows}건 있습니다. 확정 전에 수정해 주세요.
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead>품목명</TableHead>
              <TableHead>코드</TableHead>
              <TableHead className="w-28 text-right">수량</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>사유(선택)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => {
              const layerAQty = layerAMap.get(layerAKey(it.itemType, it.itemId));
              return (
                <TableRow key={it.clientId}>
                  <TableCell className="text-xs text-gray-600">{it.itemType}</TableCell>
                  <TableCell>
                    {it.itemName}
                    {layerAQty !== undefined && (
                      <span className="ml-2 text-xs text-amber-700">
                        (A 이론: {numberFmt(layerAQty)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{it.itemCode}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      className="h-8 text-right"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(it.clientId, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>{it.unit}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      placeholder="예: 실측 대비 초과"
                      value={it.note ?? ""}
                      onChange={(e) => updateItem(it.clientId, { note: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(it.clientId)}
                      aria-label="삭제"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-gray-500">
                  수동 추가 항목이 없습니다. 필요 시 우측 상단 &ldquo;품목 추가&rdquo; 버튼을 사용하세요.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ConsumptionItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePick}
      />
    </div>
  );
}
