"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { getDailyReceivingBundleSchema } from "../schemas/receiving-note.schema";
import {
  getDailyReceivingBundle,
  type DailyReceivingBundle,
} from "../services/daily-receiving.service";

// ════════════════════════════════════════
// D30 Ex1: 일자별 입고 통합 뷰 조회 Server Action
// ════════════════════════════════════════

/**
 * 지정 날짜와 기준(outbound|expected)으로 PO 를 pending/completed 분리 조회.
 *
 * 권한: receiving-note READ (조회만).
 * revalidate 없음 (쿼리).
 */
export async function getDailyReceivingBundleAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<DailyReceivingBundle>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "READ");

    const { date, mode } = getDailyReceivingBundleSchema.parse(rawInput);

    const result = await getDailyReceivingBundle(
      session.companyId,
      date,
      mode,
    );

    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "일자별 입고 목록 조회에 실패했습니다");
  }
}
