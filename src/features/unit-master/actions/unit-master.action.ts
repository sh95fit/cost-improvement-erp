// src/features/unit-master/actions/unit-master.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createUnitMasterSchema,
  updateUnitMasterSchema,
  unitMasterListQuerySchema,
} from "../schemas/unit-master.schema";
import * as unitMasterService from "../services/unit-master.service";
import type { ItemType } from "@prisma/client";

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
    return handleActionError(error, "단위 목록 조회에 실패했습니다");
  }
}

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
    return handleActionError(error, "단위 옵션 조회에 실패했습니다");
  }
}

export async function getUnitOptionsForConversionAction(
  itemType: string,
  unitCategory?: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "READ");
    const result = await unitMasterService.getUnitOptionsByItemType(
      session.companyId,
      itemType as ItemType
    );
    if (unitCategory) {
      const filtered = (result as Array<{ unitCategory: string }>).filter(
        (u) => u.unitCategory === unitCategory
      );
      return actionOk(filtered);
    }
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "단위 옵션 조회에 실패했습니다");
  }
}

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
    // NOTE: Unique constraint는 handleActionError에서 자동 처리됨
    return handleActionError(error, "단위 등록에 실패했습니다");
  }
}

export async function updateUnitMasterAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "UPDATE");
    const input = updateUnitMasterSchema.parse(rawInput);
    const existing = await unitMasterService.getUnitMasterById(id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "단위 수정에 실패했습니다", { NOT_FOUND: "단위를 찾을 수 없습니다" });
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
    return handleActionError(error, "단위 수정에 실패했습니다");
  }
}

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
    // NOTE: UNIT_IN_USE, SYSTEM_UNIT_CANNOT_DELETE은 handleActionError에서 자동 처리됨
    return handleActionError(error, "단위 삭제에 실패했습니다", {
      NOT_FOUND: "단위를 찾을 수 없습니다",
      SYSTEM_UNIT_CANNOT_DELETE: "시스템 기본 단위는 삭제할 수 없습니다",
    });
  }
}
