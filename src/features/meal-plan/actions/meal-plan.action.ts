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
  createMealPlanSchema,
  updateMealPlanSchema,
  createMealPlanSlotSchema,
  updateMealPlanSlotSchema,
} from "../schemas/meal-plan.schema";
import * as mealPlanService from "../services/meal-plan.service";

// ════════════════════════════════════════
// MealPlanGroup
// ════════════════════════════════════════

export async function getMealPlanGroupsAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof mealPlanService.getMealPlanGroups>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const query = mealPlanGroupListQuerySchema.parse(rawQuery);
    const result = await mealPlanService.getMealPlanGroups(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식단 그룹 목록 조회에 실패했습니다");
  }
}

export async function getMealPlanGroupByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanGroupById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const group = await mealPlanService.getMealPlanGroupById(session.companyId, id);
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 조회에 실패했습니다");
  }
}

export async function createMealPlanGroupAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = createMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.createMealPlanGroup(session.companyId, input);
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
      P2002: "동일 날짜/라인업의 식단 그룹이 이미 존재합니다",
    });
  }
}

export async function updateMealPlanGroupAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.updateMealPlanGroup(session.companyId, id, input);
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
  id: string
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
  sourceId: string,
  targetDate: string,
  targetLineupId?: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const group = await mealPlanService.copyMealPlanGroup(
      session.companyId,
      sourceId,
      targetDate,
      targetLineupId
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanGroup",
      entityId: group?.id ?? "",
      after: { copiedFrom: sourceId, targetDate } as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 복사에 실패했습니다", {
      NOT_FOUND: "원본 식단 그룹을 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// MealPlan
// ════════════════════════════════════════

export async function getMealPlansByGroupAction(
  mealPlanGroupId: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlansByGroup>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const plans = await mealPlanService.getMealPlansByGroup(mealPlanGroupId);
    return actionOk(plans);
  } catch (error) {
    return handleActionError(error, "식단 목록 조회에 실패했습니다");
  }
}

export async function createMealPlanAction(
  mealPlanGroupId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = createMealPlanSchema.parse(rawInput);
    const plan = await mealPlanService.createMealPlan(mealPlanGroupId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlan",
      entityId: plan.id,
      after: plan as unknown as Record<string, unknown>,
    });
    return actionOk(plan);
  } catch (error) {
    return handleActionError(error, "식단 생성에 실패했습니다");
  }
}

export async function updateMealPlanAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanSchema.parse(rawInput);
    const plan = await mealPlanService.updateMealPlan(id, input);
    return actionOk(plan);
  } catch (error) {
    return handleActionError(error, "식단 수정에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlan(id);
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

// ════════════════════════════════════════
// MealPlanSlot
// ════════════════════════════════════════

export async function getMealPlanSlotsAction(
  mealPlanId: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanSlots>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const slots = await mealPlanService.getMealPlanSlots(mealPlanId);
    return actionOk(slots);
  } catch (error) {
    return handleActionError(error, "슬롯 목록 조회에 실패했습니다");
  }
}

export async function createMealPlanSlotAction(
  mealPlanId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = createMealPlanSlotSchema.parse(rawInput);
    const slot = await mealPlanService.createMealPlanSlot(mealPlanId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 추가에 실패했습니다");
  }
}

export async function updateMealPlanSlotAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanSlotSchema.parse(rawInput);
    const slot = await mealPlanService.updateMealPlanSlot(id, input);
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 수정에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanSlotAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlanSlot(id);
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
