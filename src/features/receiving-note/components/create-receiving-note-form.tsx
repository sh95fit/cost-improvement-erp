"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { getPurchaseOrderByIdAction } from "@/features/purchase-order/actions/purchase-order.action";
import { createReceivingNoteDraftAction } from "../actions/create-receiving-note-draft.action";
import { updateReceivingNoteDraftAction } from "../actions/update-receiving-note-draft.action";

type POData = NonNullable<
  Extract<
    Awaited<ReturnType<typeof getPurchaseOrderByIdAction>>,
    { success: true }
  >["data"]
>;

type LineDraft = {
  purchaseOrderItemId: string;
  receivedQty: string;
  unitPrice: string;
};

type CreateProps = {
  mode?: "create";
  po: POData;
};

type EditProps = {
  mode: "edit";
  po: POData;
  receivingNoteId: string;
  initialReceivedDate: string; // YYYY-MM-DD
  initialNote: string;
  initialLines: Array<{
    purchaseOrderItemId: string;
    receivedQty: number;
    unitPrice: number;
  }>;
};

type Props = CreateProps | EditProps;

const formatCurrency = (v: number | null | undefined) =>
  v == null
    ? "-"
    : new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0,
      }).format(v);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function CreateReceivingNoteForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  // 초기 라인 계산: edit 이면 initialLines 우선, create 는 PO items 복사
  const buildInitialLines = (): LineDraft[] => {
    if (isEdit) {
      // initialLines 를 purchaseOrderItemId 기준으로 map, PO items 순서에 맞춤
      const byPoItemId = new Map(
        props.initialLines.map((l) => [l.purchaseOrderItemId, l]),
      );
      return props.po.items.map((it) => {
        const l = byPoItemId.get(it.id);
        return {
          purchaseOrderItemId: it.id,
          receivedQty: l ? String(l.receivedQty) : String(it.quantity),
          unitPrice: l ? String(l.unitPrice) : String(it.unitPrice),
        };
      });
    }
    return props.po.items.map((it) => ({
      purchaseOrderItemId: it.id,
      receivedQty: String(it.quantity),
      unitPrice: String(it.unitPrice),
    }));
  };

  const [lines, setLines] = useState<LineDraft[]>(buildInitialLines);
  const [receivedDate, setReceivedDate] = useState<string>(
    isEdit ? props.initialReceivedDate : todayISO(),
  );
  const [note, setNote] = useState<string>(isEdit ? props.initialNote : "");
  const [submitting, setSubmitting] = useState(false);

  // PO 가 바뀌면 재초기화 (create 모드 안전장치)
  useEffect(() => {
    setLines(buildInitialLines());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.po.id]);

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handleSubmit = async () => {
    if (!receivedDate) {
      toast.error("입고일을 입력하세요");
      return;
    }
    for (const l of lines) {
      const q = Number(l.receivedQty);
      const p = Number(l.unitPrice);
      if (!Number.isFinite(q) || q < 0) {
        toast.error("수량은 0 이상 숫자여야 합니다");
        return;
      }
      if (!Number.isFinite(p) || p < 0) {
        toast.error("단가는 0 이상 숫자여야 합니다");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const res = await updateReceivingNoteDraftAction({
          receivingNoteId: props.receivingNoteId,
          receivedDate: new Date(receivedDate),
          items: lines.map((l) => ({
            purchaseOrderItemId: l.purchaseOrderItemId,
            receivedQty: Number(l.receivedQty),
            unitPrice: Number(l.unitPrice),
          })),
          note: note.trim() || undefined,
        });
        if (!res.success) {
          toast.error(res.error.message);
          return;
        }
        toast.success(`${res.data.receiveNumber} 수정 완료`);
        router.push(`/receiving/notes/${res.data.id}`);
        router.refresh();
      } else {
        const res = await createReceivingNoteDraftAction({
          purchaseOrderId: props.po.id,
          receivedDate: new Date(receivedDate),
          items: lines.map((l) => ({
            purchaseOrderItemId: l.purchaseOrderItemId,
            receivedQty: Number(l.receivedQty),
            unitPrice: Number(l.unitPrice),
          })),
          note: note.trim() || undefined,
        });
        if (!res.success) {
          toast.error(res.error.message);
          return;
        }
        toast.success(`${res.data.receiveNumber} 초안 생성 완료`);
        router.push(`/receiving/notes/${res.data.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PO 요약 */}
      <div className="rounded-md border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">발주 정보</h2>
          <Link
            href={`/purchase-orders/${props.po.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            발주서 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Meta label="발주번호" value={props.po.orderNumber} />
          <Meta label="공급업체" value={props.po.supplier?.name ?? "-"} />
          <Meta label="공장" value={props.po.location?.name ?? "-"} />
          <Meta label="품목 수" value={`${props.po.items.length}건`} />
        </div>
      </div>

      {/* 입고 기본 정보 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="receivedDate">
            입고일 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="receivedDate"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">비고 (선택)</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="입고 관련 메모 (최대 500자)"
            maxLength={500}
          />
        </div>
      </div>

      {/* 품목 편집 */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">입고 품목</h2>
        <p className="mb-2 text-xs text-gray-500">
          {isEdit
            ? "수량·단가를 수정하면 확정 시 자동으로 불일치 이력이 기록됩니다. PO 품목 자체는 변경할 수 없습니다."
            : "초기값은 발주 품목과 동일합니다. 수량·단가에 차이가 있으면 확정 시 자동으로 불일치 이력이 기록됩니다."}
        </p>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목</TableHead>
                <TableHead className="text-right">발주 수량</TableHead>
                <TableHead className="w-[140px]">입고 수량</TableHead>
                <TableHead className="text-right">발주 단가</TableHead>
                <TableHead className="w-[160px]">입고 단가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.po.items.map((it, idx) => {
                const line = lines[idx];
                const name =
                  it.materialMaster?.name ??
                  it.subsidiaryMaster?.name ??
                  "-";
                const code =
                  it.materialMaster?.code ??
                  it.subsidiaryMaster?.code ??
                  "";
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-gray-500">
                        {code}
                        {it.supplierItem?.productName && (
                          <> · {it.supplierItem.productName}</>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {Number(it.quantity).toLocaleString("ko-KR")}
                      {it.supplierItem?.supplyUnit?.code && (
                        <span className="ml-1 text-xs">
                          {it.supplierItem.supplyUnit.code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line?.receivedQty ?? ""}
                        onChange={(e) =>
                          updateLine(idx, { receivedQty: e.target.value })
                        }
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {formatCurrency(Number(it.unitPrice))}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={line?.unitPrice ?? ""}
                        onChange={(e) =>
                          updateLine(idx, { unitPrice: e.target.value })
                        }
                        className="text-right"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting
            ? isEdit
              ? "저장 중..."
              : "생성 중..."
            : isEdit
              ? "저장"
              : "초안 생성"}
        </Button>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
    </div>
  );
}
