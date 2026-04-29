"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  createRecipeSchema,
  updateRecipeSchema,
  createRecipeIngredientSchema,
  updateRecipeIngredientSchema,
  createSemiProductSchema,
  updateSemiProductSchema,
  createBOMSchema,
  updateBOMStatusSchema,
  createBOMItemSchema,
  updateBOMItemSchema,
  createRecipeBOMSchema,
  updateRecipeBOMStatusSchema,
  updateRecipeBOMBaseWeightSchema,
  createRecipeBOMSlotSchema,
  updateRecipeBOMSlotSchema,
  createRecipeBOMSlotItemSchema,
  updateRecipeBOMSlotItemSchema,
  recipeListQuerySchema,
  semiProductListQuerySchema,
} from "../schemas/recipe.schema";
import * as recipeService from "../services/recipe.service";
import * as recipeBomService from "../services/recipe-bom.service";
import * as semiProductService from "../services/semi-product.service";
import * as bomService from "../services/bom.service";
import type { Recipe, SemiProduct } from "@prisma/client";

// ════════════════════════════════════════
// Recipe Actions
// ════════════════════════════════════════

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

export async function updateRecipeAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<Recipe>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateRecipeSchema.parse(rawInput);
    const existing = await recipeService.getRecipeById(session.companyId, id);
    if (!existing) return actionFail("NOT_FOUND", "레시피를 찾을 수 없습니다");
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

export async function deleteRecipeAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const existing = await recipeService.getRecipeById(session.companyId, id);
    if (!existing) return actionFail("NOT_FOUND", "레시피를 찾을 수 없습니다");
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
// RecipeIngredient Actions
// ════════════════════════════════════════

export async function getIngredientsByRecipeIdAction(
  recipeId: string
): Promise<ActionResult<Awaited<ReturnType<typeof recipeService.getIngredientsByRecipeId>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const ingredients = await recipeService.getIngredientsByRecipeId(recipeId);
    return actionOk(ingredients);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "재료 목록 조회에 실패했습니다");
  }
}

export async function addIngredientAction(
  recipeId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createRecipeIngredientSchema.parse(rawInput);
    const ingredient = await recipeService.addIngredient(recipeId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeIngredient",
      entityId: ingredient.id,
      after: ingredient as unknown as Record<string, unknown>,
    });
    return actionOk(ingredient);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "재료 추가에 실패했습니다");
  }
}

export async function updateIngredientAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateRecipeIngredientSchema.parse(rawInput);
    const ingredient = await recipeService.updateIngredient(id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeIngredient",
      entityId: ingredient.id,
      after: ingredient as unknown as Record<string, unknown>,
    });
    return actionOk(ingredient);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "재료 수정에 실패했습니다");
  }
}

export async function deleteIngredientAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await recipeService.deleteIngredient(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "RecipeIngredient",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "재료 삭제에 실패했습니다");
  }
}

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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 BOM 조회에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "레시피 BOM을 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 BOM 조회에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 BOM 생성에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 BOM 생성에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "레시피 BOM을 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 BOM 상태 변경에 실패했습니다");
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
    const bom = await recipeBomService.updateRecipeBOMBaseWeight(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeBOM",
      entityId: bom.id,
      after: { baseWeightG: bom.baseWeightG } as unknown as Record<string, unknown>,
    });
    return actionOk(bom);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "레시피 BOM을 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "기준 중량 변경에 실패했습니다");
  }
}

export async function deleteRecipeBOMAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const result = await recipeBomService.deleteRecipeBOM(session.companyId, id);
    if (!result) return actionFail("NOT_FOUND", "레시피 BOM을 찾을 수 없습니다");
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "RecipeBOM",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "레시피 BOM 삭제에 실패했습니다");
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
    const slot = await recipeBomService.addRecipeBOMSlot(recipeBomId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "RecipeBOMSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 추가에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 수정에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 삭제에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 아이템 추가에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 아이템 수정에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 아이템 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// SemiProduct Actions
// ════════════════════════════════════════

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

export async function getSemiProductByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof semiProductService.getSemiProductById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const semiProduct = await semiProductService.getSemiProductById(session.companyId, id);
    return actionOk(semiProduct);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "반제품 조회에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "반제품 생성에 실패했습니다");
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
    if (!existing) return actionFail("NOT_FOUND", "반제품을 찾을 수 없습니다");
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

export async function deleteSemiProductAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const existing = await semiProductService.getSemiProductById(session.companyId, id);
    if (!existing) return actionFail("NOT_FOUND", "반제품을 찾을 수 없습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 조회에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 조회에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 생성에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 생성에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "BOM 상태 변경에 실패했습니다");
  }
}

export async function deleteBOMAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const existing = await bomService.getBOMById(session.companyId, id);
    if (!existing) return actionFail("NOT_FOUND", "BOM을 찾을 수 없습니다");
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
