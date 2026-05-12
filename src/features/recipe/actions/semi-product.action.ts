// src/features/recipe/actions/semi-product.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createSemiProductSchema,
  updateSemiProductSchema,
  semiProductListQuerySchema,
} from "../schemas/recipe.schema";
import * as semiProductService from "../services/semi-product.service";
import type { SemiProduct } from "@prisma/client";

export async function getSemiProductsAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof semiProductService.getSemiProducts>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const query = semiProductListQuerySchema.parse(rawQuery);
    const result = await semiProductService.getSemiProducts(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "반제품 목록 조회에 실패했습니다");
  }
}

export async function getSemiProductByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof semiProductService.getSemiProductById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const semiProduct = await semiProductService.getSemiProductById(session.companyId, id);
    return actionOk(semiProduct);
  } catch (error) {
    return handleActionError(error, "반제품 조회에 실패했습니다");
  }
}

export async function createSemiProductAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<SemiProduct>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createSemiProductSchema.parse(rawInput);
    const semiProduct = await semiProductService.createSemiProduct(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "SemiProduct",
      entityId: semiProduct.id,
      after: semiProduct as unknown as Record<string, unknown>,
    });
    return actionOk(semiProduct);
  } catch (error) {
    return handleActionError(error, "반제품 생성에 실패했습니다");
  }
}

export async function updateSemiProductAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SemiProduct>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateSemiProductSchema.parse(rawInput);
    const existing = await semiProductService.getSemiProductById(session.companyId, id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "반제품 수정에 실패했습니다", { NOT_FOUND: "반제품을 찾을 수 없습니다" });
    const before = existing as unknown as Record<string, unknown>;
    const semiProduct = await semiProductService.updateSemiProduct(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "SemiProduct",
      entityId: semiProduct.id,
      before,
      after: semiProduct as unknown as Record<string, unknown>,
    });
    return actionOk(semiProduct);
  } catch (error) {
    return handleActionError(error, "반제품 수정에 실패했습니다");
  }
}

export async function deleteSemiProductAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const existing = await semiProductService.getSemiProductById(session.companyId, id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "반제품 삭제에 실패했습니다", { NOT_FOUND: "반제품을 찾을 수 없습니다" });
    await semiProductService.deleteSemiProduct(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "SemiProduct",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "반제품 삭제에 실패했습니다");
  }
}
