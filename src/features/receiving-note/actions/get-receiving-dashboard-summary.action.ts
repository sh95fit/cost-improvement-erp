"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { getReceivingDashboardSummary } from "../services/receiving-note.service";

export async function getReceivingDashboardSummaryAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getReceivingDashboardSummary>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "READ");
    const summary = await getReceivingDashboardSummary(session.companyId);
    return actionOk(summary);
  } catch (error) {
    return handleActionError(error, "입고 대시보드 요약 조회에 실패했습니다");
  }
}
