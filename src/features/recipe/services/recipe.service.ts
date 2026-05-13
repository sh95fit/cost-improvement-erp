// src/features/recipe/services/recipe.service.ts
import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
  RecipeListQuery,
} from "../schemas/recipe.schema";

async function generateRecipeCode(companyId: string): Promise<string> {
  const lastRecipe = await prisma.recipe.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  if (!lastRecipe) return "RCP-001";
  const match = lastRecipe.code.match(/^RCP-(\d+)$/);
  if (!match) return "RCP-001";
  const nextNumber = parseInt(match[1], 10) + 1;
  return `RCP-${String(nextNumber).padStart(3, "0")}`;
}

export async function getRecipes(companyId: string, query: RecipeListQuery) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: {
        ingredients: {
          select: { id: true, ingredientType: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
        recipeBoms: {
          where: { deletedAt: null },
          select: { id: true, version: true, status: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.recipe.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getRecipeById(companyId: string, id: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      ingredients: {
        include: {
          materialMaster: { select: { id: true, name: true, code: true, unit: true } },
          semiProduct: { select: { id: true, name: true, code: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      recipeBoms: {
        where: { deletedAt: null },
        include: {
          slots: {
            include: {
              // ★ v5: containerGroup → subsidiaryMaster
              subsidiaryMaster: { select: { id: true, name: true, code: true } },
              items: {
                include: {
                  materialMaster: { select: { id: true, name: true, code: true, unit: true } },
                  semiProduct: { select: { id: true, name: true, code: true, unit: true } },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { version: "desc" },
      },
    },
  });

  if (!recipe) return null;
  return recipe;
}

export async function getRecipeByCode(companyId: string, code: string) {
  return prisma.recipe.findFirst({ where: { companyId, code, deletedAt: null } });
}

export async function createRecipe(companyId: string, input: CreateRecipeInput) {
  const code = await generateRecipeCode(companyId);
  return prisma.recipe.create({ data: { ...input, companyId, code } });
}

export async function updateRecipe(companyId: string, id: string, input: UpdateRecipeInput) {
  return prisma.recipe.update({ where: { id }, data: input });
}

export async function deleteRecipe(companyId: string, id: string) {
  const recipe = await prisma.recipe.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!recipe) return null;

  return withTransaction(async (tx) => {
    await tx.recipeBOM.updateMany({
      where: { recipeId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
    return tx.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}

// ════════════════════════════════════════
// RecipeIngredient
// ════════════════════════════════════════

export async function getIngredientsByRecipeId(recipeId: string) {
  return prisma.recipeIngredient.findMany({
    where: { recipeId },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addIngredient(recipeId: string, input: CreateRecipeIngredientInput) {
  return prisma.recipeIngredient.create({
    data: { ...input, recipeId },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

export async function updateIngredient(id: string, input: UpdateRecipeIngredientInput) {
  return prisma.recipeIngredient.update({ where: { id }, data: input });
}

export async function deleteIngredient(id: string) {
  return prisma.recipeIngredient.delete({ where: { id } });
}
