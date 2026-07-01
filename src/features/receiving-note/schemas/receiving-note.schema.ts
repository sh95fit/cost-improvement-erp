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