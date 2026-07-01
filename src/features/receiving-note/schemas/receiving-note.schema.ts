import { z } from "zod";

// ════════════════════════════════════════
// D30: 입고서 관련 스키마
// ════════════════════════════════════════

/**
 * 입고 확정 입력 (D30 C-2)
 */
export const confirmReceivingNoteSchema = z.object({
  receivingNoteId: z.string().cuid(),
  note: z.string().max(500).optional(),
});

export type ConfirmReceivingNoteInput = z.infer<typeof confirmReceivingNoteSchema>;

/**
 * 입고서 초안 생성 입력 (D30 C-3-b1)
 *
 * 정책: 1 PO = 1 ReceivingNote. 이미 존재하면 서비스가 RECEIVING_NOTE_ALREADY_EXISTS throw.
 * 부분 입고 미지원 — items 는 PO 품목 전체를 그대로 복사.
 */
export const createReceivingNoteDraftSchema = z.object({
  purchaseOrderId: z.string().cuid(),
  receivedDate: z.coerce.date(),
  items: z.array(
    z.object({
      purchaseOrderItemId: z.string().cuid(),
      receivedQty: z.coerce.number().nonnegative(),
      unitPrice: z.coerce.number().nonnegative(),
    }),
  ).min(1, "품목이 최소 1건 필요합니다"),
  note: z.string().max(500).optional(),
});

export type CreateReceivingNoteDraftInput = z.infer<typeof createReceivingNoteDraftSchema>;

/**
 * 입고서 목록 조회 쿼리 (D30 C-3-b1)
 */
export const receivingNoteListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["DRAFT", "CONFIRMED"]).optional(),
  purchaseOrderId: z.string().cuid().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["receivedDate", "receiveNumber", "createdAt"]).default("receivedDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ReceivingNoteListQuery = z.infer<typeof receivingNoteListQuerySchema>;


// ════════════════════════════════════════
// D30 C-3-b1: UI 라벨/배지 매핑
// PO 스키마의 PO_STATUS_LABELS / PO_STATUS_BADGE_COLOR 패턴을 그대로 따름
// ════════════════════════════════════════

import type { ReceivingNoteStatus, DiscrepancyType } from "@prisma/client";

/**
 * 입고서 상태 라벨 (UI 표시용)
 */
export const RECEIVING_NOTE_STATUS_LABELS: Record<ReceivingNoteStatus, string> = {
  DRAFT: "초안",
  CONFIRMED: "확정",
};

/**
 * 입고서 상태 배지 색상 (PurchaseOrderStatusBadge 와 동일한 COLOR_CLASS 키 사용)
 */
export const RECEIVING_NOTE_STATUS_BADGE_COLOR: Record<ReceivingNoteStatus, string> = {
  DRAFT: "gray",
  CONFIRMED: "emerald",
};

/**
 * 불일치 타입 라벨 (D30 정책 §4 부호 규칙 기반)
 *  - QUANTITY_SHORT : 수량 부족 (실제 < 예상)
 *  - QUANTITY_OVER  : 수량 초과 (실제 > 예상)
 *  - UNIT_PRICE_DIFF: 단가 차이 (PO 단가 ≠ 입고 단가)
 *  - ITEM_MISSING   : 품목 누락 또는 예상치 못한 품목
 */
export const DISCREPANCY_TYPE_LABELS: Record<DiscrepancyType, string> = {
  QUANTITY_SHORT: "수량 부족",
  QUANTITY_OVER: "수량 초과",
  UNIT_PRICE_DIFF: "단가 차이",
  ITEM_MISSING: "품목 누락",
};

export const DISCREPANCY_TYPE_BADGE_COLOR: Record<DiscrepancyType, string> = {
  QUANTITY_SHORT: "red",
  QUANTITY_OVER: "amber",
  UNIT_PRICE_DIFF: "blue",
  ITEM_MISSING: "gray",
};