"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { previewReceivingDiscrepanciesSchema } from "../schemas/receiving-note.schema";
import {
  previewReceivingNoteDiscrepancies,
  ReceivingNoteNotFoundError,
  ReceivingNoteCompanyMismatchError,
  type ReceivingDiscrepancyPreview,
} from "../services/receiving-note.service";

// ════════════════════════════════════════
// D30 C-3-d3: 확정 시 발생할 불일치 프리뷰 Server Action
// ════════════════════════════════════════

/**
 * 확정 다이얼로그가 열릴 때 호출되어, 확정 시 기록될 ReceivingDiscrepancy 스냅샷 목록을 사전 계산.
 *
 * - 실제 DB 상태는 변경하지 않음 (읽기 전용).
 * - DRAFT / CONFIRMED 모두 조회 가능하나 UI 는 DRAFT 에서만 호출.
 * - 반환된 preview[i].key 는 확정 액션에 discrepancyReasons[key] 로 다시 전달됨.
 *
 * 권한: receiving-note READ.
 * (확정은 UPDATE 이지만 프리뷰는 조회만 하므로 READ 로 충분)
 */
export async function previewReceivingDiscrepanciesAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<ReceivingDiscrepancyPreview[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "READ");

    const { receivingNoteId } = previewReceivingDiscrepanciesSchema.parse(rawInput);

    let result: ReceivingDiscrepancyPreview[];
    try {
      result = await previewReceivingNoteDiscrepancies(
        session.companyId,
        receivingNoteId,
      );
    } catch (err) {
      if (err instanceof ReceivingNoteNotFoundError) throw new Error("NOT_FOUND");
      if (err instanceof ReceivingNoteCompanyMismatchError) throw new Error("FORBIDDEN");
      throw err;
    }

    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "불일치 프리뷰 조회에 실패했습니다", {
      NOT_FOUND: "입고서를 찾을 수 없습니다",
    });
  }
}