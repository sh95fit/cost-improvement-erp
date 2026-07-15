"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { buildConsumptionDraftAction } from "../actions/build-consumption-draft.action";
import type { LayerBItem } from "../types/layer-b-item.type";
import { ConsumptionLayerBEditor } from "./consumption-layer-b-editor";

type DraftData = Extract<
  Awaited<ReturnType<typeof buildConsumptionDraftAction>>,
  { success: true }
>["data"];

type Props = {
  draft: DraftData;
  targetDate: string;   // YYYY-MM-DD
  locationId: string;
};

const numberFmt = (v: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 }).format(v);

export function ConsumptionDraftForm({ draft, targetDate, locationId: _locationId }: Props) {
  // S4-3-c-2 — Layer B 클라이언트 상태
  const [layerBItems, setLayerBItems] = useState<LayerBItem[]>([]);
  
  const hasInvalidLayerB = layerBItems.some((it) => it.quantity <= 0);
    
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="rounded-md border bg-white p-4">
        <h1 className="text-lg font-semibold">사용 처리</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-gray-600">출고일자</dt>
          <dd>{targetDate}</dd>
          <dt className="text-gray-600">식단 그룹</dt>
          <dd className="font-mono text-xs">{draft.header.mealPlanGroupId}</dd>
          <dt className="text-gray-600">예상 식수 합계</dt>
          <dd>{numberFmt(draft.header.totalEstimatedCount)}</dd>
          <dt className="text-gray-600">확정 식수 합계</dt>
          <dd>{numberFmt(draft.header.totalFinalCount)}</dd>
        </dl>
      </div>

      {/* Layer A (자동 산출) — c-1: 읽기전용 */}
      <div className="rounded-md border bg-gray-50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">
          Layer A — 식단 자동 산출 ({draft.layerAItems.length}건)
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                <TableHead>품목명</TableHead>
                <TableHead>코드</TableHead>
                <TableHead className="text-right">예상 사용량</TableHead>
                <TableHead>단위</TableHead>
                <TableHead className="text-right">가용 재고</TableHead>
                <TableHead className="text-right">당일 입고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.layerAItems.map((it) => (
                <TableRow key={`${it.itemType}-${it.itemId}`}>
                  <TableCell className="text-xs text-gray-600">{it.itemType}</TableCell>
                  <TableCell>{it.itemName}</TableCell>
                  <TableCell className="font-mono text-xs">{it.itemCode}</TableCell>
                  <TableCell className="text-right">{numberFmt(it.expectedQty)}</TableCell>
                  <TableCell>{it.unit}</TableCell>
                  <TableCell className="text-right">{numberFmt(it.availableQty)}</TableCell>
                  <TableCell className="text-right">{numberFmt(it.inboundQtyOnDate)}</TableCell>
                </TableRow>
              ))}
              {draft.layerAItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-500">
                    자동 산출된 품목이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Layer B (수동 추가) — S4-3-c-2 */}
      <ConsumptionLayerBEditor
        layerAItems={draft.layerAItems}
        items={layerBItems}
        onChange={setLayerBItems}
      />


      {/* 확정 버튼 — c-1 은 비활성 */}
      <div className="flex justify-end gap-2">
        <Link href="/consumption">
          <Button variant="outline">취소</Button>
        </Link>
        <Button
          disabled
          title={
            hasInvalidLayerB
              ? "Layer B 수량 오류 항목이 있습니다"
              : "S4-3-d 에서 활성화"
          }
        >
          사용 처리 확정 (미구현)
        </Button>
      </div>
    </div>
  );
}
