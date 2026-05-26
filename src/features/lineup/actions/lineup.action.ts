// src/features/lineup/actions/lineup.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { lineupListQuerySchema } from "../schemas/lineup.schema";
import * as lineupService from "../services/lineup.service";

export async function getLineupsAction(
  rawQuery: Record<string, unknown>
): Promise<
  ActionResult<Awaited<ReturnType<typeof lineupService.getLineups>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "READ");
    const query = lineupListQuerySchema.parse(rawQuery);
    const result = await lineupService.getLineups(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "라인업 목록 조회에 실패했습니다");
  }
}

export async function getLineupByIdAction(
  id: string
): Promise<
  ActionResult<Awaited<ReturnType<typeof lineupService.getLineupById>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "READ");
    const lineup = await lineupService.getLineupById(session.companyId, id);
    return actionOk(lineup);
  } catch (error) {
    return handleActionError(error, "라인업 조회에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
    });
  }
}
