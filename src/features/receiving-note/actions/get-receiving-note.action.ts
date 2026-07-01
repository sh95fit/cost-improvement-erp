"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { getReceivingNoteById } from "../services/receiving-note.service";

export async function getReceivingNoteByIdAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getReceivingNoteById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "READ");

    const note = await getReceivingNoteById(session.companyId, id);
    if (!note) return actionOk(null);

    // 스코프 체크 (READ 도 자기 공장 범위로 제한)
    assertScope(session, "LOCATION", note.purchaseOrder.locationId);

    return actionOk(note);
  } catch (error) {
    return handleActionError(error, "입고서 조회에 실패했습니다");
  }
}
