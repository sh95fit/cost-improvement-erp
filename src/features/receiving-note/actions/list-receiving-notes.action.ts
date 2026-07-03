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
    // TODO(D30 C-3-b3): LOCATION 스코프 필터 주입.
    //   getReceivingNotes 서비스에 locationIds? 옵션 파라미터를 추가하고
    //   session 의 LOCATION 스코프가 제한적일 경우 그 배열을 전달해야 함.
    //   현재는 companyId 격리만 적용 (관리자 뷰).
    const result = await getReceivingNotes(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "입고서 목록 조회에 실패했습니다");
  }
}
