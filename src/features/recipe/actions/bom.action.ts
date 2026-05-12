// src/features/recipe/actions/bom.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createBOMSchema,
  updateBOMStatusSchema,
  createBOMItemSchema,
  updateBOMItemSchema,
} from "../schemas/recipe.schema";
import * as bomService from "../services/bom.service";

// ════════════════════════════════════════
// BOM Actions (반제품 전용)
// ════════════════════════════════════════

export async function getBOMsBySemiProductAction(
  semiProductId: string
): Promise<ActionResult<Awaited<ReturnType<typeof bomService.getBOMsBySemiProduct>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const boms = await bomService.getBOMsBySemiProduct(session.companyId, semiProductId);
    return actionOk(boms);
  } catch (error) {
    return handleActionError(error, "BOM 조회에 실패했습니다");
  }
}

export async function getBOMByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof bomService.getBOMById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const bom = await bomService.getBOMById(session.companyId, id);
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "BOM 조회에 실패했습니다");
  }
}

export async function createBOMAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createBOMSchema.parse(rawInput);
    const bom = await bomService.createBOM(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "BOM",
      entityId: bom.id,
      after: bom as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "BOM 생성에 실패했습니다");
  }
}

export async function createBOMWithAutoVersionAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createBOMSchema.parse(rawInput);
    const nextVersion = await bomService.getNextBOMVersion(
      session.companyId,
      input.semiProductId
    );
    const bom = await bomService.createBOM(session.companyId, {
      ...input,
      version: nextVersion,
    });
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "BOM",
      entityId: bom.id,
      after: bom as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "BOM 생성에 실패했습니다");
  }
}

export async function updateBOMStatusAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateBOMStatusSchema.parse(rawInput);
    const bom = await bomService.updateBOMStatus(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "STATUS_CHANGE",
      entityType: "BOM",
      entityId: bom.id,
      after: { status: bom.status } as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    return handleActionError(error, "BOM 상태 변경에 실패했습니다", {
      NOT_FOUND: "BOM을 찾을 수 없습니다",
      LAST_ACTIVE_BOM: "마지막 사용중 BOM은 보관할 수 없습니다.",
    });
  }
}

export async function deleteBOMAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const existing = await bomService.getBOMById(session.companyId, id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "BOM 삭제에 실패했습니다", { NOT_FOUND: "BOM을 찾을 수 없습니다" });
    await bomService.deleteBOM(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "BOM",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "BOM 삭제에 실패했습니다", {
      CANNOT_DELETE_ACTIVE: "사용중인 BOM은 삭제할 수 없습니다.",
    });
  }
}

export async function addBOMItemAction(
  bomId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createBOMItemSchema.parse(rawInput);
    const item = await bomService.addBOMItem(bomId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "BOMItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });
    return actionOk(item);
  } catch (error) {
    return handleActionError(error, "BOM 항목 추가에 실패했습니다");
  }
}

export async function updateBOMItemAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateBOMItemSchema.parse(rawInput);
    const item = await bomService.updateBOMItem(id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "BOMItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });
    return actionOk(item);
  } catch (error) {
    return handleActionError(error, "BOM 항목 수정에 실패했습니다");
  }
}

export async function deleteBOMItemAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await bomService.deleteBOMItem(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "BOMItem",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "BOM 항목 삭제에 실패했습니다");
  }
}

export async function replaceBOMItemsAction(
  bomId: string,
  rawItems: Record<string, unknown>[]
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const items = rawItems.map((raw) => createBOMItemSchema.parse(raw));
    const result = await bomService.replaceBOMItems(bomId, items);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "BOM",
      entityId: bomId,
      after: { itemCount: result.length } as unknown as Record<string, unknown>,
    });
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "BOM 항목 일괄 저장에 실패했습니다");
  }
}
