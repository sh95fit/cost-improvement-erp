import { z } from "zod";

/**
 * D30 (2026-06-30): 입고 확정 입력 스키마
 *
 * 입고 확정은 ReceivingNote 자체의 항목/수량/단가 정보를 기준으로 처리한다.
 * 추가 입력은 받지 않으며, 식별자 + 옵션만 지정한다.
 */
export const confirmReceivingNoteSchema = z.object({
  receivingNoteId: z.string().cuid(),
  /** 입고 확정 시 받는 사람 메모 (optional) */
  note: z.string().max(500).optional(),
});

export type ConfirmReceivingNoteInput = z.infer<typeof confirmReceivingNoteSchema>;