import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
  RecipeListQuery,
} from "../schemas/recipe.schema";

// ── 레시피 코드 자동 생성 (RCP-001, RCP-002, ...) ──
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

// ── 레시피 목록 조회 (페이지네이션 + 검색) ──
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
          where: { deletedAt: null },  // ★ status: "ACTIVE" 조건 제거
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── 레시피 단건 조회 ──
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
              containerGroup: { select: { id: true, name: true, code: true } },
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

// ── 레시피 코드 중복 확인 ──
export async function getRecipeByCode(companyId: string, code: string) {
  return prisma.recipe.findFirst({
    where: { companyId, code, deletedAt: null },
  });
}

// ── 레시피 생성 (코드 자동 채번) ──
export async function createRecipe(companyId: string, input: CreateRecipeInput) {
  const code = await generateRecipeCode(companyId);

  return prisma.recipe.create({
    data: {
      ...input,
      companyId,
      code,
    },
  });
}

// ── 레시피 수정 ──
export async function updateRecipe(
  companyId: string,
  id: string,
  input: UpdateRecipeInput
) {
  return prisma.recipe.update({
    where: { id },
    data: input,
  });
}

// ── 레시피 삭제 (soft-delete + 연관 RecipeBOM cascade) ──
export async function deleteRecipe(companyId: string, id: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id, companyId, deletedAt: null },
  });

  if (!recipe) return null;

  return withTransaction(async (tx) => {
    // 연결된 RecipeBOM들을 soft-delete 처리
    await tx.recipeBOM.updateMany({
      where: { recipeId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // 연결된 RecipeIngredient 삭제 (hard delete - 메타데이터)
    await tx.recipeIngredient.deleteMany({
      where: { recipeId: id },
    });

    // 레시피 soft-delete
    return tx.recipe.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}

// ════════════════════════════════════════
// RecipeIngredient (신규)
// ════════════════════════════════════════

// ── 재료 목록 조회 (레시피별) ──
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

// ── 재료 추가 ──
export async function addIngredient(
  recipeId: string,
  input: CreateRecipeIngredientInput
) {
  return prisma.recipeIngredient.create({
    data: {
      ...input,
      recipeId,
    },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

// ── 재료 수정 ──
export async function updateIngredient(
  id: string,
  input: UpdateRecipeIngredientInput
) {
  return prisma.recipeIngredient.update({
    where: { id },
    data: input,
  });
}

// ── 재료 삭제 ──
export async function deleteIngredient(id: string) {
  return prisma.recipeIngredient.delete({
    where: { id },
  });
}
