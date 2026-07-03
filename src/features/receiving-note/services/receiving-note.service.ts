import type { Prisma } from "@prisma/client";
import { DiscrepancyType, TransactionType } from "@prisma/client";
import { buildDiscrepancyKey } from "../lib/discrepancy-key";

import { withTransaction } from "@/lib/auth/transaction";
import { transitionPurchaseOrderStatus } from "@/features/purchase-order/services/purchase-order.service";

type Tx = Prisma.TransactionClient;

export class ReceivingNoteNotFoundError extends Error {
  constructor(id: string) {
    super(`ReceivingNote not found: ${id}`);
    this.name = "ReceivingNoteNotFoundError";
  }
}

export class ReceivingNoteAlreadyConfirmedError extends Error {
  constructor(id: string) {
    super(`ReceivingNote already confirmed: ${id}`);
    this.name = "ReceivingNoteAlreadyConfirmedError";
  }
}

export class ReceivingNoteCompanyMismatchError extends Error {
  constructor() {
    super("ReceivingNote does not belong to the given company");
    this.name = "ReceivingNoteCompanyMismatchError";
  }
}

export class UnsupportedSubsidiaryReceivingError extends Error {
  constructor(poItemId: string) {
    super(
      `Subsidiary 입고 트랜잭션은 현재 스키마에서 지원하지 않음 (Sprint 4 Phase 10에서 보강 예정). poItemId=${poItemId}`,
    );
    this.name = "UnsupportedSubsidiaryReceivingError";
  }
}

/**
 * D30 (2026-06-30): 입고 확정
 *
 * 단일 트랜잭션 안에서:
 *  1) ReceivingNote.status → CONFIRMED, confirmedAt/confirmedByUserId 기록
 *  2) 각 ReceivingNoteItem 당:
 *     - InventoryLot 생성 (unitPrice = PO 단가, P9: 단가 변경 금지)
 *     - InventoryTransaction(PURCHASE) 기록
 *     - PurchaseOrderItem.receivedQty 누적
 *     - 발주↔입고 불일치 시 ReceivingDiscrepancy 스냅샷
 *  3) 발주서에 매칭되지 않은 입고 항목/누락 항목 → ITEM_MISSING 스냅샷
 *  4) PurchaseOrder.status → RECEIVED (같은 tx 주입)
 *
 * 원자성: 어느 단계라도 실패 시 전체 롤백.
 *
 * 제약 (현 스키마 기준):
 *  - InventoryTransaction.materialMasterId 가 NOT NULL 이고 subsidiaryMasterId 컬럼이 없음
 *  - 따라서 SUBSIDIARY 항목 입고 확정은 Sprint 4 Phase 10 스키마 보강 후 지원
 *  - 현재는 SUBSIDIARY 발견 시 UnsupportedSubsidiaryReceivingError throw
 *
 * 용어 주의:
 *  - ReceivingNoteItem 의 "입고 수량" 컬럼은 `receivedQty`
 *  - PurchaseOrderItem 의 "발주 수량"은 `quantity`, "누적 입고 수량"은 `receivedQty`
 */
export async function confirmReceivingNote(
  companyId: string,
  receivingNoteId: string,
  actorUserId: string,
  options?: {
    existingTx?: Tx;
    /**
     * ★ D30 C-3-d3: 품목·유형별 사유 map (key → reason).
     * key 는 buildDiscrepancyKey() 로 생성. 최우선 순위로 저장됨.
     */
    discrepancyReasons?: Record<string, string>;
    /**
     * ★ D30 C-3-d2: 통일 사유 (map 미지정 항목에 대한 폴백).
     */
    discrepancyReason?: string;
    /** ★ D30 C-3-d2: 입고서 자체 메모 (ReceivingNote.note 갱신) */
    note?: string;
  },
) {
  return withTransaction(   
    async (tx) => {
      // 1) 입고서 로드 + 검증
      const note = await tx.receivingNote.findUnique({
        where: { id: receivingNoteId },
        include: {
          items: true,
          purchaseOrder: {
            include: { items: true },
          },
        },
      });

      // ★ D30 C-3-d3: 사유 해결 우선순위
      //   1) 품목·유형별 사유 (discrepancyReasons[key])
      //   2) 통일 사유 (discrepancyReason)
      //   3) 자동 사유 (호출부에서 넘긴 autoReason)
      const perKeyReason = options?.discrepancyReasons ?? {};
      const unifiedReason = options?.discrepancyReason?.trim() || null;
      const resolveReason = (
        key: string,
        autoReason: string | null,
      ): string | null => {
        const perKey = perKeyReason[key]?.trim();
        if (perKey) return perKey;
        if (unifiedReason) return unifiedReason;
        return autoReason;
      };

      if (!note) {
        throw new ReceivingNoteNotFoundError(receivingNoteId);
      }
      if (note.companyId !== companyId) {
        throw new ReceivingNoteCompanyMismatchError();
      }
      if (note.status === "CONFIRMED") {
        throw new ReceivingNoteAlreadyConfirmedError(receivingNoteId);
      }

      const po = note.purchaseOrder;
      const poItemById = new Map(po.items.map((i) => [i.id, i]));
      const matchedPoItemIds = new Set<string>();

      // 2) 각 입고 항목 처리
      for (const rItem of note.items) {
        const receivedQty = rItem.receivedQty;

        const poItem = rItem.purchaseOrderItemId
          ? poItemById.get(rItem.purchaseOrderItemId)
          : undefined;

        if (!poItem) {
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type: DiscrepancyType.ITEM_MISSING,
              expectedQty: null,
              actualQty: receivedQty,
              expectedUnitPrice: null,
              actualUnitPrice: rItem.unitPrice,
              diffValue: receivedQty,
              reason: resolveReason(
                buildDiscrepancyKey(DiscrepancyType.ITEM_MISSING, null, rItem.id),
                "발주에 없는 항목이 입고됨",
              ),
              recordedByUserId: actorUserId,
            },
          });
          continue;
        }

        matchedPoItemIds.add(poItem.id);

        // 부자재는 현 스키마에서 InventoryTransaction 기록 불가 → 차단
        if (poItem.itemType === "SUBSIDIARY") {
          throw new UnsupportedSubsidiaryReceivingError(poItem.id);
        }
        // MATERIAL 필수 검증
        if (!poItem.materialMasterId) {
          throw new Error(
            `PurchaseOrderItem ${poItem.id}: MATERIAL 이지만 materialMasterId 가 없음`,
          );
        }

        // 2-1) InventoryLot 생성 (P9: 단가는 PO 단가 고정)
        const lot = await tx.inventoryLot.create({
          data: {
            companyId,
            itemType: poItem.itemType,
            materialMasterId: poItem.materialMasterId,
            subsidiaryMasterId: poItem.subsidiaryMasterId,
            locationId: po.locationId,
            receivingNoteItemId: rItem.id,
            lotNumber: `${note.receiveNumber}-${rItem.id.slice(-6)}`,
            initialQty: receivedQty,
            remainingQty: receivedQty,
            unitPrice: poItem.unitPrice, // ★ P9: PO 단가 고정
            receivedAt: note.receivedDate,
          },
        });

        // 2-2) InventoryTransaction(PURCHASE) 기록
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            locationId: po.locationId,
            materialMasterId: poItem.materialMasterId,
            inventoryLotId: lot.id,
            transactionType: TransactionType.PURCHASE,
            quantity: receivedQty,
            unitPrice: poItem.unitPrice,
            referenceType: "RECEIVING_NOTE",
            referenceId: note.id,
            transactionDate: note.receivedDate,
          },
        });

        // 2-3) PO 항목 누적 수량 업데이트
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: { increment: receivedQty } },
        });

        // 2-4) 불일치 스냅샷 (수량)
        const qtyDiff = receivedQty - poItem.quantity;
        if (qtyDiff !== 0) {
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              purchaseOrderItemId: poItem.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type:
                qtyDiff < 0
                  ? DiscrepancyType.QUANTITY_SHORT
                  : DiscrepancyType.QUANTITY_OVER,
              expectedQty: poItem.quantity,
              actualQty: receivedQty,
              expectedUnitPrice: poItem.unitPrice,
              actualUnitPrice: rItem.unitPrice,
              diffValue: qtyDiff,
              reason: resolveReason(
                buildDiscrepancyKey(
                  qtyDiff < 0
                    ? DiscrepancyType.QUANTITY_SHORT
                    : DiscrepancyType.QUANTITY_OVER,
                  poItem.id,
                  rItem.id,
                ),
                null,
              ),
              recordedByUserId: actorUserId,
            },
          });
        }

        // 2-5) 불일치 스냅샷 (단가) — P9: 기록 전용
        const priceDiff = Number(rItem.unitPrice) - Number(poItem.unitPrice);
        if (priceDiff !== 0) {
          await tx.receivingDiscrepancy.create({
            data: {
              companyId,
              purchaseOrderId: po.id,
              purchaseOrderItemId: poItem.id,
              receivingNoteId: note.id,
              receivingNoteItemId: rItem.id,
              type: DiscrepancyType.UNIT_PRICE_DIFF,
              expectedQty: poItem.quantity,
              actualQty: receivedQty,
              expectedUnitPrice: poItem.unitPrice,
              actualUnitPrice: rItem.unitPrice,
              diffValue: priceDiff,
              reason: resolveReason(
                buildDiscrepancyKey(DiscrepancyType.UNIT_PRICE_DIFF, poItem.id, rItem.id),
                "입고 단가가 발주 단가와 다름 (기록 전용, 단가 변경 없음)",
              ),
              recordedByUserId: actorUserId,
            },
          });
        }
      }

      // 3) 발주에 있었지만 입고에는 없는 항목 → ITEM_MISSING
      for (const poItem of po.items) {
        if (matchedPoItemIds.has(poItem.id)) continue;
        await tx.receivingDiscrepancy.create({
          data: {
            companyId,
            purchaseOrderId: po.id,
            purchaseOrderItemId: poItem.id,
            receivingNoteId: note.id,
            receivingNoteItemId: null,
            type: DiscrepancyType.ITEM_MISSING,
            expectedQty: poItem.quantity,
            actualQty: 0,
            expectedUnitPrice: poItem.unitPrice,
            actualUnitPrice: null,
            diffValue: -poItem.quantity,
            reason: resolveReason(
              buildDiscrepancyKey(DiscrepancyType.ITEM_MISSING, poItem.id, null),
              "발주에 있었으나 입고되지 않음",
            ),
            recordedByUserId: actorUserId,
          },
        });
      }

      // 4) 입고서 상태 갱신 (D30 C-3-d2: 사용자가 입력한 note 있으면 덮어씀)
      const updatedNote = await tx.receivingNote.update({
        where: { id: note.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedByUserId: actorUserId,
          ...(options?.note != null && { note: options.note }),
        },
      });

      // 5) 발주서 상태 → RECEIVED (같은 tx 직접 전달)
      await transitionPurchaseOrderStatus(
        companyId,
        po.id,
        { toStatus: "RECEIVED", actorUserId },
        tx, // ★ 4번째 인자는 tx 자체, 옵션 객체 아님
      );

      return updatedNote;
    },
    { existingTx: options?.existingTx },
  );
}

// ════════════════════════════════════════
// D30 C-3-b1: 조회 & 초안 생성 서비스
// ════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import type {
  ReceivingNoteListQuery,
  CreateReceivingNoteDraftInput,
} from "../schemas/receiving-note.schema";

export class ReceivingNoteAlreadyExistsError extends Error {
  constructor(poId: string) {
    super(`이 발주에 대한 입고서가 이미 존재합니다: ${poId}`);
    this.name = "ReceivingNoteAlreadyExistsError";
  }
}

export class PurchaseOrderNotEligibleForReceivingError extends Error {
  constructor(poId: string, status: string) {
    super(
      `발주 상태가 입고서 작성 대상이 아닙니다 (SUBMITTED 만 허용): poId=${poId}, status=${status}`,
    );
    this.name = "PurchaseOrderNotEligibleForReceivingError";
  }
}

/**
 * 입고서 목록 조회 (페이지네이션 + 필터).
 *
 * ★ D30 C-3-d: 각 노트에 items 기반 파생 totalAmount 계산해 첨부.
 *    (별도 컬럼 저장 없이 편집 시마다 자동 동기화)
 */
export async function getReceivingNotes(
  companyId: string,
  query: ReceivingNoteListQuery,
) {
  const {
    page, limit, status, purchaseOrderId, search,
    dateFrom, dateTo, sortBy, sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status && { status }),
    ...(purchaseOrderId && { purchaseOrderId }),
    ...(search && {
      receiveNumber: { contains: search, mode: "insensitive" as const },
    }),
    ...((dateFrom || dateTo) && {
      receivedDate: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };

  const [rawItems, total] = await Promise.all([
    prisma.receivingNote.findMany({
      where,
      include: {
        purchaseOrder: {
          select: {
            id: true, orderNumber: true, status: true,
            supplier: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
        confirmedByUser: { select: { id: true, name: true } },
        // ★ D30 C-3-d: totalAmount 파생 계산용 최소 필드만 로드
        items: { select: { receivedQty: true, unitPrice: true } },
        _count: { select: { items: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.receivingNote.count({ where }),
  ]);

  // ★ D30 C-3-d: 각 노트에 totalAmount 파생 필드 첨부
  //    (items 는 파생 계산 후 응답에서 제거하지 않음 — 필요 시 UI 에서 무시)
  //    n.items 는 include 로 항상 존재하지만, mock 환경 방어를 위해 ?? [] 처리
  const items = rawItems.map((n) => {
    const noteItems = n.items ?? [];
    const totalAmount = Math.round(
      noteItems.reduce(
        (acc, it) => acc + Number(it.receivedQty) * Number(it.unitPrice),
        0,
      ),
    );
    return { ...n, totalAmount };
  });

  return {
    items,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 입고서 단건 조회 (품목 + PO + 불일치 이력 포함).
 */
export async function getReceivingNoteById(companyId: string, id: string) {
  return prisma.receivingNote.findFirst({
    where: { id, companyId },
    include: {
      purchaseOrder: {
        include: {
          supplier: true,
          location: { select: { id: true, name: true, code: true } },
          productionLine: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              supplierItem: { include: { supplyUnit: true } },
              materialMaster: { select: { id: true, name: true, code: true } },
              subsidiaryMaster: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
      items: {
        include: {
          purchaseOrderItem: {
            include: {
              materialMaster: { select: { id: true, name: true, code: true } },
              subsidiaryMaster: { select: { id: true, name: true, code: true } },
              supplierItem: { include: { supplyUnit: true } },
            },
          },
        },
      },
      confirmedByUser: { select: { id: true, name: true } },
      discrepancies: {
        orderBy: { recordedAt: "desc" },
        include: {
          recordedByUser: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/**
 * 발주 상세 하단용: 이 PO 에 기록된 모든 ReceivingDiscrepancy.
 */
export async function getReceivingDiscrepanciesByPO(
  companyId: string,
  purchaseOrderId: string,
) {
  return prisma.receivingDiscrepancy.findMany({
    where: { companyId, purchaseOrderId },
    orderBy: { recordedAt: "desc" },
    include: {
      recordedByUser: { select: { id: true, name: true } },
      receivingNote: { select: { id: true, receiveNumber: true, status: true } },
      // ★ purchaseOrderItem 관계 없음 (설계 의도: 스냅샷 이력 격리)
      //    UI에서 품목명 표시가 필요하면 purchaseOrderItemId 로 PO items 에서 클라이언트 사이드 조인.
    },
  });
}

/**
 * 입고서 초안 생성 (D30 C-3-b1).
 *
 * 정책:
 *  - 1 PO = 1 ReceivingNote (동일 PO 에 이미 노트 존재 시 ReceivingNoteAlreadyExistsError)
 *  - PO 상태는 SUBMITTED 만 허용 (그 외 PurchaseOrderNotEligibleForReceivingError)
 *  - status = DRAFT 로 생성. 확정은 별도 confirmReceivingNote 액션.
 *  - receiveNumber 자동 채번: RN-YYYYMMDD-XXX (회사+수령일 시퀀스)
 */
export async function createReceivingNoteDraft(
  companyId: string,
  input: CreateReceivingNoteDraftInput,
) {
  return prisma.$transaction(async (tx) => {
    // 1) PO 로드 + 검증
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId },
      select: { id: true, status: true },
    });
    if (!po) throw new Error("NOT_FOUND");
    if (po.status !== "SUBMITTED") {
      throw new PurchaseOrderNotEligibleForReceivingError(po.id, po.status);
    }

    // 2) 기존 노트 존재 여부 (1 PO = 1 Note)
    const existing = await tx.receivingNote.findFirst({
      where: { purchaseOrderId: po.id },
      select: { id: true },
    });
    if (existing) {
      throw new ReceivingNoteAlreadyExistsError(po.id);
    }

    // 3) receiveNumber 채번 (RN-YYYYMMDD-XXX)
    const d = input.receivedDate;
    const prefix = `RN-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`;
    const last = await tx.receivingNote.findFirst({
      where: { companyId, receiveNumber: { startsWith: prefix } },
      orderBy: { receiveNumber: "desc" },
      select: { receiveNumber: true },
    });
    let nextSeq = 1;
    if (last) {
      const seq = parseInt(last.receiveNumber.slice(prefix.length), 10);
      if (!Number.isNaN(seq)) nextSeq = seq + 1;
    }
    const receiveNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    // 4) 노트 + 아이템 생성
    return tx.receivingNote.create({
      data: {
        companyId,
        purchaseOrderId: po.id,
        receiveNumber,
        status: "DRAFT",
        receivedDate: input.receivedDate,
        note: input.note,
        items: {
          create: input.items.map((it) => ({
            purchaseOrderItemId: it.purchaseOrderItemId,
            receivedQty: it.receivedQty,
            unitPrice: it.unitPrice,
          })),
        },
      },
      include: { items: true },
    });
  });
}

// ════════════════════════════════════════
// D30 C-3-b2: 대시보드 & Eligible PO 목록 서비스
// ════════════════════════════════════════

/**
 * 입고 대시보드 요약 (옵션 β).
 *
 * 반환:
 *  - counts: 총 노트 / DRAFT / 이번 달 CONFIRMED / 확정 대기 PO (SUBMITTED 이면서 노트 없음)
 *  - recentNotes: 최근 노트 5건 (수령일 desc)
 *  - eligiblePOs: 확정 대기 PO 5건 (orderDate desc)
 *  - discrepancySummary30d: 최근 30일 discrepancy 타입별 카운트
 */
export async function getReceivingDashboardSummary(companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalNotes,
    draftNotes,
    confirmedThisMonth,
    eligiblePOsCount,
    recentNotes,
    eligiblePOs,
    discrepancyGroups,
  ] = await Promise.all([
    prisma.receivingNote.count({ where: { companyId } }),
    prisma.receivingNote.count({ where: { companyId, status: "DRAFT" } }),
    prisma.receivingNote.count({
      where: { companyId, status: "CONFIRMED", confirmedAt: { gte: monthStart } },
    }),
    prisma.purchaseOrder.count({
      where: { companyId, status: "SUBMITTED", receivingNotes: { none: {} } },
    }),
    prisma.receivingNote.findMany({
      where: { companyId },
      orderBy: { receivedDate: "desc" },
      take: 5,
      include: {
        purchaseOrder: {
          select: {
            id: true, orderNumber: true,
            supplier: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId, status: "SUBMITTED", receivingNotes: { none: {} } },
      orderBy: { orderDate: "desc" },
      take: 5,
      select: {
        id: true, orderNumber: true, orderDate: true, totalAmount: true,
        supplier: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.receivingDiscrepancy.groupBy({
      by: ["type"],
      where: { companyId, recordedAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  const discrepancySummary30d = {
    QUANTITY_SHORT: 0,
    QUANTITY_OVER: 0,
    UNIT_PRICE_DIFF: 0,
    ITEM_MISSING: 0,
    total: 0,
  };
  for (const g of discrepancyGroups) {
    const n = g._count._all;
    discrepancySummary30d[g.type] = n;
    discrepancySummary30d.total += n;
  }

  return {
    counts: {
      totalNotes,
      draftNotes,
      confirmedThisMonth,
      eligiblePOs: eligiblePOsCount,
    },
    recentNotes,
    eligiblePOs,
    discrepancySummary30d,
  };
}

/**
 * "새 입고서" 진입점에서 사용: SUBMITTED 이면서 입고 노트가 없는 PO 목록.
 * SearchableSelect 용도로 최대 50건, orderDate desc.
 */
export async function listEligiblePOsForReceiving(
  companyId: string,
  options?: { search?: string; limit?: number },
) {
  const limit = Math.min(options?.limit ?? 50, 100);
  return prisma.purchaseOrder.findMany({
    where: {
      companyId,
      status: "SUBMITTED",
      receivingNotes: { none: {} },
      ...(options?.search && {
        OR: [
          { orderNumber: { contains: options.search, mode: "insensitive" as const } },
          { supplier: { name: { contains: options.search, mode: "insensitive" as const } } },
        ],
      }),
    },
    orderBy: { orderDate: "desc" },
    take: limit,
    select: {
      id: true, orderNumber: true, orderDate: true, locationId: true, totalAmount: true,
      supplier: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });
}

// ════════════════════════════════════════
// D30 C-3-c: DRAFT 수정/삭제 서비스
// ════════════════════════════════════════

import type {
  UpdateReceivingNoteDraftInput,
} from "../schemas/receiving-note.schema";

export class ReceivingNoteNotDraftError extends Error {
  constructor(id: string, status: string) {
    super(`ReceivingNote is not DRAFT (status=${status}): ${id}`);
    this.name = "ReceivingNoteNotDraftError";
  }
}

/**
 * 입고서 초안 수정.
 * 트랜잭션 안에서 기존 items 를 전체 삭제 후 새 items 로 재생성.
 * (부분 수정보다 훨씬 단순하고, DRAFT 는 확정 전이므로 이력 손실 부담이 없음)
 */
export async function updateReceivingNoteDraft(
  companyId: string,
  input: UpdateReceivingNoteDraftInput,
) {
  return prisma.$transaction(async (tx) => {
    // 1) 노트 로드 + 가드
    const note = await tx.receivingNote.findFirst({
      where: { id: input.receivingNoteId, companyId },
      select: { id: true, status: true, purchaseOrderId: true },
    });
    if (!note) throw new Error("NOT_FOUND");
    if (note.status !== "DRAFT") {
      throw new ReceivingNoteNotDraftError(note.id, note.status);
    }

    // 2) items 전체 교체 (기존 삭제 → 새로 생성)
    await tx.receivingNoteItem.deleteMany({
      where: { receivingNoteId: note.id },
    });

    // 3) 노트 갱신 + 새 items 삽입
    return tx.receivingNote.update({
      where: { id: note.id },
      data: {
        receivedDate: input.receivedDate,
        note: input.note,
        items: {
          create: input.items.map((it) => ({
            purchaseOrderItemId: it.purchaseOrderItemId,
            receivedQty: it.receivedQty,
            unitPrice: it.unitPrice,
          })),
        },
      },
      include: { items: true },
    });
  });
}

/**
 * 입고서 초안 삭제.
 * DRAFT 만 허용. ReceivingNoteItem 은 CASCADE 로 자동 삭제.
 */
export async function deleteReceivingNoteDraft(
  companyId: string,
  receivingNoteId: string,
) {
  return prisma.$transaction(async (tx) => {
    const note = await tx.receivingNote.findFirst({
      where: { id: receivingNoteId, companyId },
      select: { id: true, status: true, purchaseOrderId: true, receiveNumber: true },
    });
    if (!note) throw new Error("NOT_FOUND");
    if (note.status !== "DRAFT") {
      throw new ReceivingNoteNotDraftError(note.id, note.status);
    }

    // ★ 스키마에 CASCADE 없음 — 명시적으로 items 먼저 삭제
    await tx.receivingNoteItem.deleteMany({ where: { receivingNoteId: note.id } });

    await tx.receivingNote.delete({ where: { id: note.id } });

    return {
      id: note.id,
      receiveNumber: note.receiveNumber,
      purchaseOrderId: note.purchaseOrderId,
    };
  });
}

// ════════════════════════════════════════
// D30 C-3-d: 불일치 이력 전사 조회 서비스
// ════════════════════════════════════════

import type { ReceivingDiscrepancyListQuery } from "../schemas/receiving-note.schema";

/**
 * 회사 전체 ReceivingDiscrepancy 페이지네이션 조회.
 *
 * 정책:
 *  - ReceivingDiscrepancy 는 스냅샷 격리 원칙에 따라 PurchaseOrderItem 관계를 갖지 않음.
 *    UI 표시용 품목명을 위해 purchaseOrderItemId 를 수집해 별도 배치 조회 후 합침.
 *  - purchaseOrder / receivingNote / recordedByUser 는 include 로 join
 *  - type === "QUANTITY" 은 QUANTITY_SHORT + QUANTITY_OVER 묶음 (UI 편의)
 *  - month (YYYY-MM) 지정 시 recordedAt 범위로 변환
 *  - search 는 발주번호 or 입고번호 부분 일치
 *
 * 반환: { items, pagination }
 *   items[i].purchaseOrderItem: 배치 조회로 붙인 파생 필드 (관계 아님)
 */
export async function getReceivingDiscrepancies(
  companyId: string,
  query: ReceivingDiscrepancyListQuery,
) {
  const {
    page, limit, month, type, search,
    purchaseOrderId, receivingNoteId,
    sortBy, sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  // month → recordedAt 범위 변환
  let dateRange: { gte: Date; lt: Date } | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dateRange = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1), // 다음 달 1일 미만
    };
  }

  // type → Prisma where 변환 (QUANTITY 는 SHORT+OVER 묶음)
  const typeFilter =
    type === "QUANTITY"
      ? { type: { in: [DiscrepancyType.QUANTITY_SHORT, DiscrepancyType.QUANTITY_OVER] } }
      : type
        ? { type }
        : {};

  const where = {
    companyId,
    ...typeFilter,
    ...(purchaseOrderId && { purchaseOrderId }),
    ...(receivingNoteId && { receivingNoteId }),
    ...(dateRange && { recordedAt: dateRange }),
    ...(search && {
      OR: [
        { purchaseOrder: { orderNumber: { contains: search, mode: "insensitive" as const } } },
        { receivingNote: { receiveNumber: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [rawItems, total] = await Promise.all([
    prisma.receivingDiscrepancy.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            supplier: { select: { id: true, name: true } },
          },
        },
        receivingNote: {
          select: { id: true, receiveNumber: true, status: true },
        },
        recordedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.receivingDiscrepancy.count({ where }),
  ]);

  // ★ 스냅샷 격리 원칙 유지: purchaseOrderItem 은 관계가 아니라 배치 조회로 파생
  const poItemIds = rawItems
    .map((d) => d.purchaseOrderItemId)
    .filter((id): id is string => id != null);

  const poItemsMap = new Map<
    string,
    {
      id: string;
      quantity: number;
      unitPrice: number;
      materialMaster: { id: string; name: string; code: string } | null;
      subsidiaryMaster: { id: string; name: string; code: string } | null;
      supplierItem: {
        id: string;
        productName: string;
        supplyUnit: { code: string } | null;
      } | null;
    }
  >();

  if (poItemIds.length > 0) {
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { id: { in: poItemIds } },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        materialMaster: { select: { id: true, name: true, code: true } },
        subsidiaryMaster: { select: { id: true, name: true, code: true } },
        supplierItem: {
          select: {
            id: true,
            productName: true,
            supplyUnit: { select: { code: true } },
          },
        },
      },
    });
    for (const pi of poItems) {
      poItemsMap.set(pi.id, pi);
    }
  }

  const items = rawItems.map((d) => ({
    ...d,
    purchaseOrderItem: d.purchaseOrderItemId
      ? (poItemsMap.get(d.purchaseOrderItemId) ?? null)
      : null,
  }));

  return {
    items,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}


// ════════════════════════════════════════
// D30 C-3-d3: 확정 시 발생할 불일치 미리 계산 (프리뷰)
// ════════════════════════════════════════

export type ReceivingDiscrepancyPreview = {
  /** buildDiscrepancyKey() 결과. 확정 액션에 사유 map 의 key 로 사용 */
  key: string;
  type: DiscrepancyType;
  purchaseOrderItemId: string | null;
  receivingNoteItemId: string | null;
  /** 표시용 재료/부자재 명. 없으면 "-" */
  itemName: string;
  expectedQty: number | null;
  actualQty: number | null;
  expectedUnitPrice: number | null;
  actualUnitPrice: number | null;
  diffValue: number;
  /** 자동 사유 (사용자가 사유를 비워두면 저장될 값). UI 안내용 */
  autoReason: string | null;
};

/**
 * ReceivingNote 확정 시 발생할 불일치 목록을 사전 계산 (읽기 전용).
 *
 * confirmReceivingNote 의 discrepancy 생성 로직과 완전히 동일한 판정 규칙을 사용.
 * (수량 부족/초과, 단가 차이, 품목 누락 양방향)
 *
 * DRAFT / CONFIRMED 모두 호출 가능.
 * - DRAFT: 확정 다이얼로그 프리뷰용 (주 용도)
 * - CONFIRMED: 감사·재확인용
 */
export async function previewReceivingNoteDiscrepancies(
  companyId: string,
  receivingNoteId: string,
): Promise<ReceivingDiscrepancyPreview[]> {
  const note = await prisma.receivingNote.findUnique({
    where: { id: receivingNoteId },
    include: {
      items: {
        include: {
          purchaseOrderItem: {
            include: {
              materialMaster: { select: { name: true } },
              subsidiaryMaster: { select: { name: true } },
            },
          },
        },
      },
      purchaseOrder: {
        include: {
          items: {
            include: {
              materialMaster: { select: { name: true } },
              subsidiaryMaster: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!note) throw new ReceivingNoteNotFoundError(receivingNoteId);
  if (note.companyId !== companyId) throw new ReceivingNoteCompanyMismatchError();

  const previews: ReceivingDiscrepancyPreview[] = [];
  const poItemById = new Map(note.purchaseOrder.items.map((i) => [i.id, i]));
  const matchedPoItemIds = new Set<string>();

  const nameOfPoItem = (
    poItem: (typeof note.purchaseOrder.items)[number] | undefined | null,
  ): string =>
    poItem?.materialMaster?.name ??
    poItem?.subsidiaryMaster?.name ??
    "-";

  // 1) 입고 항목 기준 순회
  for (const rItem of note.items) {
    const poItem = rItem.purchaseOrderItemId
      ? poItemById.get(rItem.purchaseOrderItemId)
      : undefined;

    // 1-a) 발주에 없는 항목이 입고됨
    if (!poItem) {
      previews.push({
        key: buildDiscrepancyKey(DiscrepancyType.ITEM_MISSING, null, rItem.id),
        type: DiscrepancyType.ITEM_MISSING,
        purchaseOrderItemId: null,
        receivingNoteItemId: rItem.id,
        itemName:
          rItem.purchaseOrderItem?.materialMaster?.name ??
          rItem.purchaseOrderItem?.subsidiaryMaster?.name ??
          "-",
        expectedQty: null,
        actualQty: rItem.receivedQty,
        expectedUnitPrice: null,
        actualUnitPrice: rItem.unitPrice,
        diffValue: rItem.receivedQty,
        autoReason: "발주에 없는 항목이 입고됨",
      });
      continue;
    }

    matchedPoItemIds.add(poItem.id);

    // 1-b) 수량 불일치
    const qtyDiff = rItem.receivedQty - poItem.quantity;
    if (qtyDiff !== 0) {
      const type =
        qtyDiff < 0
          ? DiscrepancyType.QUANTITY_SHORT
          : DiscrepancyType.QUANTITY_OVER;
      previews.push({
        key: buildDiscrepancyKey(type, poItem.id, rItem.id),
        type,
        purchaseOrderItemId: poItem.id,
        receivingNoteItemId: rItem.id,
        itemName: nameOfPoItem(poItem),
        expectedQty: poItem.quantity,
        actualQty: rItem.receivedQty,
        expectedUnitPrice: poItem.unitPrice,
        actualUnitPrice: rItem.unitPrice,
        diffValue: qtyDiff,
        autoReason: null,
      });
    }

    // 1-c) 단가 불일치
    const priceDiff = Number(rItem.unitPrice) - Number(poItem.unitPrice);
    if (priceDiff !== 0) {
      previews.push({
        key: buildDiscrepancyKey(
          DiscrepancyType.UNIT_PRICE_DIFF,
          poItem.id,
          rItem.id,
        ),
        type: DiscrepancyType.UNIT_PRICE_DIFF,
        purchaseOrderItemId: poItem.id,
        receivingNoteItemId: rItem.id,
        itemName: nameOfPoItem(poItem),
        expectedQty: poItem.quantity,
        actualQty: rItem.receivedQty,
        expectedUnitPrice: poItem.unitPrice,
        actualUnitPrice: rItem.unitPrice,
        diffValue: priceDiff,
        autoReason: "입고 단가가 발주 단가와 다름 (기록 전용, 단가 변경 없음)",
      });
    }
  }

  // 2) 발주에 있었으나 입고에 없는 항목
  for (const poItem of note.purchaseOrder.items) {
    if (matchedPoItemIds.has(poItem.id)) continue;
    previews.push({
      key: buildDiscrepancyKey(DiscrepancyType.ITEM_MISSING, poItem.id, null),
      type: DiscrepancyType.ITEM_MISSING,
      purchaseOrderItemId: poItem.id,
      receivingNoteItemId: null,
      itemName: nameOfPoItem(poItem),
      expectedQty: poItem.quantity,
      actualQty: 0,
      expectedUnitPrice: poItem.unitPrice,
      actualUnitPrice: null,
      diffValue: -poItem.quantity,
      autoReason: "발주에 있었으나 입고되지 않음",
    });
  }

  return previews;
}
