"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { consumptionListQuerySchema } from "../schemas/consumption-list.schema";
import * as consumptionListService from "../services/consumption-list.service";

// ════════════════════════════════════════
// S4-3-c-3: 사용 이력 목록 조회 Server Action
// ════════════════════════════════════════
//
// 권한
//   - assertPermission(consumption, READ)
//   - locationId 가 주어진 경우에 한해 assertScope(LOCATION, locationId)
//     (미지정 시 세션 회사 전체 범위이므로 scope 검사 불필요)
//
// 반환
//   { items, pagination } — DB 쓰기 없음
export async function listConsumptionItemsAction(
  rawQuery: Record<string, unknown>,
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof consumptionListService.listConsumptionItems>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "consumption", "READ");

    const query = consumptionListQuerySchema.parse(rawQuery);

    if (query.locationId) {
      assertScope(session, "LOCATION", query.locationId);
    }

    const result = await consumptionListService.listConsumptionItems(
      session.companyId,
      query,
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "사용 이력 목록 조회에 실패했습니다");
  }
}
