/**
 * D30 Phase 3-D30-Ex1 — 일자별 입고 통합 뷰 서비스
 *
 * 목적:
 *  - "출고일(outboundDate)" 또는 "예상입고일" 기준으로 특정 날짜에 처리해야 할
 *    발주(PO)와 관련 입고서(ReceivingNote)를 통합 조회.
 *  - 미확정 상태 PO는 편집 대상(pending), 이미 RECEIVED된 PO는 읽기 전용(completed).
 *  - Bulk draft 저장·Bulk 확정 처리(모두 원자적).
 *
 * 정책 근거:
 *  - Q1: 출고일 기준 통합 (mode="outbound" 기본), expected 는 옵션.
 *  - Q2: RECEIVED PO 는 별도 completed 섹션(수정 불가).
 *  - Q3: 기존 DRAFT ReceivingNote 는 자동 병합 → existingDraft 필드로 전달.
 *  - Q4: bulk 확정은 preview(dry-run) → confirm 2단계, all-or-nothing.
 *
 * 정정 (2026-07-06, 사용자 검수):
 *  - D15-3: "예상입고일" 은 발주서 헤더 값이 아니라 품목별 런타임 파생값
 *           itemExpectedReceiveDate = outboundDate - supplierItem.leadTimeDays.
 *           (outboundDate 는 실제 사용일=엔드라인, 예상입고일은 그 이전)
 *  - expected 모드는 "선택 날짜에 예상 도착 품목이 하나라도 있는 PO" 를 찾고,
 *    해당 품목 id 목록을 itemsMatchingDate 로 반환한다.
 */

import type { Prisma } from "@prisma/client";
import { POStatus, ReceivingNoteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import {
  confirmReceivingNote,
  ReceivingNoteAlreadyConfirmedError,
  ReceivingNoteCompanyMismatchError,
  ReceivingNoteNotFoundError,
  UnsupportedSubsidiaryReceivingError,
} from "./receiving-note.service";

// ============================================================
// 상수
// ============================================================

/**
 * expected 모드에서 후보 PO 를 얼마나 미래까지 살펴볼지.
 * outboundDate 는 선택 날짜보다 최대 이 값만큼 이후일 수 있다.
 * (품목 최대 leadTimeDays 를 넉넉히 커버하는 값)
 */
const MAX_LEAD_TIME_DAYS_WINDOW = 30;

// ============================================================
// 타입 정의
// ============================================================

export type DailyReceivingMode = "outbound" | "expected";

/** PO 편집 대상(pending) — 아직 입고 확정 전 */
export type DailyPendingPO = {
  purchaseOrder: {
    id: string;
    orderNumber: string;
    status: POStatus;
    outboundDate: Date | null;
    expectedReceiveDate: Date | null;
    supplierId: string;
    supplierName: string;
    locationId: string;
    locationName: string;
    productionLineId: string | null;
    productionLineName: string | null;
    note: string | null;
    items: Array<{
      purchaseOrderItemId: string;
      itemType: "MATERIAL" | "SUBSIDIARY";
      materialMasterId: string | null;
      subsidiaryMasterId: string | null;
      itemName: string;
      unit: string;
      orderedQty: number;
      receivedQty: number;
      unitPrice: number;
      /** 품목별 리드타임 (SupplierItem.leadTimeDays), 미정 시 1 */
      leadTimeDays: number;
      /** 품목별 예상입고일 = outboundDate - leadTimeDays (null if outboundDate null) */
      itemExpectedReceiveDate: Date | null;
    }>;
  };
  /**
   * expected 모드에서 선택 날짜에 도착 예정인 PO item id 목록.
   * outbound 모드에서는 빈 배열 반환.
   */
  itemsMatchingDate: string[];
  /** 기존 DRAFT 입고서(있으면 자동 병합용) */
  existingDraft: {
    receivingNoteId: string;
    receiveNumber: string;
    receivedDate: Date;
    note: string | null;
    items: Array<{
      receivingNoteItemId: string;
      purchaseOrderItemId: string | null;
      receivedQty: number;
      unitPrice: number;
    }>;
  } | null;
};

/** RECEIVED PO — 읽기 전용 */
export type DailyCompletedPO = {
  purchaseOrderId: string;
  orderNumber: string;
  supplierName: string;
  locationName: string;
  receivingNoteId: string | null;
  receiveNumber: string | null;
  confirmedAt: Date | null;
  itemCount: number;
  totalAmount: number;
};

export type DailyReceivingBundle = {
  date: string; // YYYY-MM-DD
  mode: DailyReceivingMode;
  pending: DailyPendingPO[];
  completed: DailyCompletedPO[];
};

export type BulkDraftInput = {
  purchaseOrderId: string;
  receivedDate: Date;
  note?: string | null;
  items: Array<{
    purchaseOrderItemId: string;
    receivedQty: number;
    unitPrice: number;
  }>;
};

export type BulkConfirmPreviewRow = {
  receivingNoteId: string;
  canConfirm: boolean;
  blockingReason: string | null;
};

// ============================================================
// 커스텀 에러
// ============================================================

export class BulkConfirmValidationError extends Error {
  constructor(
    public readonly failures: Array<{
      receivingNoteId: string;
      reason: string;
    }>,
  ) {
    super(
      `Bulk confirm blocked by ${failures.length} note(s). See failures[].`,
    );
    this.name = "BulkConfirmValidationError";
  }
}

export class BulkConfirmExecutionError extends Error {
  constructor(
    public readonly failedNoteId: string,
    public readonly cause: unknown,
  ) {
    super(
      `Bulk confirm failed at note ${failedNoteId}. Transaction rolled back.`,
    );
    this.name = "BulkConfirmExecutionError";
  }
}

// ============================================================
// 유틸
// ============================================================

/** date-only 를 UTC 자정 범위로 확장 (Prisma DateTime 필터용) */
function toDateRange(dateStr: string): { gte: Date; lt: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const lt = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { gte, lt };
}

/** UTC 자정 Date - n일 */
function shiftDaysUTC(base: Date, deltaDays: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d;
}

/**
 * 두 Date 가 같은 "달력 날짜" 인지 판정 (UTC 기준).
 * outboundDate 는 DATE 타입이라 항상 UTC 자정으로 저장됨.
 */
function isSameUTCDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// ============================================================
// 1) 일자별 통합 조회
// ============================================================

export async function getDailyReceivingBundle(
  companyId: string,
  date: string,
  mode: DailyReceivingMode = "outbound",
): Promise<DailyReceivingBundle> {
  const range = toDateRange(date);
  const selectedUTC = range.gte; // 선택 날짜의 UTC 자정

  // --- Pending PO 조회 조건 (mode 별) ---
  //   outbound  : outboundDate = 선택일
  //   expected  : outboundDate ∈ [선택일, 선택일 + MAX_LEAD_TIME_DAYS_WINDOW]
  //               (품목 예상입고일 = outboundDate - leadTimeDays 이므로
  //                선택일에 도착 예정이려면 outboundDate 는 선택일 이후이어야 함)
  const outboundFilter: Prisma.DateTimeFilter =
    mode === "outbound"
      ? { gte: range.gte, lt: range.lt }
      : {
          gte: range.gte,                                             // 선택일 당일 포함
          lte: shiftDaysUTC(range.gte, MAX_LEAD_TIME_DAYS_WINDOW),    // ← 미래로 창 확장
        };

  const pendingPOs = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      status: { in: [POStatus.SUBMITTED, POStatus.APPROVED] },
      outboundDate: outboundFilter,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      productionLine: { select: { id: true, name: true } },
      items: {
        include: {
          supplierItem: { select: { id: true, leadTimeDays: true } },
          materialMaster: { select: { id: true, name: true, unit: true } },
          subsidiaryMaster: { select: { id: true, name: true, unit: true } },
        },
      },
      receivingNotes: {
        where: { status: ReceivingNoteStatus.DRAFT },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { items: true },
      },
    },
    orderBy: [{ outboundDate: "asc" }, { orderNumber: "asc" }],
  });

  // 각 PO 를 DailyPendingPO 로 매핑하면서 품목별 예상입고일 파생
  const mappedAll: DailyPendingPO[] = pendingPOs.map((po) => {
    const draft = po.receivingNotes[0] ?? null;

    const items = po.items.map((it) => {
      const leadTimeDays = it.supplierItem?.leadTimeDays ?? 1; // D15-5 default 1
      let itemExpectedReceiveDate: Date | null = null;
      if (po.outboundDate) {
        itemExpectedReceiveDate = shiftDaysUTC(po.outboundDate, -leadTimeDays);
      }
      return {
        purchaseOrderItemId: it.id,
        itemType: it.itemType,
        materialMasterId: it.materialMasterId ?? null,
        subsidiaryMasterId: it.subsidiaryMasterId ?? null,
        itemName:
          it.materialMaster?.name ??
          it.subsidiaryMaster?.name ??
          "(품목 없음)",
        unit:
          it.materialMaster?.unit ?? it.subsidiaryMaster?.unit ?? "",
        orderedQty: it.quantity,
        receivedQty: it.receivedQty,
        unitPrice: Number(it.unitPrice),
        leadTimeDays,
        itemExpectedReceiveDate,
      };
    });

    // expected 모드일 때만 선택일에 도착 예정인 item 필터
    let itemsMatchingDate: string[] = [];
    if (mode === "expected") {
      itemsMatchingDate = items
        .filter(
          (it) =>
            it.itemExpectedReceiveDate != null &&
            isSameUTCDate(it.itemExpectedReceiveDate, selectedUTC),
        )
        .map((it) => it.purchaseOrderItemId);
    }

    return {
      purchaseOrder: {
        id: po.id,
        orderNumber: po.orderNumber,
        status: po.status,
        outboundDate: po.outboundDate,
        expectedReceiveDate: po.expectedReceiveDate,
        supplierId: po.supplierId,
        supplierName: po.supplier?.name ?? "(공급처 없음)",
        locationId: po.locationId,
        locationName: po.location?.name ?? "(창고 없음)",
        productionLineId: po.productionLineId ?? null,
        productionLineName: po.productionLine?.name ?? null,
        note: po.note ?? null,
        items,
      },
      itemsMatchingDate,
      existingDraft: draft
        ? {
            receivingNoteId: draft.id,
            receiveNumber: draft.receiveNumber,
            receivedDate: draft.receivedDate,
            note: draft.note ?? null,
            items: draft.items.map((rit) => ({
              receivingNoteItemId: rit.id,
              purchaseOrderItemId: rit.purchaseOrderItemId ?? null,
              receivedQty: rit.receivedQty,
              unitPrice: Number(rit.unitPrice),
            })),
          }
        : null,
    };
  });

  // expected 모드: 매칭 item 이 하나도 없는 PO 는 제외
  const pending: DailyPendingPO[] =
    mode === "expected"
      ? mappedAll.filter((p) => p.itemsMatchingDate.length > 0)
      : mappedAll;

  // --- Completed PO 조회 ---
  //   현재 정책상 completed 는 outboundDate = 선택일 기준으로 유지.
  //   (expected 모드에서의 completed 재정의는 향후 사용자 정책 확정 시 반영)
  const completedPOs = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      status: POStatus.RECEIVED,
      outboundDate: { gte: range.gte, lt: range.lt },
    },
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
      items: { select: { quantity: true, unitPrice: true } },
      receivingNotes: {
        where: { status: ReceivingNoteStatus.CONFIRMED },
        orderBy: { confirmedAt: "desc" },
        take: 1,
        select: { id: true, receiveNumber: true, confirmedAt: true },
      },
    },
    orderBy: [{ outboundDate: "asc" }, { orderNumber: "asc" }],
  });

  const completed: DailyCompletedPO[] = completedPOs.map((po) => {
    const confirmedNote = po.receivingNotes[0] ?? null;
    const totalAmount = po.items.reduce(
      (sum, it) => sum + it.quantity * Number(it.unitPrice),
      0,
    );
    return {
      purchaseOrderId: po.id,
      orderNumber: po.orderNumber,
      supplierName: po.supplier?.name ?? "(공급처 없음)",
      locationName: po.location?.name ?? "(창고 없음)",
      receivingNoteId: confirmedNote?.id ?? null,
      receiveNumber: confirmedNote?.receiveNumber ?? null,
      confirmedAt: confirmedNote?.confirmedAt ?? null,
      itemCount: po.items.length,
      totalAmount,
    };
  });

  return { date, mode, pending, completed };
}

// ============================================================
// 2) Bulk Draft 저장 (기존 로직 유지)
// ============================================================

export async function bulkCreateOrUpdateReceivingNoteDrafts(
  companyId: string,
  inputs: BulkDraftInput[],
  actorUserId: string,
): Promise<Array<{ purchaseOrderId: string; receivingNoteId: string }>> {
  if (inputs.length === 0) return [];

  return withTransaction(async (tx) => {
    const results: Array<{
      purchaseOrderId: string;
      receivingNoteId: string;
    }> = [];

    for (const input of inputs) {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        select: { id: true, companyId: true, status: true },
      });
      if (!po || po.companyId !== companyId) {
        throw new Error(
          `PurchaseOrder ${input.purchaseOrderId} 가 해당 회사에 속하지 않음`,
        );
      }
      if (
        po.status !== POStatus.SUBMITTED &&
        po.status !== POStatus.APPROVED
      ) {
        throw new Error(
          `PurchaseOrder ${po.id} 상태(${po.status})는 입고서 작성 불가`,
        );
      }

      const existing = await tx.receivingNote.findFirst({
        where: {
          purchaseOrderId: po.id,
          status: ReceivingNoteStatus.DRAFT,
        },
        select: { id: true },
      });

      if (existing) {
        await tx.receivingNoteItem.deleteMany({
          where: { receivingNoteId: existing.id },
        });
        const updated = await tx.receivingNote.update({
          where: { id: existing.id },
          data: {
            receivedDate: input.receivedDate,
            note: input.note ?? null,
            items: {
              create: input.items.map((it) => ({
                purchaseOrderItemId: it.purchaseOrderItemId,
                receivedQty: it.receivedQty,
                unitPrice: it.unitPrice,
              })),
            },
          },
          select: { id: true },
        });
        results.push({
          purchaseOrderId: po.id,
          receivingNoteId: updated.id,
        });
      } else {
        const receiveNumber = `RN-${Date.now()}-${po.id.slice(-6)}`;
        const created = await tx.receivingNote.create({
          data: {
            companyId,
            purchaseOrderId: po.id,
            receiveNumber,
            receivedDate: input.receivedDate,
            status: ReceivingNoteStatus.DRAFT,
            note: input.note ?? null,
            items: {
              create: input.items.map((it) => ({
                purchaseOrderItemId: it.purchaseOrderItemId,
                receivedQty: it.receivedQty,
                unitPrice: it.unitPrice,
              })),
            },
          },
          select: { id: true },
        });
        results.push({
          purchaseOrderId: po.id,
          receivingNoteId: created.id,
        });
      }
    }

    return results;
  });
}

// ============================================================
// 3) Bulk Confirm Preview (기존 유지)
// ============================================================

export async function previewBulkConfirmReceivingNotes(
  companyId: string,
  receivingNoteIds: string[],
): Promise<BulkConfirmPreviewRow[]> {
  if (receivingNoteIds.length === 0) return [];

  const notes = await prisma.receivingNote.findMany({
    where: { id: { in: receivingNoteIds } },
    include: {
      items: true,
      purchaseOrder: { select: { id: true, status: true, companyId: true } },
    },
  });

  const foundIds = new Set(notes.map((n) => n.id));
  const rows: BulkConfirmPreviewRow[] = [];

  for (const id of receivingNoteIds) {
    if (!foundIds.has(id)) {
      rows.push({
        receivingNoteId: id,
        canConfirm: false,
        blockingReason: "입고서를 찾을 수 없습니다",
      });
    }
  }

  for (const note of notes) {
    let reason: string | null = null;

    if (note.companyId !== companyId) {
      reason = "다른 회사 소속의 입고서입니다";
    } else if (note.status === ReceivingNoteStatus.CONFIRMED) {
      reason = "이미 확정된 입고서입니다";
    } else if (note.items.length === 0) {
      reason = "품목이 하나도 없는 입고서입니다";
    } else if (
      note.purchaseOrder.status !== POStatus.SUBMITTED &&
      note.purchaseOrder.status !== POStatus.APPROVED
    ) {
      reason = `발주 상태(${note.purchaseOrder.status})는 확정 대상이 아닙니다`;
    }

    rows.push({
      receivingNoteId: note.id,
      canConfirm: reason === null,
      blockingReason: reason,
    });
  }

  return rows;
}

// ============================================================
// 4) Bulk Confirm 실행 (기존 유지)
// ============================================================

export async function bulkConfirmReceivingNotes(
  companyId: string,
  receivingNoteIds: string[],
  actorUserId: string,
  options?: {
    discrepancyReasonsMap?: Record<string, Record<string, string>>;
    unifiedReasonMap?: Record<string, string>;
    noteMap?: Record<string, string>;
  },
): Promise<Array<{ receivingNoteId: string; status: "CONFIRMED" }>> {
  if (receivingNoteIds.length === 0) return [];

  const preview = await previewBulkConfirmReceivingNotes(
    companyId,
    receivingNoteIds,
  );
  const blockers = preview.filter((r) => !r.canConfirm);
  if (blockers.length > 0) {
    throw new BulkConfirmValidationError(
      blockers.map((b) => ({
        receivingNoteId: b.receivingNoteId,
        reason: b.blockingReason ?? "확정 불가",
      })),
    );
  }

  return withTransaction(async (tx: Prisma.TransactionClient) => {
    const results: Array<{ receivingNoteId: string; status: "CONFIRMED" }> =
      [];

    for (const noteId of receivingNoteIds) {
      try {
        await confirmReceivingNote(companyId, noteId, actorUserId, {
          existingTx: tx,
          discrepancyReasons: options?.discrepancyReasonsMap?.[noteId],
          discrepancyReason: options?.unifiedReasonMap?.[noteId],
          note: options?.noteMap?.[noteId],
        });
        results.push({ receivingNoteId: noteId, status: "CONFIRMED" });
      } catch (err) {
        if (
          err instanceof ReceivingNoteNotFoundError ||
          err instanceof ReceivingNoteAlreadyConfirmedError ||
          err instanceof ReceivingNoteCompanyMismatchError ||
          err instanceof UnsupportedSubsidiaryReceivingError
        ) {
          throw new BulkConfirmExecutionError(noteId, err);
        }
        throw new BulkConfirmExecutionError(noteId, err);
      }
    }

    return results;
  });
}
