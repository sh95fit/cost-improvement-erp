// src/features/recipe/services/recipe.service.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
  RecipeListQuery,
} from "../schemas/recipe.schema";

// Phase 9-C-Fix-B: soft-delete된 레시피도 포함해 채번 충돌 방지.
// 추가로 RCP-숫자 패턴에 맞는 모든 코드 중 최댓값+1을 사용 (정렬 의존 제거).
async function generateRecipeCode(companyId: string): Promise<string> {
  // ★ Phase 9-C-Fix-B2: soft-delete extension의 자동 필터를 우회하기 위해 raw SQL 사용.
  //    extension이 findMany에 deletedAt IS NULL을 자동 주입하여,
  //    soft-deleted 레시피의 code가 보이지 않아 채번 충돌이 무한 반복되는 문제 해결.
  const rows = await prisma.$queryRaw<Array<{ code: string }>>`
    SELECT code FROM recipes
    WHERE company_id = ${companyId}
      AND code LIKE 'RCP-%'
  `;

  let maxNumber = 0;
  for (const r of rows) {
    const m = r.code.match(/^RCP-(\d+)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > maxNumber) maxNumber = n;
  }

  const next = maxNumber + 1;
  return `RCP-${String(next).padStart(3, "0")}`;
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

// Phase 9-C-Fix-B: 채번 충돌(P2002) 시 최대 5회 재시도.
// race condition 또는 채번 누락 케이스에서 자동 복구.
export async function createRecipe(companyId: string, input: CreateRecipeInput) {
  const MAX_ATTEMPTS = 5;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = await generateRecipeCode(companyId);
    try {
      return await prisma.recipe.create({
        data: { ...input, companyId, code },
      });
    } catch (e) {
      lastError = e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        console.warn(
          `[createRecipe] P2002 attempt=${attempt + 1} code=${code} target=`,
          e.meta?.target,
        );
        continue; // 다음 루프에서 generateRecipeCode가 다시 호출되어 새 max 기준 채번
      }
      console.error(`[createRecipe] non-P2002 attempt=${attempt + 1}:`, e);
      throw e;
    }
  }

  // 5회 시도 모두 실패 — 진짜 비정상 상태
  throw new Error("RECIPE_CODE_GENERATION_FAILED");
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
