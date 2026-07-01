"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { getReceivingDiscrepanciesByPO } from "../services/receiving-note.service";

export async function getReceivingDiscrepanciesByPOAction(
  purchaseOrderId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getReceivingDiscrepanciesByPO>>>> {
  try {
    const session = await requireCompanySession();
    // PO 상세에서 부속 정보로 조회되므로 receiving-note READ 로 충분
    assertPermission(session, "receiving-note", "READ");
    const items = await getReceivingDiscrepanciesByPO(session.companyId, purchaseOrderId);
    return actionOk(items);
  } catch (error) {
    return handleActionError(error, "불일치 이력 조회에 실패했습니다");
  }
}
