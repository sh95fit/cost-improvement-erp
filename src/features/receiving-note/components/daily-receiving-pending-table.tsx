"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Save,
  CheckCircle2,
  FileEdit,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DailyPendingPO,
  DailyReceivingBundle,
} from "../services/daily-receiving.service";
import { bulkCreateOrUpdateReceivingNoteDraftsAction } from "../actions/bulk-create-or-update-receiving-note-drafts.action";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 - 대기(pending) 테이블
//   - 각 PO 행에 체크박스 + 확장(품목 편집)
//   - "선택 저장" → bulkCreateOrUpdateReceivingNoteDraftsAction
//   - "선택 확정" 버튼은 자리만 마련 (G-3b 에서 다이얼로그 연결)
// ════════════════════════════════════════

type Props = {
  date: string;                    // YYYY-MM-DD (initial receivedDate 값)
  pending: DailyReceivingBundle["pending"];
  onRequestConfirm: (receivingNoteIds: string[]) => void;
};

/** 화면 편집 상태 — PO 단위로 items 편집값 보유 */
type EditableRow = {
  po: DailyPendingPO;
  receivedDate: string;              // YYYY-MM-DD (input[type=date])
  note: string;
  items: Array<{
    purchaseOrderItemId: string;
    itemName: string;
    unit: string;
    orderedQty: number;
    receivedQty: string;             // string 편집 유지 → 저장 시 Number 변환
    unitPrice: string;
  }>;
};

const fmtNumber = (n: number) =>
  new Intl.NumberFormat("ko-KR").format(Number.isFinite(n) ? n : 0);

/** PO/기존 DRAFT → EditableRow 초기화 */
function toEditable(po: DailyPendingPO, fallbackDate: string): EditableRow {
  const draft = po.existingDraft;

  // draft.items 를 purchaseOrderItemId 기준으로 map 화 → PO items 순서로 병합
  const draftMap = new Map(
    (draft?.items ?? []).map((di) => [
      di.purchaseOrderItemId ?? "",
      { receivedQty: di.receivedQty, unitPrice: di.unitPrice },
    ]),
  );

  return {
    po,
    receivedDate: draft
      ? new Date(draft.receivedDate).toISOString().slice(0, 10)
      : fallbackDate,
    note: draft?.note ?? "",
    items: po.purchaseOrder.items.map((it) => {
      const d = draftMap.get(it.purchaseOrderItemId);
      return {
        purchaseOrderItemId: it.purchaseOrderItemId,
        itemName: it.itemName,
        unit: it.unit,
        orderedQty: it.orderedQty,
        // 기존 DRAFT 있으면 그 값, 없으면 orderedQty/unitPrice 프리필
        receivedQty:
          d?.receivedQty != null ? String(d.receivedQty) : String(it.orderedQty),
        unitPrice:
          d?.unitPrice != null ? String(d.unitPrice) : String(it.unitPrice),
      };
    }),
  };
}

export function DailyReceivingPendingTable({
  date,
  pending,
  onRequestConfirm,
}: Props) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  // PO id → EditableRow
  const [rows, setRows] = useState<Record<string, EditableRow>>(() => {
    const initial: Record<string, EditableRow> = {};
    for (const p of pending) {
      initial[p.purchaseOrder.id] = toEditable(p, date);
    }
    return initial;
  });

  // 확장된 PO id 집합
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 선택된 PO id 집합
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = pending.length > 0 && selected.size === pending.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pending.map((p) => p.purchaseOrder.id)));
  };
  const toggleSelect = (poId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };
  const toggleExpand = (poId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  const updateItemField = (
    poId: string,
    itemIdx: number,
    field: "receivedQty" | "unitPrice",
    value: string,
  ) => {
    setRows((prev) => {
      const row = prev[poId];
      if (!row) return prev;
      const nextItems = row.items.map((it, i) =>
        i === itemIdx ? { ...it, [field]: value } : it,
      );
      return { ...prev, [poId]: { ...row, items: nextItems } };
    });
  };

  const updateRowField = (
    poId: string,
    field: "receivedDate" | "note",
    value: string,
  ) => {
    setRows((prev) => {
      const row = prev[poId];
      if (!row) return prev;
      return { ...prev, [poId]: { ...row, [field]: value } };
    });
  };

  /** 선택된 PO 를 bulk-draft 로 저장 */
  const handleSave = () => {
    const targetIds = Array.from(selected);
    if (targetIds.length === 0) {
      toast.error("저장할 발주를 선택하세요");
      return;
    }

    // 입력값 검증 + payload 구성
    const inputs: Array<{
        purchaseOrderId: string;
        receivedDate: string;
        note?: string;
        items: Array<{
          purchaseOrderItemId: string;
          receivedQty: number;
          unitPrice: number;
        }>;
      }> = [];
    for (const poId of targetIds) {
      const row = rows[poId];
      if (!row) continue;
      if (!row.receivedDate) {
        toast.error(`${row.po.purchaseOrder.orderNumber}: 입고일을 입력하세요`);
        return;
      }
      const items = row.items.map((it) => ({
        purchaseOrderItemId: it.purchaseOrderItemId,
        receivedQty: Number(it.receivedQty),
        unitPrice: Number(it.unitPrice),
      }));
      const bad = items.find(
        (it) =>
          !Number.isFinite(it.receivedQty) ||
          it.receivedQty < 0 ||
          !Number.isFinite(it.unitPrice) ||
          it.unitPrice < 0,
      );
      if (bad) {
        toast.error(
          `${row.po.purchaseOrder.orderNumber}: 수량/단가는 0 이상 숫자여야 합니다`,
        );
        return;
      }
      inputs.push({
        purchaseOrderId: poId,
        receivedDate: row.receivedDate,
        note: row.note || undefined,
        items,
      });
    }

    startSaving(async () => {
      const res = await bulkCreateOrUpdateReceivingNoteDraftsAction({ inputs });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${res.data.length}건 저장되었습니다`);
      // 서버 데이터 재조회
      router.refresh();
    });
  };

  /** 선택된 PO 의 receivingNoteId(=기존 DRAFT id) 를 모아 확정 프리뷰 요청 */
  const handleConfirmClick = () => {
    const noteIds: string[] = [];
    const missing: string[] = [];
    for (const poId of selected) {
      const draftId = pending.find((p) => p.purchaseOrder.id === poId)
        ?.existingDraft?.receivingNoteId;
      if (draftId) noteIds.push(draftId);
      else {
        const po = pending.find((p) => p.purchaseOrder.id === poId);
        if (po) missing.push(po.purchaseOrder.orderNumber);
      }
    }
    if (missing.length > 0) {
      toast.error(
        `저장되지 않은 발주가 있어 확정할 수 없습니다: ${missing.join(", ")}. 먼저 저장하세요.`,
      );
      return;
    }
    if (noteIds.length === 0) {
      toast.error("확정할 입고서를 선택하세요");
      return;
    }
    onRequestConfirm(noteIds);
  };

  const selectedCount = selected.size;
  const savedSelectedCount = useMemo(() => {
    let c = 0;
    for (const poId of selected) {
      const po = pending.find((p) => p.purchaseOrder.id === poId);
      if (po?.existingDraft) c++;
    }
    return c;
  }, [selected, pending]);

  if (pending.length === 0) {
    return (
      <div className="rounded-md border bg-white p-8 text-center text-sm text-gray-500">
        <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        선택한 날짜에 처리할 발주가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-white p-3">
        <div className="text-sm text-gray-500">
          선택 <span className="font-semibold text-gray-900">{selectedCount}</span>건
          {selectedCount > 0 && (
            <>
              {" "}
              (저장됨 <span className="font-semibold text-emerald-700">{savedSelectedCount}</span>건)
            </>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || selectedCount === 0}
          >
            <Save className="mr-1.5 h-4 w-4" />
            선택 저장(초안)
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmClick}
            disabled={isSaving || selectedCount === 0}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            선택 확정
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42px] text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                  aria-label="전체 선택"
                />
              </TableHead>
              <TableHead className="w-[32px]" />
              <TableHead className="w-[140px]">발주번호</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead className="w-[110px]">창고</TableHead>
              <TableHead className="w-[110px]">라인</TableHead>
              <TableHead className="w-[70px] text-center">품목</TableHead>
              <TableHead className="w-[100px] text-right">예상금액</TableHead>
              <TableHead className="w-[90px] text-center">초안</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((p) => {
              const poId = p.purchaseOrder.id;
              const row = rows[poId];
              const isExpanded = expanded.has(poId);
              const isSelected = selected.has(poId);
              const total = p.purchaseOrder.items.reduce(
                (s, it) => s + it.orderedQty * it.unitPrice,
                0,
              );
              return (
                <Fragment key={poId}>
                  <TableRow
                    className={isSelected ? "bg-blue-50/40" : undefined}
                  >
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(poId)}
                        aria-label={`${p.purchaseOrder.orderNumber} 선택`}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleExpand(poId)}
                        className="rounded p-1 hover:bg-gray-100"
                        aria-label={isExpanded ? "접기" : "펼치기"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {p.purchaseOrder.orderNumber}
                    </TableCell>
                    <TableCell>{p.purchaseOrder.supplierName}</TableCell>
                    <TableCell>{p.purchaseOrder.locationName}</TableCell>
                    <TableCell>
                      {p.purchaseOrder.productionLineName ?? "-"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {p.purchaseOrder.items.length}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtNumber(total)}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {p.existingDraft ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          <FileEdit className="h-3 w-3" /> 있음
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>

                  {isExpanded && row && (
                    <TableRow key={`${poId}-expand`} className="bg-gray-50/50">
                      <TableCell colSpan={9} className="p-4">
                        <div className="space-y-3">
                          {/* 상단 편집 필드 */}
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="w-[180px]">
                              <label className="mb-1 block text-xs text-gray-500">
                                입고일
                              </label>
                              <Input
                                type="date"
                                value={row.receivedDate}
                                onChange={(e) =>
                                  updateRowField(
                                    poId,
                                    "receivedDate",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="flex-1 min-w-[240px]">
                              <label className="mb-1 block text-xs text-gray-500">
                                메모
                              </label>
                              <Input
                                value={row.note}
                                onChange={(e) =>
                                  updateRowField(poId, "note", e.target.value)
                                }
                                placeholder="입고 관련 메모"
                              />
                            </div>
                          </div>

                          {/* 품목 편집 */}
                          <div className="overflow-hidden rounded border bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>품목</TableHead>
                                  <TableHead className="w-[80px]">
                                    단위
                                  </TableHead>
                                  <TableHead className="w-[110px] text-right">
                                    발주수량
                                  </TableHead>
                                  <TableHead className="w-[130px] text-right">
                                    입고수량
                                  </TableHead>
                                  <TableHead className="w-[130px] text-right">
                                    입고단가
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.items.map((it, idx) => (
                                  <TableRow key={it.purchaseOrderItemId}>
                                    <TableCell className="text-sm">
                                      {it.itemName}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                      {it.unit || "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-gray-500">
                                      {fmtNumber(it.orderedQty)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={it.receivedQty}
                                        onChange={(e) =>
                                          updateItemField(
                                            poId,
                                            idx,
                                            "receivedQty",
                                            e.target.value,
                                          )
                                        }
                                        className="h-8 text-right font-mono"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={it.unitPrice}
                                        onChange={(e) =>
                                          updateItemField(
                                            poId,
                                            idx,
                                            "unitPrice",
                                            e.target.value,
                                          )
                                        }
                                        className="h-8 text-right font-mono"
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
