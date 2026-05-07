"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  createUnitMasterSchema,
  updateUnitMasterSchema,
  unitMasterListQuerySchema,
} from "../schemas/unit-master.schema";
import * as unitMasterService from "../services/unit-master.service";
import type { ItemType } from "@prisma/client";

// ── 목록 조회 ──
export async function getUnitMastersAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "READ");

    const query = unitMasterListQuerySchema.parse(rawQuery);
    const result = await unitMasterService.getUnitMasters(session.companyId, query);

    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "단위 목록 조회에 실패했습니다");
  }
}

// ── Select Box용 단위 옵션 조회 ──
export async function getUnitOptionsAction(
  itemType: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "READ");

    const result = await unitMasterService.getUnitOptionsByItemType(
      session.companyId,
      itemType as ItemType
    );

    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "단위 옵션 조회에 실패했습니다");
  }
}

// ── 생성 ──
export async function createUnitMasterAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "CREATE");

    const input = createUnitMasterSchema.parse(rawInput);
    const unit = await unitMasterService.createUnitMaster(session.companyId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "UnitMaster",
      entityId: unit.id,
      after: unit as unknown as Record<string, unknown>,
    });

    return actionOk(unit);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message.includes("Unique constraint")) return actionFail("DUPLICATE", "이미 등록된 단위 코드입니다");
    }
    return actionFail("INTERNAL_ERROR", "단위 등록에 실패했습니다");
  }
}

// ── 수정 ──
export async function updateUnitMasterAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "UPDATE");

    const input = updateUnitMasterSchema.parse(rawInput);
    const existing = await unitMasterService.getUnitMasterById(id);
    if (!existing) return actionFail("NOT_FOUND", "단위를 찾을 수 없습니다");

    const before = existing as unknown as Record<string, unknown>;
    const unit = await unitMasterService.updateUnitMaster(id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "UnitMaster",
      entityId: unit.id,
      before,
      after: unit as unknown as Record<string, unknown>,
    });

    return actionOk(unit);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "단위 수정에 실패했습니다");
  }
}

// ── 삭제 ──
export async function deleteUnitMasterAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "DELETE");

    await unitMasterService.deleteUnitMaster(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "UnitMaster",
      entityId: id,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "단위를 찾을 수 없습니다");
      if (error.message === "SYSTEM_UNIT_CANNOT_DELETE") return actionFail("SYSTEM_UNIT", "시스템 기본 단위는 삭제할 수 없습니다");
      if (error.message === "UNIT_IN_USE") {
        const usages = (error as Error & { usages?: string[] }).usages ?? [];
        return actionFail("UNIT_IN_USE", `사용 중인 단위는 삭제할 수 없습니다: ${usages.join(", ")}`);
      }
    }
    return actionFail("INTERNAL_ERROR", "단위 삭제에 실패했습니다");
  }
}
