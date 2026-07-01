"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { receivingNoteListQuerySchema } from "../schemas/receiving-note.schema";
import { getReceivingNotes } from "../services/receiving-note.service";

export async function listReceivingNotesAction(
  rawQuery: Record<string, unknown>,
): Promise<ActionResult<Awaited<ReturnType<typeof getReceivingNotes>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "READ");
    const query = receivingNoteListQuerySchema.parse(rawQuery);
    const result = await getReceivingNotes(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "입고서 목록 조회에 실패했습니다");
  }
}
