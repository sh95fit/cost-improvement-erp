/**
 * D30 Phase 3-D30-Ex1 — 일자별 입고 통합 뷰 서비스
 *
 * 목적:
 *  - "출고일(outboundDate)" 또는 "예상입고일(expectedReceiveDate)" 기준으로
 *    특정 날짜에 처리해야 할 발주(PO)와 관련 입고서(ReceivingNote)를 통합 조회.
 *  - 미확정 상태 PO는 편집 대상(pending), 이미 RECEIVED된 PO는 읽기 전용(completed)으로 분리.
 *  - Bulk draft 저장·Bulk 확정 처리(모두 원자적).
 *
 * 정책 근거:
 *  - Q1: 출고일 기준 통합 (mode="outbound" 기본), expected는 옵션.
 *  - Q2: RECEIVED PO 는 별도 completed 섹션(수정 불가).
 *  - Q3: 기존 DRAFT ReceivingNote 는 자동 병합 → existingDraft 필드로 전달.
 *  - Q4: bulk 확정은 preview(dry-run) → confirm 2단계, 실제 확정은 all-or-nothing.
 *  - P5: 입고 확정=발주 종결. 각 노트 확정은 confirmReceivingNote(단일 tx)를 재사용.
 *  - P9: 단가는 PO 기준 고정. 이 서비스에서는 InventoryLot/Transaction 을 직접 만들지 않는다.
 *
 * 스키마 검증(2026-07-06):
 *  - Supplier에 leadTimeDays 필드 없음 → 사용하지 않음(품목별 리드타임은 SupplierItem에 존재).
 *  - MaterialMaster는 unit / unitCategory 만 있음(baseUnit 없음).
 *  - PurchaseOrder.outboundDate 는 nullable — null 가드 필수.
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
    }>;
  };
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

/** Bulk draft input — 여러 PO 에 대해 한 번에 저장 */
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

/** Bulk confirm preview — 각 노트의 확정 가능 여부 */
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

// ============================================================
// 1) 일자별 통합 조회
// ============================================================

/**
 * 지정된 날짜(date)와 기준(mode)에 해당하는 PO 를 pending / completed 로 분리 반환.
 *
 * pending  : status IN (SUBMITTED, APPROVED) — 편집 대상
 * completed: status = RECEIVED               — 읽기 전용
 * 제외     : DRAFT / CANCELLED
 *
 * mode="outbound"  → PurchaseOrder.outboundDate 기준
 * mode="expected"  → PurchaseOrder.expectedReceiveDate 기준
 */
export async function getDailyReceivingBundle(
  companyId: string,
  date: string,
  mode: DailyReceivingMode = "outbound",
): Promise<DailyReceivingBundle> {
  const range = toDateRange(date);
  const dateField: "outboundDate" | "expectedReceiveDate" =
    mode === "outbound" ? "outboundDate" : "expectedReceiveDate";

  // --- Pending PO 조회 ---
  const pendingPOs = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      status: { in: [POStatus.SUBMITTED, POStatus.APPROVED] },
      [dateField]: range,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      productionLine: { select: { id: true, name: true } },
      items: {
        include: {
          materialMaster: { select: { id: true, name: true, unit: true } },
          subsidiaryMaster: { select: { id: true, name: true, unit: true } },
        },
      },
      // 최신 ReceivingNote(DRAFT) 를 하나만 로드 (Q3 자동 병합)
      receivingNotes: {
        where: { status: ReceivingNoteStatus.DRAFT },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { items: true },
      },
    },
    orderBy: [{ [dateField]: "asc" }, { orderNumber: "asc" }],
  });

  const pending: DailyPendingPO[] = pendingPOs.map((po) => {
    const draft = po.receivingNotes[0] ?? null;

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
        items: po.items.map((it) => ({
          purchaseOrderItemId: it.id,
          itemType: it.itemType,
          materialMasterId: it.materialMasterId ?? null,
          subsidiaryMasterId: it.subsidiaryMasterId ?? null,
          itemName:
            it.materialMaster?.name ??
            it.subsidiaryMaster?.name ??
            "(품목 없음)",
          unit:
            it.materialMaster?.unit ??
            it.subsidiaryMaster?.unit ??
            "",
          orderedQty: it.quantity,
          receivedQty: it.receivedQty,
          unitPrice: Number(it.unitPrice),
        })),
      },
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

  // --- Completed PO 조회 (RECEIVED, 같은 날짜 기준) ---
  const completedPOs = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      status: POStatus.RECEIVED,
      [dateField]: range,
    },
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
      items: { select: { quantity: true, unitPrice: true } },
      receivingNotes: {
        where: { status: ReceivingNoteStatus.CONFIRMED },
        orderBy: { confirmedAt: "desc" },
        take: 1,
        select: {
          id: true,
          receiveNumber: true,
          confirmedAt: true,
        },
      },
    },
    orderBy: [{ [dateField]: "asc" }, { orderNumber: "asc" }],
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
// 2) Bulk Draft 저장 (Upsert)
// ============================================================

/**
 * 여러 PO 에 대해 ReceivingNote(DRAFT) 를 한꺼번에 생성/갱신.
 *  - 각 PO 당 DRAFT 1건만 유지 (기존 DRAFT 있으면 items 를 replace)
 *  - 단일 트랜잭션. 하나라도 실패하면 전체 롤백.
 *
 * 반환: 저장된 (혹은 갱신된) ReceivingNote id 목록.
 */
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
      // PO 소속 검증
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

      // 기존 DRAFT 조회
      const existing = await tx.receivingNote.findFirst({
        where: {
          purchaseOrderId: po.id,
          status: ReceivingNoteStatus.DRAFT,
        },
        select: { id: true },
      });

      if (existing) {
        // items 를 delete-and-recreate (부분 병합보다 명확)
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
        // 신규 생성 — receiveNumber 는 별도 시퀀스 규칙이 있다면 그것으로,
        // 여기서는 timestamp-based fallback 사용 (기존 규칙과 통일 필요 시 조정).
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
// 3) Bulk Confirm — Preview (Dry-run)
// ============================================================

/**
 * 벌크 확정 전 검증. 실제 확정은 하지 않는다.
 * 각 note 에 대해 확정 가능 여부 + 사유를 반환.
 */
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

  // 존재하지 않는 ID
  for (const id of receivingNoteIds) {
    if (!foundIds.has(id)) {
      rows.push({
        receivingNoteId: id,
        canConfirm: false,
        blockingReason: "입고서를 찾을 수 없습니다",
      });
    }
  }

  // 실제 검증
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
    } else {
      // 부자재 항목 사전 감지 (Phase 10 이전이므로 unsupported)
      const hasSubsidiary = note.items.some(
        (it) => it.purchaseOrderItemId == null,
      );
      // 상세 감지는 confirmReceivingNote 내부에서 수행하지만,
      // 여기서는 최소 필수 필드만 확인.
      if (hasSubsidiary) {
        // items 자체가 PO 매핑 안 된 것 — 정보성 경고
        // (실제로 SUBSIDIARY 판별은 PO item 조회 필요 — 실행 단계에서 최종 확인)
      }
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
// 4) Bulk Confirm — 실행 (All-or-Nothing)
// ============================================================

/**
 * 여러 입고서를 한 트랜잭션 안에서 순차적으로 확정.
 * 어느 하나라도 실패하면 전체 롤백.
 *
 * discrepancyReasonsMap: noteId 별로 { key → reason } 형태의 사유 맵.
 *   key 규약은 buildDiscrepancyKey() 기준 (기존 confirm 서비스와 동일).
 */
export async function bulkConfirmReceivingNotes(
  companyId: string,
  receivingNoteIds: string[],
  actorUserId: string,
  options?: {
    /** noteId → { key → reason } */
    discrepancyReasonsMap?: Record<string, Record<string, string>>;
    /** noteId → 통일 사유 */
    unifiedReasonMap?: Record<string, string>;
    /** noteId → note(메모) */
    noteMap?: Record<string, string>;
  },
): Promise<Array<{ receivingNoteId: string; status: "CONFIRMED" }>> {
  if (receivingNoteIds.length === 0) return [];

  // 1) 사전 검증 (트랜잭션 밖에서 한번 더 걸러줌 — 실패시 tx 진입 자체를 안 함)
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

  // 2) 단일 트랜잭션에서 순차 확정
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
        // 알려진 도메인 에러는 그대로 포장해 상위로 전달 — tx 는 자동 롤백
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
