// src/features/meal-plan/actions/meal-plan.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  mealPlanGroupListQuerySchema,
  createMealPlanGroupSchema,
  updateMealPlanGroupSchema,
  copyMealPlanGroupSchema,
  createMealPlanSchema,
  updateMealPlanSchema,
  createMealPlanSlotSchema,
  updateMealPlanSlotSchema,
  reorderMealPlanSlotsSchema,
  upsertMealCountSchema,
  bulkUpsertMealCountSchema,
  createMealPlanAccessorySchema,
  updateMealPlanAccessorySchema,
  applyMealTemplateSchema,
} from "../schemas/meal-plan.schema";
import * as mealPlanService from "../services/meal-plan.service";

// ══════════════════════════════════════════════════════════════
// MealPlanGroup
// ══════════════════════════════════════════════════════════════

export async function getMealPlanGroupsAction(
  rawQuery: Record<string, unknown>,
): Promise<
  ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanGroups>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const query = mealPlanGroupListQuerySchema.parse(rawQuery);
    const result = await mealPlanService.getMealPlanGroups(
      session.companyId,
      query,
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식단 그룹 목록 조회에 실패했습니다");
  }
}

export async function getMealPlanGroupByIdAction(
  id: string,
): Promise<
  ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanGroupById>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const group = await mealPlanService.getMealPlanGroupById(
      session.companyId,
      id,
    );
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 조회에 실패했습니다");
  }
}

export async function createMealPlanGroupAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = createMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.createMealPlanGroup(
      session.companyId,
      input,
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanGroup",
      entityId: group.id,
      after: group as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 생성에 실패했습니다", {
      DUPLICATE_PLAN_DATE: "동일 날짜의 식단 그룹이 이미 존재합니다",
    });
  }
}

export async function updateMealPlanGroupAction(
  id: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.updateMealPlanGroup(
      session.companyId,
      id,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlanGroup",
      entityId: id,
      after: group as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 수정에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanGroupAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlanGroup(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlanGroup",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "식단 그룹 삭제에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
    });
  }
}

export async function copyMealPlanGroupAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = copyMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.copyMealPlanGroup(
      session.companyId,
      input,
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanGroup",
      entityId: group?.id ?? "",
      after: {
        copiedFrom: input.sourceMealPlanGroupId,
        targetPlanDate: input.targetPlanDate,
      } as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 복사에 실패했습니다", {
      NOT_FOUND: "원본 식단 그룹을 찾을 수 없습니다",
      DUPLICATE_PLAN_DATE: "대상 날짜에 이미 식단 그룹이 존재합니다",
    });
  }
}

// ══════════════════════════════════════════════════════════════
// MealPlan
// ══════════════════════════════════════════════════════════════

export async function getMealPlansByGroupAction(
  mealPlanGroupId: string,
): Promise<
  ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlansByGroup>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const plans = await mealPlanService.getMealPlansByGroup(
      session.companyId,
      mealPlanGroupId,
    );
    return actionOk(plans);
  } catch (error) {
    return handleActionError(error, "식단 목록 조회에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
    });
  }
}

export async function createMealPlanAction(
  mealPlanGroupId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = createMealPlanSchema.parse(rawInput);
    const plan = await mealPlanService.createMealPlan(
      session.companyId,
      mealPlanGroupId,
      input,
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlan",
      entityId: plan.id,
      after: plan as unknown as Record<string, unknown>,
    });
    return actionOk(plan);
  } catch (error) {
    return handleActionError(error, "식단 생성에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
      LINEUP_NOT_FOUND: "라인업을 찾을 수 없습니다",
      DUPLICATE_MEAL_PLAN: "동일 식사타입/라인업의 식단이 이미 존재합니다",
      COMPANY_MEAL_SLOT_NOT_FOUND: "해당 슬롯을 찾을 수 없습니다",
      SLOT_TYPE_REQUIRED: "식사 타입 또는 슬롯을 선택하세요",
    });
  }
}

export async function updateMealPlanAction(
  id: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanSchema.parse(rawInput);
    const plan = await mealPlanService.updateMealPlan(
      session.companyId,
      id,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlan",
      entityId: id,
      after: plan as unknown as Record<string, unknown>,
    });
    return actionOk(plan);
  } catch (error) {
    return handleActionError(error, "식단 수정에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlan(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlan",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "식단 삭제에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

// ══════════════════════════════════════════════════════════════
// MealPlanSlot
// ══════════════════════════════════════════════════════════════

export async function getMealPlanSlotsAction(
  mealPlanId: string,
): Promise<
  ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanSlots>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const slots = await mealPlanService.getMealPlanSlots(
      session.companyId,
      mealPlanId,
    );
    return actionOk(slots);
  } catch (error) {
    return handleActionError(error, "슬롯 목록 조회에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

export async function createMealPlanSlotAction(
  mealPlanId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = createMealPlanSlotSchema.parse(rawInput);
    const slot = await mealPlanService.createMealPlanSlot(
      session.companyId,
      mealPlanId,
      input,
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 추가에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
      PRODUCTION_LINE_NOT_FOUND: "생산 라인을 찾을 수 없습니다",
      SUBSIDIARY_NOT_FOUND: "부자재(용기)를 찾을 수 없습니다",
      RECIPE_NOT_FOUND: "레시피를 찾을 수 없습니다",
      SUPPLIER_ITEM_NOT_FOUND: "공급사 품목을 찾을 수 없습니다",
    });
  }
}

export async function updateMealPlanSlotAction(
  id: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanSlotSchema.parse(rawInput);
    const slot = await mealPlanService.updateMealPlanSlot(
      session.companyId,
      id,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlanSlot",
      entityId: id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 수정에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
      SLOT_KIND_MISMATCH:
        "슬롯 종류는 변경할 수 없습니다 (삭제 후 재생성 필요)",
      PRODUCTION_LINE_NOT_FOUND: "생산 라인을 찾을 수 없습니다",
      SUBSIDIARY_NOT_FOUND: "부자재(용기)를 찾을 수 없습니다",
      RECIPE_NOT_FOUND: "레시피를 찾을 수 없습니다",
      SUPPLIER_ITEM_NOT_FOUND: "공급사 품목을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanSlotAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlanSlot(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlanSlot",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "슬롯 삭제에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
    });
  }
}

export async function reorderMealPlanSlotsAction(
  mealPlanId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = reorderMealPlanSlotsSchema.parse(rawInput);
    const result = await mealPlanService.reorderMealPlanSlots(
      session.companyId,
      mealPlanId,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlanSlot",
      entityId: mealPlanId,
      after: { reordered: input.items.length } as unknown as Record<
        string,
        unknown
      >,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "슬롯 재정렬에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
      SLOT_NOT_FOUND: "일부 슬롯을 찾을 수 없습니다",
    });
  }
}

// ══════════════════════════════════════════════════════════════
// MealCount
// ══════════════════════════════════════════════════════════════

export async function getMealCountsAction(
  mealPlanGroupId: string,
): Promise<
  ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealCounts>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const counts = await mealPlanService.getMealCounts(
      session.companyId,
      mealPlanGroupId,
    );
    return actionOk(counts);
  } catch (error) {
    return handleActionError(error, "식수 조회에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
    });
  }
}

export async function upsertMealCountAction(
  mealPlanGroupId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = upsertMealCountSchema.parse(rawInput);
    const result = await mealPlanService.upsertMealCount(
      session.companyId,
      mealPlanGroupId,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealCount",
      entityId: result.id,
      after: result as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식수 저장에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
      LINEUP_NOT_FOUND: "라인업을 찾을 수 없습니다",
      COMPANY_MEAL_SLOT_NOT_FOUND: "해당 슬롯을 찾을 수 없습니다",
      SLOT_TYPE_REQUIRED: "식사 타입 또는 슬롯을 선택하세요",
    });
  }
}

export async function bulkUpsertMealCountAction(
  mealPlanGroupId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = bulkUpsertMealCountSchema.parse(rawInput);
    const result = await mealPlanService.bulkUpsertMealCount(
      session.companyId,
      mealPlanGroupId,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealCount",
      entityId: mealPlanGroupId,
      after: { count: result.length } as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식수 일괄 저장에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
      LINEUP_NOT_FOUND: "일부 라인업을 찾을 수 없습니다",
      COMPANY_MEAL_SLOT_NOT_FOUND: "일부 슬롯을 찾을 수 없습니다",
      SLOT_TYPE_REQUIRED: "식사 타입 또는 슬롯을 선택하세요",
    });
  }
}

export async function deleteMealCountAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealCount(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealCount",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "식수 삭제에 실패했습니다", {
      NOT_FOUND: "식수 항목을 찾을 수 없습니다",
    });
  }
}

// ══════════════════════════════════════════════════════════════
// MealPlanAccessory
// ══════════════════════════════════════════════════════════════

export async function getMealPlanAccessoriesAction(
  mealPlanId: string,
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof mealPlanService.getMealPlanAccessories>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const items = await mealPlanService.getMealPlanAccessories(
      session.companyId,
      mealPlanId,
    );
    return actionOk(items);
  } catch (error) {
    return handleActionError(error, "부자재 조회에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

export async function createMealPlanAccessoryAction(
  mealPlanId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = createMealPlanAccessorySchema.parse(rawInput);
    const result = await mealPlanService.createMealPlanAccessory(
      session.companyId,
      mealPlanId,
      input,
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanAccessory",
      entityId: result.id,
      after: result as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "부자재 추가에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
      SUBSIDIARY_NOT_FOUND: "부자재를 찾을 수 없습니다",
      FIXED_QUANTITY_REQUIRED: "고정수량 모드에서는 수량이 필수입니다",
    });
  }
}

export async function updateMealPlanAccessoryAction(
  id: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanAccessorySchema.parse(rawInput);
    const result = await mealPlanService.updateMealPlanAccessory(
      session.companyId,
      id,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlanAccessory",
      entityId: id,
      after: result as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "부자재 수정에 실패했습니다", {
      NOT_FOUND: "부자재 항목을 찾을 수 없습니다",
      SUBSIDIARY_NOT_FOUND: "부자재를 찾을 수 없습니다",
      FIXED_QUANTITY_REQUIRED: "고정수량 모드에서는 수량이 필수입니다",
    });
  }
}

export async function deleteMealPlanAccessoryAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlanAccessory(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlanAccessory",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "부자재 삭제에 실패했습니다", {
      NOT_FOUND: "부자재 항목을 찾을 수 없습니다",
    });
  }
}

// ══════════════════════════════════════════════════════════════
// applyMealTemplate
// ══════════════════════════════════════════════════════════════

export async function applyMealTemplateAction(
  mealPlanId: string,
  rawInput: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = applyMealTemplateSchema.parse(rawInput);
    const result = await mealPlanService.applyMealTemplate(
      session.companyId,
      mealPlanId,
      input,
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlan",
      entityId: mealPlanId,
      after: {
        appliedTemplate: input.mealTemplateId,
        replaceExisting: input.replaceExisting,
      } as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식단 템플릿 적용에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
      MEAL_TEMPLATE_NOT_FOUND: "식단 템플릿을 찾을 수 없습니다",
    });
  }
}
