// src/features/lineup/actions/lineup.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail, ActionResult } from "@/lib/result";
import { prisma } from "@/lib/prisma";
import { applyScopeFilter, getUserScope } from "@/lib/auth/scope";
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

// ════════════════════════════════════════
// S4-3-c-R6-B-3 — Layer B 라인업 선택용 스코프 액션
// (audit §10-14) targetDate + locationId 컨텍스트에서
// MaterialRequirement 기준 distinct (lineupId, productionLineId) 반환
// ════════════════════════════════════════


// ════════════════════════════════════════
// S4-3-c-R6-B-3 — Layer B 라인업 선택용 스코프 액션
// (audit §10-14) targetDate + locationId 컨텍스트에서
// MaterialRequirement 기준 distinct (lineupId, productionLineId) 반환
// ════════════════════════════════════════

type ScopedLineupRow = {
  lineupId: string;
  lineupName: string;
  lineupCode: string;
  productionLineId: string;
  productionLineName: string;
};

export async function getScopedLineupsForConsumptionAction(
  targetDate: string, // YYYY-MM-DD
  locationId: string,
): Promise<ActionResult<ScopedLineupRow[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "consumption", "READ");
    assertScope(session, "LOCATION", locationId);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return actionFail("VALIDATION", "targetDate 형식이 올바르지 않습니다");
    }

    if (!session.companyId) {
      return actionFail("COMPANY_NOT_ASSIGNED", "회사가 배정되지 않았습니다");
    }

    const userScope = await getUserScope(session.userId);

    const [y, m, d] = targetDate.split("-").map(Number);
    const targetDateUtc = new Date(Date.UTC(y, m - 1, d));

    const baseWhere = {
      targetDate: targetDateUtc,
      companyId: session.companyId,
      locationId,
      lineupId: { not: null },
      deletedAt: null,
    };

    // 시그니처: applyScopeFilter(scope, baseWhere) — H-47-1 확정
    const scopedWhere = applyScopeFilter(userScope, baseWhere);

    const rows = await prisma.materialRequirement.findMany({
      where: scopedWhere,
      distinct: ["lineupId", "productionLineId"],
      select: {
        lineupId: true,
        productionLineId: true,
        lineup: { select: { id: true, name: true, code: true, sortOrder: true } },
        productionLine: { select: { id: true, name: true } },
      },
      orderBy: [
        { lineup: { sortOrder: "asc" } },
        { productionLine: { name: "asc" } },
      ],
    });

    const result: ScopedLineupRow[] = rows
      .filter(
        (r): r is typeof r & {
          lineupId: string;
          productionLineId: string;
          lineup: NonNullable<typeof r.lineup>;
          productionLine: NonNullable<typeof r.productionLine>;
        } =>
          r.lineupId !== null &&
          r.productionLineId !== null &&
          r.lineup !== null &&
          r.productionLine !== null,
      )
      .map((r) => ({
        lineupId: r.lineupId,
        lineupName: r.lineup.name,
        lineupCode: r.lineup.code,
        productionLineId: r.productionLineId,
        productionLineName: r.productionLine.name,
      }));

    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "라인업 조회에 실패했습니다");
  }
}