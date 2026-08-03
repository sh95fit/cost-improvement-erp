"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  buildConsumptionDraft,
  MaterialRequirementNotGeneratedError,
  MealPlanGroupNotFoundError,
  type ConsumptionDraft,
} from "../services/consumption-draft.service";
import {
  assertMealPlanInProgressForDraftView,
  MealPlanNotReadyForDraftViewError,
} from "../services/consumption-guard.service";
import { CONSUMPTION_ERRORS } from "../constants/errors";

// ════════════════════════════════════════
// S4-3-c-1: 사용 처리 초안 조회 Server Action (Cycle 3-B 개정)
// ════════════════════════════════════════
//
// 권한 순서 (P4 재고는 FACTORY/HYBRID 소속 Location 에서만):
//   1) assertPermission(consumption, READ)   — 신규 리소스 키
//   2) assertScope(LOCATION, locationId)
//   3) assertMealPlanInProgressForDraftView(companyId, targetDate, locationId)
//      — §9-16 가드 축 분리, 결정 1β: IN_PROGRESS/COMPLETED 허용
//   4) buildConsumptionDraft(...) — basisCountSource 자동 분기 (ESTIMATED/FINAL)
//
// 성공 반환: { header, basisCountSource, layerAItems, references } (DB 쓰기 없음)

export type BuildConsumptionDraftInput = {
  targetDate: string;   // YYYY-MM-DD
  locationId: string;
};

export async function buildConsumptionDraftAction(
  input: BuildConsumptionDraftInput,
): Promise<ActionResult<ConsumptionDraft>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "consumption", "READ");
    assertScope(session, "LOCATION", input.locationId);

    // targetDate 를 UTC 자정으로 정규화 (@db.Date 매치)
    const [y, m, d] = input.targetDate.split("-").map(Number);
    const targetDate = new Date(Date.UTC(y, m - 1, d));

    try {
      await assertMealPlanInProgressForDraftView(
        session.companyId,
        targetDate,
        input.locationId,
      );

      const draft = await buildConsumptionDraft(
        session.companyId,
        targetDate,
        input.locationId,
      );
      return actionOk(draft);
    } catch (err) {
      // 서비스 커스텀 에러 → 코드 문자열로 재발화 (receiving-note 컨벤션)
      if (err instanceof MealPlanNotReadyForDraftViewError) {
        throw new Error(CONSUMPTION_ERRORS.MEAL_PLAN_NOT_READY_FOR_DRAFT_VIEW);
      }
      if (err instanceof MealPlanGroupNotFoundError) {
        throw new Error(CONSUMPTION_ERRORS.MEAL_PLAN_GROUP_NOT_FOUND);
      }
      if (err instanceof MaterialRequirementNotGeneratedError) {
        throw new Error(CONSUMPTION_ERRORS.MATERIAL_REQUIREMENT_NOT_GENERATED);
      }
      throw err;
    }
  } catch (error) {
    return handleActionError(error, "사용 처리 초안을 불러오지 못했습니다", {
      [CONSUMPTION_ERRORS.MEAL_PLAN_NOT_READY_FOR_DRAFT_VIEW]:
        "해당 일자·공장의 식단 계획이 조리 진행(IN_PROGRESS) 또는 확정(COMPLETED) 상태가 아닙니다",
      [CONSUMPTION_ERRORS.MEAL_PLAN_GROUP_NOT_FOUND]:
        "해당 일자의 식단 계획을 찾을 수 없습니다",
      [CONSUMPTION_ERRORS.MATERIAL_REQUIREMENT_NOT_GENERATED]:
        "자재 소요량이 생성되어 있지 않습니다 (식단 계획 상태 전이 로직 오류)",
    });
  }
}
