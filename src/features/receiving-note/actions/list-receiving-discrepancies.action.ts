"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { receivingDiscrepancyListQuerySchema } from "../schemas/receiving-note.schema";
import { getReceivingDiscrepancies } from "../services/receiving-note.service";

/**
 * 회사 전체 불일치 이력 조회 액션 (D30 C-3-d).
 *
 * 권한: receiving-note READ.
 * TODO: LOCATION 스코프 필터 (커밋 ⑧에서 세션 스코프 인프라 개선과 함께 처리)
 */
export async function listReceivingDiscrepanciesAction(
  rawQuery: Record<string, unknown>,
): Promise<
  ActionResult<Awaited<ReturnType<typeof getReceivingDiscrepancies>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "READ");

    const query = receivingDiscrepancyListQuerySchema.parse(rawQuery);
    const result = await getReceivingDiscrepancies(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "불일치 이력 조회에 실패했습니다");
  }
}
