// src/features/lineup/actions/lineup-template-map.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { MealSlotType } from "@prisma/client";
import {
  upsertLineupTemplateMapSchema,
  bulkUpsertLineupTemplateMapsSchema,
} from "../schemas/lineup.schema";
import * as templateMapService from "../services/lineup-template-map.service";

// ════════════════════════════════════════
// Read
// ════════════════════════════════════════

export async function getLineupTemplateMapsAction(
  lineupId: string
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof templateMapService.getLineupTemplateMaps>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "READ");
    const result = await templateMapService.getLineupTemplateMaps(
      session.companyId,
      lineupId
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "라인업 템플릿 매핑 조회에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
    });
  }
}

/**
 * (lineupId, slotType) 기본 매핑 1건 조회
 *  - 식단 자동 생성 시 사용 (향후 Step 2.5/2.6 또는 별도 모듈에서 호출)
 */
export async function getDefaultTemplateForSlotAction(
  lineupId: string,
  slotType: MealSlotType
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof templateMapService.getDefaultTemplateForSlot>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "READ");
    const result = await templateMapService.getDefaultTemplateForSlot(
      session.companyId,
      lineupId,
      slotType
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "기본 템플릿 조회에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// Write
// ════════════════════════════════════════

export async function upsertLineupTemplateMapAction(
  lineupId: string,
  rawInput: Record<string, unknown>
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof templateMapService.upsertLineupTemplateMap>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "UPDATE");
    const input = upsertLineupTemplateMapSchema.parse(rawInput);

    // before 스냅샷 (해당 slotType 활성 매핑)
    const before = await templateMapService.getDefaultTemplateForSlot(
      session.companyId,
      lineupId,
      input.slotType
    );
    const result = await templateMapService.upsertLineupTemplateMap(
      session.companyId,
      lineupId,
      input
    );
    await createAuditLog({
      session,
      action: before ? "UPDATE" : "CREATE",
      entityType: "LineupMealTemplateMap",
      entityId: result.id,
      before: before
        ? (before as unknown as Record<string, unknown>)
        : undefined,
      after: result as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "라인업 템플릿 매핑 저장에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
      INVALID_TEMPLATE: "선택된 식단 템플릿이 잘못되었습니다",
    });
  }
}

export async function bulkUpsertLineupTemplateMapsAction(
  lineupId: string,
  rawInput: Record<string, unknown>
): Promise<
  ActionResult<
    Awaited<
      ReturnType<typeof templateMapService.bulkUpsertLineupTemplateMaps>
    >
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "UPDATE");
    const input = bulkUpsertLineupTemplateMapsSchema.parse(rawInput);

    // before 스냅샷 (전체 활성 매핑)
    const before = await templateMapService.getLineupTemplateMaps(
      session.companyId,
      lineupId
    );
    const result = await templateMapService.bulkUpsertLineupTemplateMaps(
      session.companyId,
      lineupId,
      input
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "LineupMealTemplateMap",
      entityId: lineupId,
      before: { items: before } as unknown as Record<string, unknown>,
      after: { items: result } as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(
      error,
      "라인업 템플릿 매핑 일괄 저장에 실패했습니다",
      {
        NOT_FOUND: "라인업을 찾을 수 없습니다",
        INVALID_TEMPLATE: "선택된 식단 템플릿 중 잘못된 항목이 있습니다",
      }
    );
  }
}

export async function deleteLineupTemplateMapAction(
  mapId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "DELETE");
    const result = await templateMapService.deleteLineupTemplateMap(
      session.companyId,
      mapId
    );
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "LineupMealTemplateMap",
      entityId: mapId,
      before: result as unknown as Record<string, unknown>,
    });
    return actionOk({ id: mapId });
  } catch (error) {
    return handleActionError(error, "라인업 템플릿 매핑 삭제에 실패했습니다", {
      NOT_FOUND: "매핑을 찾을 수 없습니다",
      FORBIDDEN: "이 매핑에 접근 권한이 없습니다",
    });
  }
}

/**
 * (lineupId, slotType) 조합으로 삭제
 *  - UI에서 슬롯타입별 매핑 토글 끄기에 사용
 */
export async function deleteLineupTemplateMapBySlotAction(
  lineupId: string,
  slotType: MealSlotType
): Promise<ActionResult<{ lineupId: string; slotType: MealSlotType }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "DELETE");
    const result = await templateMapService.deleteLineupTemplateMapBySlot(
      session.companyId,
      lineupId,
      slotType
    );
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "LineupMealTemplateMap",
      entityId: result.id,
      before: result as unknown as Record<string, unknown>,
    });
    return actionOk({ lineupId, slotType });
  } catch (error) {
    return handleActionError(
      error,
      "라인업 템플릿 매핑 삭제에 실패했습니다",
      {
        NOT_FOUND: "해당 슬롯타입에 매핑이 없습니다",
      }
    );
  }
}
