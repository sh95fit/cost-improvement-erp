// src/features/recipe/actions/recipe.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createRecipeSchema,
  updateRecipeSchema,
  createRecipeIngredientSchema,
  updateRecipeIngredientSchema,
  recipeListQuerySchema,
} from "../schemas/recipe.schema";
import * as recipeService from "../services/recipe.service";
import type { Recipe } from "@prisma/client";

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
    return handleActionError(error, "레시피 목록 조회에 실패했습니다");
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
    return handleActionError(error, "레시피 조회에 실패했습니다");
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
    return handleActionError(error, "레시피 생성에 실패했습니다");
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
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "레시피 수정에 실패했습니다", { NOT_FOUND: "레시피를 찾을 수 없습니다" });
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
    return handleActionError(error, "레시피 수정에 실패했습니다");
  }
}

export async function deleteRecipeAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    const existing = await recipeService.getRecipeById(session.companyId, id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "레시피 삭제에 실패했습니다", { NOT_FOUND: "레시피를 찾을 수 없습니다" });
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
    return handleActionError(error, "레시피 삭제에 실패했습니다");
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
    return handleActionError(error, "재료 목록 조회에 실패했습니다");
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
    return handleActionError(error, "재료 추가에 실패했습니다");
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
    return handleActionError(error, "재료 수정에 실패했습니다");
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
    return handleActionError(error, "재료 삭제에 실패했습니다");
  }
}
