"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { DisposalReason, ItemType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { confirmConsumptionAction } from "../actions/confirm-consumption.action";

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
type DraftData = Extract<
  Awaited<ReturnType<typeof buildConsumptionDraftAction>>,
  { success: true }
>["data"];
type DraftItem = DraftData["layerAItems"][number];

type Props = {
  draft: DraftData;
  targetDate: string; // YYYY-MM-DD
  locationId: string;
};

/**
 * S4-3-c-4-3: Smart Consumption Row 행 상태
 * - 초기값: finalUsedQty = roundedFinalQty × packagingFactor (기본단위 환산)
 *           remainingToStock = max(0, totalAvailable - finalUsedQty)
 *   → 초기 상태에서 disposalQty=0 이 되도록 재고 잔량이 흡수
 */
type RowState = {
  finalUsedQty: number;
  remainingToStock: number;
  disposalReason: DisposalReason | "";
  disposalNote: string;
};

const DISPOSAL_REASON_LABELS: Record<DisposalReason, string> = {
  EXPIRED: "유통기한 만료",
  DAMAGED: "손상·변질",
  CONTAMINATED: "오염",
  OVER_PREPARED: "과조리 잔반",
  OTHER: "기타",
};

const EPS = 1e-6;

const numberFmt = (v: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 }).format(v);

function rowKey(it: DraftItem): string {
  return `${it.itemType}::${it.itemId}::${it.lineupId ?? ""}::${
    it.productionLineId ?? ""
  }`;
}

/**
 * 제안 사용량(공급단위 기준, 반올림된 최종 필요량)을
 * 다시 기본단위로 되돌린 초기 사용량 추천치.
 * 예: theoretical=1350g, factor=1000(1kg=1000g) → rounded=1kg → 1000g
 */
function initialUsedQtyBase(it: DraftItem): number {
  const rounded = it.roundedFinalQty * (it.packagingFactor || 1);
  return Math.min(rounded, it.availableQty);
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export function ConsumptionDraftForm({ draft, targetDate, locationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Layer B 상태 (기존 유지 — D1=β)
  const [layerBItems, setLayerBItems] = useState<LayerBItem[]>([]);

  // Layer A 행 상태 (Smart Row)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const it of draft.layerAItems) {
      const usedInit = initialUsedQtyBase(it);
      const remainInit = Math.max(0, it.availableQty - usedInit);
      init[rowKey(it)] = {
        finalUsedQty: usedInit,
        remainingToStock: remainInit,
        disposalReason: "",
        disposalNote: "",
      };
    }
    return init;
  });

  // ── 파생값 계산 헬퍼 ──
  const derived = (it: DraftItem) => {
    const st = rowStates[rowKey(it)];
    const total = it.availableQty;
    const used = st?.finalUsedQty ?? 0;
    const stock = st?.remainingToStock ?? 0;
    const disposal = Math.max(0, total - used - stock);
    const overflow = used + stock > total + EPS;
    const usedPct = total > EPS ? (used / total) * 100 : 0;
    const stockPct = total > EPS ? (stock / total) * 100 : 0;
    const disposalPct = total > EPS ? (disposal / total) * 100 : 0;
    return {
      state: st,
      total,
      used,
      stock,
      disposal,
      overflow,
      needsReason: disposal > EPS,
      needsNote: st?.disposalReason === "OTHER",
      usedPct,
      stockPct,
      disposalPct,
    };
  };

  // ── 라인업/라인 그룹핑 (표시 순서 유지) ──
  const groupedItems = useMemo(() => {
    // draft.layerAItems 은 이미 서비스에서 정렬됨
    const groups: Array<{
      lineupName: string;
      productionLineName: string;
      items: DraftItem[];
    }> = [];
    let cursor: (typeof groups)[number] | null = null;
    for (const it of draft.layerAItems) {
      const ln = it.lineupName ?? "(라인업 무관)";
      const pl = it.productionLineName ?? "(라인 무관)";
      if (!cursor || cursor.lineupName !== ln || cursor.productionLineName !== pl) {
        cursor = { lineupName: ln, productionLineName: pl, items: [] };
        groups.push(cursor);
      }
      cursor.items.push(it);
    }
    return groups;
  }, [draft.layerAItems]);

  // ── 검증 요약 ──
  const validation = useMemo(() => {
    let overflowCount = 0;
    let reasonMissing = 0;
    let noteMissing = 0;
    for (const it of draft.layerAItems) {
      const d = derived(it);
      if (d.overflow) overflowCount++;
      if (d.needsReason && !d.state?.disposalReason) reasonMissing++;
      if (d.needsNote && !d.state?.disposalNote.trim()) noteMissing++;
    }
    const hasInvalidLayerB = layerBItems.some((it) => it.quantity <= 0);
    return {
      overflowCount,
      reasonMissing,
      noteMissing,
      hasInvalidLayerB,
      canConfirm:
        overflowCount === 0 &&
        reasonMissing === 0 &&
        noteMissing === 0 &&
        !hasInvalidLayerB,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowStates, layerBItems, draft.layerAItems]);

  // ── 행 상태 갱신 ──
  const patchRow = (key: string, patch: Partial<RowState>) => {
    setRowStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  // ── 확정 처리 ──
  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmConsumptionAction({
        targetDate,
        locationId,
        layerAItems: draft.layerAItems.map((it) => {
          const st = rowStates[rowKey(it)];
          return {
            itemType: it.itemType,
            itemId: it.itemId,
            lineupId: it.lineupId,
            productionLineId: it.productionLineId,
            theoreticalQty: it.theoreticalQty,
            totalAvailable: it.availableQty,
            finalUsedQty: st?.finalUsedQty ?? 0,
            remainingToStock: st?.remainingToStock ?? 0,
            disposalReason: st?.disposalReason
              ? (st.disposalReason as DisposalReason)
              : undefined,
            disposalNote: st?.disposalNote?.trim() || undefined,
          };
        }),
        layerBItems: layerBItems.map((b) => ({
          itemType: b.itemType,
          itemId: b.itemId,
          quantity: b.quantity,
          note: b.note,
        })),
      });

      if (!result.success) {
        if (result.error.code === "STALE_DRAFT") {
          toast.error(result.error.message, {
            action: {
              label: "새로고침",
              onClick: () => router.refresh(),
            },
          });
          return;
        }
        toast.error(result.error.message || "사용 처리 확정에 실패했습니다");
        return;
      }

      toast.success(`사용 처리 확정 완료 (${result.data.totalItemCount}건)`);
      router.push("/consumption");
    });
  }

  // ────────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
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

        {/* 검증 배너 */}
        {(validation.overflowCount > 0 ||
          validation.reasonMissing > 0 ||
          validation.noteMissing > 0) && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              {validation.overflowCount > 0 && (
                <div>
                  · 사용량+재고가 총 재고 현황을 초과한 항목:{" "}
                  <strong>{validation.overflowCount}건</strong>
                </div>
              )}
              {validation.reasonMissing > 0 && (
                <div>
                  · 폐기 사유 미지정 항목:{" "}
                  <strong>{validation.reasonMissing}건</strong>
                </div>
              )}
              {validation.noteMissing > 0 && (
                <div>
                  · 폐기 사유 &lsquo;기타&rsquo; 상세 미입력 항목:{" "}
                  <strong>{validation.noteMissing}건</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layer A — Smart Consumption Row */}
        <div className="rounded-md border bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Layer A — 식단 자동 산출 ({draft.layerAItems.length}건)
            </h2>
            <div className="text-xs text-gray-500">
              총 재고 현황 = 잔존 재고 + 당일 입고. 사용량·재고 잔량 입력 시 폐기량 자동 계산
            </div>
          </div>

          <div className="overflow-x-auto rounded border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="w-40">품목</TableHead>
                  <TableHead className="w-28">라인업 / 라인</TableHead>
                  <TableHead className="w-24 text-right">제안 사용량</TableHead>
                  <TableHead className="w-32 text-right">총 재고 현황</TableHead>
                  <TableHead className="w-28 text-right">사용량</TableHead>
                  <TableHead className="w-28 text-right">재고 잔량</TableHead>
                  <TableHead className="w-24 text-right">폐기(자동)</TableHead>
                  <TableHead className="w-44">폐기 사유</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-gray-500">
                      자동 산출된 품목이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {groupedItems.map((group, gIdx) => (
                  <Fragment key={`group-${gIdx}`}>
                    {/* 그룹 헤더 (라인업/라인) */}
                    <TableRow
                      className="bg-blue-50 hover:bg-blue-50"
                    >
                      <TableCell
                        colSpan={9}
                        className="py-1 text-xs font-medium text-blue-900"
                      >
                        {group.lineupName} · {group.productionLineName}
                      </TableCell>
                    </TableRow>
                    {group.items.map((it) => {
                      const key = rowKey(it);
                      const d = derived(it);
                      return (
                        <TableRow
                          key={key}
                          className={
                            d.overflow ? "bg-red-50 hover:bg-red-50" : undefined
                          }
                        >
                          {/* 품목 */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{it.itemName}</span>
                              <span className="font-mono text-xs text-gray-500">
                                {it.itemCode}
                              </span>
                            </div>
                          </TableCell>

                          {/* 라인업/라인 */}
                          <TableCell className="text-xs text-gray-700">
                            <div>{it.lineupName ?? "-"}</div>
                            <div className="text-gray-500">
                              {it.productionLineName ?? "-"}
                            </div>
                          </TableCell>

                          {/* 제안 사용량 */}
                          <TableCell className="text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dotted border-gray-400">
                                  {numberFmt(it.theoreticalQty)} {it.unit}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  BOM × 확정식수 결과 (공급단위 기준)
                                  <br />
                                  공급단위 환산: {numberFmt(it.roundedFinalQty)}{" "}
                                  {it.packagingUnit}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>

                          {/* 총 재고 현황 */}
                          <TableCell className="text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dotted border-gray-400">
                                  {numberFmt(d.total)} {it.unit}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  잔존 재고 + 당일 입고
                                  <br />
                                  당일 입고: {numberFmt(it.inboundQtyOnDate)}{" "}
                                  {it.unit}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            {/* 세그먼트 프로그레스 바 */}
                            <div className="mt-1 flex h-1.5 overflow-hidden rounded bg-gray-200">
                              <div
                                className="bg-emerald-500"
                                style={{ width: `${d.usedPct}%` }}
                                title={`사용 ${d.usedPct.toFixed(0)}%`}
                              />
                              <div
                                className="bg-blue-400"
                                style={{ width: `${d.stockPct}%` }}
                                title={`재고 ${d.stockPct.toFixed(0)}%`}
                              />
                              <div
                                className="bg-red-500"
                                style={{ width: `${d.disposalPct}%` }}
                                title={`폐기 ${d.disposalPct.toFixed(0)}%`}
                              />
                            </div>
                          </TableCell>

                          {/* 사용량 [입력] */}
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              className={`h-8 text-right ${
                                d.overflow ? "border-red-400" : ""
                              }`}
                              value={d.state?.finalUsedQty ?? 0}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                const next = Number.isFinite(raw)
                                  ? Math.max(0, raw)
                                  : 0;
                                // 사용량 변경 시 재고 잔량을 초과분만큼 자동 축소
                                const currentStock = d.state?.remainingToStock ?? 0;
                                const maxStock = Math.max(0, d.total - next);
                                patchRow(key, {
                                  finalUsedQty: next,
                                  remainingToStock: Math.min(currentStock, maxStock),
                                });
                              }}
                            />
                          </TableCell>

                          {/* 재고 잔량 [입력] */}
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              className={`h-8 text-right ${
                                d.overflow ? "border-red-400" : ""
                              }`}
                              value={d.state?.remainingToStock ?? 0}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                const next = Number.isFinite(raw)
                                  ? Math.max(0, raw)
                                  : 0;
                                const maxStock = Math.max(
                                  0,
                                  d.total - (d.state?.finalUsedQty ?? 0),
                                );
                                patchRow(key, {
                                  remainingToStock: Math.min(next, maxStock),
                                });
                              }}
                            />
                          </TableCell>

                          {/* 폐기(자동) */}
                          <TableCell className="text-right">
                            {d.disposal > EPS ? (
                              <Badge variant="destructive" className="font-mono">
                                {numberFmt(d.disposal)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">0</span>
                            )}
                          </TableCell>

                          {/* 폐기 사유 (조건부) */}
                          <TableCell>
                            {d.needsReason ? (
                              <div className="space-y-1">
                                <Select
                                  value={d.state?.disposalReason || undefined}
                                  onValueChange={(v) =>
                                    patchRow(key, {
                                      disposalReason: v as DisposalReason,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    className={`h-8 ${
                                      !d.state?.disposalReason
                                        ? "border-red-400"
                                        : ""
                                    }`}
                                  >
                                    <SelectValue placeholder="사유 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(
                                      Object.keys(
                                        DISPOSAL_REASON_LABELS,
                                      ) as DisposalReason[]
                                    ).map((r) => (
                                      <SelectItem key={r} value={r}>
                                        {DISPOSAL_REASON_LABELS[r]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {d.needsNote && (
                                  <Input
                                    className={`h-8 text-xs ${
                                      !d.state?.disposalNote.trim()
                                        ? "border-red-400"
                                        : ""
                                    }`}
                                    placeholder="상세 사유 입력"
                                    value={d.state?.disposalNote ?? ""}
                                    onChange={(e) =>
                                      patchRow(key, {
                                        disposalNote: e.target.value,
                                      })
                                    }
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Layer B — 수동 추가 (D1=β: quantity 만 입력) */}
        <ConsumptionLayerBEditor
          layerAItems={draft.layerAItems}
          items={layerBItems}
          onChange={setLayerBItems}
        />

        {/* 확정 버튼 */}
        <div className="flex justify-end gap-2">
          <Link href="/consumption">
            <Button variant="outline" disabled={isPending}>
              취소
            </Button>
          </Link>
          <Button
            disabled={isPending || !validation.canConfirm}
            onClick={handleConfirm}
            title={
              !validation.canConfirm
                ? "입력 오류가 있습니다. 상단 배너를 확인해 주세요"
                : undefined
            }
          >
            {isPending ? "확정 중..." : "사용 처리 확정"}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
