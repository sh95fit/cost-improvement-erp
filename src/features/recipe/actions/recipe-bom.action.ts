// src/features/recipe/actions/recipe-bom.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createRecipeBOMSchema,
  updateRecipeBOMStatusSchema,
  updateRecipeBOMBaseWeightSchema,
  createRecipeBOMSlotSchema,
  updateRecipeBOMSlotSchema,
  createRecipeBOMSlotItemSchema,
  updateRecipeBOMSlotItemSchema,
} from "../schemas/recipe.schema";
import * as recipeBomService from "../services/recipe-bom.service";

// ════════════════════════════════════════
// RecipeBOM Actions
// ════════════════════════════════════════

export async function getRecipeBOMsByRecipeIdAction(
  recipeId: string
): Promise<ActionResult<Awaited<ReturnType<typeof recipeBomService.getRecipeBOMsByRecipeId>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const boms = await recipeBomService.getRecipeBOMsByRecipeId(session.companyId, recipeId);
    return actionOk(boms);
  } catch (error) {
    return handleActionError(error, "레시피 BOM 조회에 실패했습니다");
  }
}

export async function getRecipeBOMByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof recipeBomService.getRecipeBOMById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const bom = await recipeBomService.getRecipeBOMById(session.companyId, id);
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "레시피 BOM 조회에 실패했습니다", {
      NOT_FOUND: "레시피 BOM을 찾을 수 없습니다",
    });
  }
}

export async function createRecipeBOMAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createRecipeBOMSchema.parse(rawInput);
    const bom = await recipeBomService.createRecipeBOM(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeBOM",
      entityId: bom.id,
      after: bom as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "레시피 BOM 생성에 실패했습니다");
  }
}

export async function createRecipeBOMWithAutoVersionAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createRecipeBOMSchema.parse(rawInput);
    const nextVersion = await recipeBomService.getNextRecipeBOMVersion(
      session.companyId,
      input.recipeId
    );
    const bom = await recipeBomService.createRecipeBOM(session.companyId, {
      ...input,
      version: nextVersion,
    });
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeBOM",
      entityId: bom.id,
      after: bom as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "레시피 BOM 생성에 실패했습니다");
  }
}

export async function updateRecipeBOMStatusAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateRecipeBOMStatusSchema.parse(rawInput);
    const bom = await recipeBomService.updateRecipeBOMStatus(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "STATUS_CHANGE",
      entityType: "RecipeBOM",
      entityId: bom.id,
      after: { status: bom.status } as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "레시피 BOM 상태 변경에 실패했습니다", {
      NOT_FOUND: "레시피 BOM을 찾을 수 없습니다",
      LAST_ACTIVE_BOM: "마지막 사용중 BOM은 보관할 수 없습니다. 다른 BOM을 먼저 확정해주세요.",
    });
  }
}

export async function updateRecipeBOMBaseWeightAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateRecipeBOMBaseWeightSchema.parse(rawInput);
    const before = await recipeBomService.buildRecipeBOMSnapshot(session.companyId, id);
    const bom = await recipeBomService.updateRecipeBOMBaseWeight(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeBOM",
      entityId: bom.id,
      before: before as unknown as Record<string, unknown>,
      after: { baseWeightG: bom.baseWeightG } as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "기준 중량 변경에 실패했습니다", {
      NOT_FOUND: "레시피 BOM을 찾을 수 없습니다",
    });
  }
}

export async function deleteRecipeBOMAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const result = await recipeBomService.deleteRecipeBOM(session.companyId, id);
    if (!result) return handleActionError(new Error("NOT_FOUND"), "레시피 BOM 삭제에 실패했습니다", { NOT_FOUND: "레시피 BOM을 찾을 수 없습니다" });
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "RecipeBOM",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "레시피 BOM 삭제에 실패했습니다", {
      CANNOT_DELETE_ACTIVE: "사용중인 BOM은 삭제할 수 없습니다.",
    });
  }
}

// ════════════════════════════════════════
// RecipeBOMSlot Actions
// ════════════════════════════════════════

export async function addRecipeBOMSlotAction(
  recipeBomId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createRecipeBOMSlotSchema.parse(rawInput);
    const slot = await recipeBomService.addRecipeBOMSlotWithIngredients(recipeBomId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeBOMSlot",
      entityId: slot?.id ?? "",
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 추가에 실패했습니다");
  }
}

export async function updateRecipeBOMSlotAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateRecipeBOMSlotSchema.parse(rawInput);
    const slot = await recipeBomService.updateRecipeBOMSlot(id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeBOMSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 수정에 실패했습니다");
  }
}

export async function deleteRecipeBOMSlotAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await recipeBomService.deleteRecipeBOMSlot(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "RecipeBOMSlot",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "슬롯 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// RecipeBOMSlotItem Actions
// ════════════════════════════════════════

export async function addRecipeBOMSlotItemAction(
  recipeBomSlotId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createRecipeBOMSlotItemSchema.parse(rawInput);
    const item = await recipeBomService.addRecipeBOMSlotItem(recipeBomSlotId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeBOMSlotItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });
    return actionOk(item);
  } catch (error) {
    return handleActionError(error, "슬롯 아이템 추가에 실패했습니다");
  }
}

export async function updateRecipeBOMSlotItemAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateRecipeBOMSlotItemSchema.parse(rawInput);
    const item = await recipeBomService.updateRecipeBOMSlotItem(id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeBOMSlotItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });
    return actionOk(item);
  } catch (error) {
    return handleActionError(error, "슬롯 아이템 수정에 실패했습니다");
  }
}

export async function deleteRecipeBOMSlotItemAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await recipeBomService.deleteRecipeBOMSlotItem(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "RecipeBOMSlotItem",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "슬롯 아이템 삭제에 실패했습니다");
  }
}

// ── RecipeBOM 복제 ──
export async function duplicateRecipeBOMAction(
  sourceBomId: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const newBom = await recipeBomService.duplicateRecipeBOM(
      session.companyId,
      sourceBomId
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeBOM",
      entityId: newBom?.id ?? "",
      after: { duplicatedFrom: sourceBomId, version: newBom?.version } as unknown as Record<string, unknown>,
    });
    return actionOk(newBom);
  } catch (error) {
    return handleActionError(error, "BOM 복제에 실패했습니다", {
      NOT_FOUND: "원본 BOM을 찾을 수 없습니다",
    });
  }
}
