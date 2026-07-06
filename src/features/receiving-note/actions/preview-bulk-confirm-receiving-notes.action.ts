"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { previewBulkConfirmReceivingNotesSchema } from "../schemas/receiving-note.schema";
import {
  previewBulkConfirmReceivingNotes,
  type BulkConfirmPreviewRow,
} from "../services/daily-receiving.service";

// ════════════════════════════════════════
// D30 Ex1: 일괄 확정 프리뷰 (dry-run) Server Action
// ════════════════════════════════════════

/**
 * 벌크 확정 전 각 입고서의 확정 가능 여부를 사전 검증.
 * 실제 확정은 하지 않으며 DB 변경 없음.
 *
 * 권한: receiving-note UPDATE (확정 액션과 동일한 권한을 프리뷰에도 요구).
 */
export async function previewBulkConfirmReceivingNotesAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<BulkConfirmPreviewRow[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "UPDATE");

    const { receivingNoteIds } =
      previewBulkConfirmReceivingNotesSchema.parse(rawInput);

    const result = await previewBulkConfirmReceivingNotes(
      session.companyId,
      receivingNoteIds,
    );

    return actionOk(result);
  } catch (error) {
    return handleActionError(
      error,
      "일괄 확정 프리뷰 조회에 실패했습니다",
    );
  }
}
