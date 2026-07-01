"use server";

import { z } from "zod";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { listEligiblePOsForReceiving } from "../services/receiving-note.service";

const querySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function listEligiblePOsForReceivingAction(
  rawQuery: Record<string, unknown> = {},
): Promise<ActionResult<Awaited<ReturnType<typeof listEligiblePOsForReceiving>>>> {
  try {
    const session = await requireCompanySession();
    // 입고서 작성 진입점이므로 CREATE 권한 요구
    assertPermission(session, "receiving-note", "CREATE");
    const options = querySchema.parse(rawQuery);
    const pos = await listEligiblePOsForReceiving(session.companyId, options);
    return actionOk(pos);
  } catch (error) {
    return handleActionError(error, "입고 대상 발주서 조회에 실패했습니다");
  }
}
