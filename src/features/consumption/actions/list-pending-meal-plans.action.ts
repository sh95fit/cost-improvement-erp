"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import * as service from "../services/list-pending-meal-plans.service";

/**
 * ════════════════════════════════════════
 * S4-3-c-4-1: 확정 대기 식단 조회 Server Action
 * ════════════════════════════════════════
 *
 * 권한: consumption:READ
 * (MealPlan 도메인 조회이지만, 사용 처리 화면 상단 배너로 노출되므로
 *  기존 사용 처리 진입 권한을 재사용해 UI 접근 스코프와 일치시킨다.)
 *
 * 반환: PendingMealPlanRow[] — DB 쓰기 없음
 */
export async function listPendingMealPlansAction(): Promise<
  ActionResult<service.PendingMealPlanRow[]>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "consumption", "READ");

    const rows = await service.listPendingMealPlans(session.companyId);
    return actionOk(rows);
  } catch (error) {
    return handleActionError(error, "확정 대기 식단 조회에 실패했습니다");
  }
}
