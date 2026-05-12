// src/features/unit-conversion/actions/unit-conversion.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createUnitConversionSchema,
  updateUnitConversionSchema,
  unitConversionListQuerySchema,
} from "../schemas/unit-conversion.schema";
import * as conversionService from "../services/unit-conversion.service";

export async function getUnitConversionsAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "READ");
    const query = unitConversionListQuerySchema.parse(rawQuery);
    const result = await conversionService.getUnitConversions(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "단위 환산 목록 조회에 실패했습니다");
  }
}

export async function createUnitConversionAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "CREATE");
    const input = createUnitConversionSchema.parse(rawInput);
    const duplicate = await conversionService.findDuplicateConversion(
      session.companyId,
      input.materialMasterId,
      input.subsidiaryMasterId,
      input.fromUnit,
      input.toUnit
    );
    if (duplicate) return actionFail("DUPLICATE_CONVERSION", "이미 등록된 단위 환산입니다");
    const conversion = await conversionService.createUnitConversion(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "UnitConversion",
      entityId: conversion.id,
      after: conversion as unknown as Record<string, unknown>,
    });
    return actionOk(conversion);
  } catch (error) {
    return handleActionError(error, "단위 환산 생성에 실패했습니다");
  }
}

export async function updateUnitConversionAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "UPDATE");
    const input = updateUnitConversionSchema.parse(rawInput);
    const existing = await conversionService.getUnitConversionById(id);
    if (!existing) return actionFail("NOT_FOUND", "단위 환산을 찾을 수 없습니다");
    const before = existing as unknown as Record<string, unknown>;
    const conversion = await conversionService.updateUnitConversion(id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "UnitConversion",
      entityId: conversion.id,
      before,
      after: conversion as unknown as Record<string, unknown>,
    });
    return actionOk(conversion);
  } catch (error) {
    return handleActionError(error, "단위 환산 수정에 실패했습니다");
  }
}

export async function deleteUnitConversionAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "DELETE");
    const existing = await conversionService.getUnitConversionById(id);
    if (!existing) return actionFail("NOT_FOUND", "단위 환산을 찾을 수 없습니다");
    await conversionService.deleteUnitConversion(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "UnitConversion",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "단위 환산 삭제에 실패했습니다");
  }
}
