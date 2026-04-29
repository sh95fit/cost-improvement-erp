"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  createRecipeSchema,
  updateRecipeSchema,
  createRecipeVariantSchema,
  updateRecipeVariantSchema,
  createSemiProductSchema,
  updateSemiProductSchema,
  createBOMSchema,
  updateBOMStatusSchema,
  createBOMItemSchema,
  updateBOMItemSchema,
  recipeListQuerySchema,
  semiProductListQuerySchema,
} from "../schemas/recipe.schema";
import * as recipeService from "../services/recipe.service";
import * as semiProductService from "../services/semi-product.service";
import * as bomService from "../services/bom.service";
import type { Recipe, SemiProduct } from "@prisma/client";

// ════════════════════════════════════════
// Recipe Actions
// ════════════════════════════════════════

// ── 레시피 목록 조회 ──
export async function getRecipesAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof recipeService.getRecipes>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const query = recipeListQuerySchema.parse(rawQuery);
    const result = await recipeService.getRecipes(session.companyId, query);

    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 목록 조회에 실패했습니다");
  }
}

// ── 레시피 단건 조회 ──
export async function getRecipeByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof recipeService.getRecipeById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const recipe = await recipeService.getRecipeById(session.companyId, id);
    return actionOk(recipe);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 조회에 실패했습니다");
  }
}

// ── 레시피 생성 ──
export async function createRecipeAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<Recipe>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");

    const input = createRecipeSchema.parse(rawInput);
    const recipe = await recipeService.createRecipe(session.companyId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "Recipe",
      entityId: recipe.id,
      after: recipe as unknown as Record<string, unknown>,
    });

    return actionOk(recipe);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 생성에 실패했습니다");
  }
}

// ── 레시피 수정 ──
export async function updateRecipeAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<Recipe>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = updateRecipeSchema.parse(rawInput);

    const existing = await recipeService.getRecipeById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "레시피를 찾을 수 없습니다");
    }

    const before = existing as unknown as Record<string, unknown>;
    const recipe = await recipeService.updateRecipe(session.companyId, id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "Recipe",
      entityId: recipe.id,
      before,
      after: recipe as unknown as Record<string, unknown>,
    });

    return actionOk(recipe);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 수정에 실패했습니다");
  }
}

// ── 레시피 삭제 ──
export async function deleteRecipeAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");

    const existing = await recipeService.getRecipeById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "레시피를 찾을 수 없습니다");
    }

    await recipeService.deleteRecipe(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "Recipe",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// RecipeVariant Actions
// ════════════════════════════════════════

// ── 변형 목록 조회 ──
export async function getVariantsByRecipeIdAction(
  recipeId: string
): Promise<ActionResult<Awaited<ReturnType<typeof recipeService.getVariantsByRecipeId>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const variants = await recipeService.getVariantsByRecipeId(recipeId);
    return actionOk(variants);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "변형 목록 조회에 실패했습니다");
  }
}

// ── 변형 생성 ──
export async function createVariantAction(
  recipeId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");

    const input = createRecipeVariantSchema.parse(rawInput);
    const variant = await recipeService.createVariant(recipeId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeVariant",
      entityId: variant.id,
      after: variant as unknown as Record<string, unknown>,
    });

    return actionOk(variant);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "변형 생성에 실패했습니다");
  }
}

// ── 변형 수정 ──
export async function updateVariantAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = updateRecipeVariantSchema.parse(rawInput);
    const variant = await recipeService.updateVariant(id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeVariant",
      entityId: variant.id,
      after: variant as unknown as Record<string, unknown>,
    });

    return actionOk(variant);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "변형 수정에 실패했습니다");
  }
}

// ── 변형 삭제 ──
export async function deleteVariantAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");

    await recipeService.deleteVariant(id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "RecipeVariant",
      entityId: id,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "변형 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// SemiProduct Actions
// ════════════════════════════════════════

// ── 반제품 목록 조회 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "반제품 목록 조회에 실패했습니다");
  }
}

// ── 반제품 생성 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "반제품 생성에 실패했습니다");
  }
}

// ── 반제품 수정 ──
export async function updateSemiProductAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SemiProduct>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = updateSemiProductSchema.parse(rawInput);

    const existing = await semiProductService.getSemiProductById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "반제품을 찾을 수 없습니다");
    }

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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "반제품 수정에 실패했습니다");
  }
}

// ── 반제품 삭제 ──
export async function deleteSemiProductAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");

    const existing = await semiProductService.getSemiProductById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "반제품을 찾을 수 없습니다");
    }

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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "반제품 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// BOM Actions
// ════════════════════════════════════════

// ── BOM 조회 (owner별) ──
export async function getBOMsByOwnerAction(
  ownerType: "RECIPE_VARIANT" | "SEMI_PRODUCT",
  ownerId: string
): Promise<ActionResult<Awaited<ReturnType<typeof bomService.getBOMsByOwner>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const boms = await bomService.getBOMsByOwner(session.companyId, ownerType, ownerId);
    return actionOk(boms);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 조회에 실패했습니다");
  }
}

// ── BOM 단건 조회 ──
export async function getBOMByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof bomService.getBOMById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const bom = await bomService.getBOMById(session.companyId, id);
    return actionOk(bom);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 조회에 실패했습니다");
  }
}

// ── BOM 생성 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 생성에 실패했습니다");
  }
}

// ── BOM 상태 변경 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 상태 변경에 실패했습니다");
  }
}

// ── BOM 삭제 ──
export async function deleteBOMAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");

    const existing = await bomService.getBOMById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "BOM을 찾을 수 없습니다");
    }

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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 삭제에 실패했습니다");
  }
}

// ── BOMItem 추가 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 항목 추가에 실패했습니다");
  }
}

// ── BOMItem 수정 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 항목 수정에 실패했습니다");
  }
}

// ── BOMItem 삭제 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 항목 삭제에 실패했습니다");
  }
}

// ── BOMItem 일괄 저장 ──
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 항목 일괄 저장에 실패했습니다");
  }
}

// ── BOM 자동 버전 채번 생성 ──
export async function createBOMWithAutoVersionAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");

    const input = createBOMSchema.parse(rawInput);

    // 자동 버전 계산
    const ownerType = input.ownerType as "RECIPE_VARIANT" | "SEMI_PRODUCT";
    const ownerId = ownerType === "RECIPE_VARIANT"
      ? input.recipeVariantId!
      : input.semiProductId!;
    const nextVersion = await bomService.getNextBOMVersion(
      session.companyId,
      ownerType,
      ownerId
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 생성에 실패했습니다");
  }
}
