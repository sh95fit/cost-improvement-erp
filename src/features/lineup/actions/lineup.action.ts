// src/features/lineup/actions/lineup.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createLineupSchema,
  updateLineupSchema,
  lineupListQuerySchema,
  // syncLineupLocationsSchema,  // ⚠️ 주석 처리
} from "../schemas/lineup.schema";
import * as lineupService from "../services/lineup.service";
import type { Lineup } from "@prisma/client";

// ════════════════════════════════════════
// Lineup Read
// ════════════════════════════════════════

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
    if (!lineup) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "라인업 조회에 실패했습니다",
        { NOT_FOUND: "라인업을 찾을 수 없습니다" }
      );
    }
    return actionOk(lineup);
  } catch (error) {
    return handleActionError(error, "라인업 조회에 실패했습니다");
  }
}

// ════════════════════════════════════════
// Lineup CRUD (Write)
// ════════════════════════════════════════

export async function createLineupAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<Lineup>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "CREATE");
    const input = createLineupSchema.parse(rawInput);
    const lineup = await lineupService.createLineup(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "Lineup",
      entityId: lineup.id,
      after: lineup as unknown as Record<string, unknown>,
    });
    return actionOk(lineup);
  } catch (error) {
    return handleActionError(error, "라인업 생성에 실패했습니다");
  }
}

export async function updateLineupAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<Lineup>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "UPDATE");
    const input = updateLineupSchema.parse(rawInput);
    const existing = await lineupService.getLineupById(session.companyId, id);
    if (!existing) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "라인업 수정에 실패했습니다",
        { NOT_FOUND: "라인업을 찾을 수 없습니다" }
      );
    }
    const before = existing as unknown as Record<string, unknown>;
    const lineup = await lineupService.updateLineup(
      session.companyId,
      id,
      input
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "Lineup",
      entityId: lineup.id,
      before,
      after: lineup as unknown as Record<string, unknown>,
    });
    return actionOk(lineup);
  } catch (error) {
    return handleActionError(error, "라인업 수정에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
    });
  }
}

export async function checkLineupDependenciesAction(
  id: string
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof lineupService.checkLineupDependencies>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "READ");
    const result = await lineupService.checkLineupDependencies(
      session.companyId,
      id
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "라인업 의존성 확인에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
    });
  }
}

export async function deleteLineupAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "lineup", "DELETE");
    const existing = await lineupService.getLineupById(session.companyId, id);
    if (!existing) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "라인업 삭제에 실패했습니다",
        { NOT_FOUND: "라인업을 찾을 수 없습니다" }
      );
    }
    await lineupService.deleteLineup(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "Lineup",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "라인업 삭제에 실패했습니다", {
      NOT_FOUND: "라인업을 찾을 수 없습니다",
      DEPENDENCY_EXISTS:
        "이 라인업을 사용 중인 식단/식수/발주가 있어 삭제할 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// LineupLocationMap 관련 액션 — 배제됨
// 향후 모델 복원 시 함께 주석 해제
// ════════════════════════════════════════

// export async function getLineupLocationsAction(...) { ... }
// export async function syncLineupLocationsAction(...) { ... }
