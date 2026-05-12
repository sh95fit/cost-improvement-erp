// src/features/meal-template/actions/meal-template.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  mealTemplateListQuerySchema,
  createMealTemplateSchema,
  updateMealTemplateSchema,
  createMealTemplateSlotSchema,
  updateMealTemplateSlotSchema,
  createMealTemplateAccessorySchema,
  updateMealTemplateAccessorySchema,
} from "../schemas/meal-template.schema";
import * as mealTemplateService from "../services/meal-template.service";

// ════════════════════════════════════════
// MealTemplate
// ════════════════════════════════════════

export async function getMealTemplatesAction(
  rawQuery: Record<string, unknown>
): Promise<
  ActionResult<{
    items: Awaited<ReturnType<typeof mealTemplateService.getMealTemplates>>["items"];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const query = mealTemplateListQuerySchema.parse(rawQuery);
    const result = await mealTemplateService.getMealTemplates(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식단 템플릿 목록 조회에 실패했습니다");
  }
}

export async function getMealTemplateByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealTemplateService.getMealTemplateById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const template = await mealTemplateService.getMealTemplateById(session.companyId, id);
    return actionOk(template);
  } catch (error) {
    return handleActionError(error, "식단 템플릿 조회에 실패했습니다");
  }
}

export async function createMealTemplateAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createMealTemplateSchema.parse(rawInput);
    const template = await mealTemplateService.createMealTemplate(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealTemplate",
      entityId: template.id,
      after: template as unknown as Record<string, unknown>,
    });
    return actionOk(template);
  } catch (error) {
    return handleActionError(error, "식단 템플릿 생성에 실패했습니다");
  }
}

export async function updateMealTemplateAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateMealTemplateSchema.parse(rawInput);
    const template = await mealTemplateService.updateMealTemplate(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealTemplate",
      entityId: id,
      after: template as unknown as Record<string, unknown>,
    });
    return actionOk(template);
  } catch (error) {
    return handleActionError(error, "식단 템플릿 수정에 실패했습니다", {
      NOT_FOUND: "식단 템플릿을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealTemplateAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await mealTemplateService.deleteMealTemplate(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealTemplate",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "식단 템플릿 삭제에 실패했습니다", {
      NOT_FOUND: "식단 템플릿을 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// MealTemplateSlot
// ════════════════════════════════════════

export async function addMealTemplateSlotAction(
  mealTemplateId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createMealTemplateSlotSchema.parse(rawInput);
    const slot = await mealTemplateService.addMealTemplateSlot(mealTemplateId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealTemplateSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 추가에 실패했습니다", {
      DUPLICATE_SLOT_INDEX: "동일한 슬롯 번호가 이미 존재합니다",
    });
  }
}

export async function updateMealTemplateSlotAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateMealTemplateSlotSchema.parse(rawInput);
    const slot = await mealTemplateService.updateMealTemplateSlot(id, input);
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 수정에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealTemplateSlotAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await mealTemplateService.deleteMealTemplateSlot(id);
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "슬롯 삭제에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// MealTemplateAccessory
// ════════════════════════════════════════

export async function addMealTemplateAccessoryAction(
  mealTemplateId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createMealTemplateAccessorySchema.parse(rawInput);
    const acc = await mealTemplateService.addMealTemplateAccessory(mealTemplateId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealTemplateAccessory",
      entityId: acc.id,
      after: acc as unknown as Record<string, unknown>,
    });
    return actionOk(acc);
  } catch (error) {
    return handleActionError(error, "악세서리 추가에 실패했습니다");
  }
}

export async function updateMealTemplateAccessoryAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateMealTemplateAccessorySchema.parse(rawInput);
    const acc = await mealTemplateService.updateMealTemplateAccessory(id, input);
    return actionOk(acc);
  } catch (error) {
    return handleActionError(error, "악세서리 수정에 실패했습니다", {
      NOT_FOUND: "악세서리를 찾을 수 없습니다",
    });
  }
}

export async function deleteMealTemplateAccessoryAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await mealTemplateService.deleteMealTemplateAccessory(id);
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "악세서리 삭제에 실패했습니다", {
      NOT_FOUND: "악세서리를 찾을 수 없습니다",
    });
  }
}
