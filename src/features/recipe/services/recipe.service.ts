import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  CreateRecipeVariantInput,
  UpdateRecipeVariantInput,
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
        variants: {
          where: { deletedAt: null },
          select: { id: true, variantName: true, servings: true },
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
  return prisma.recipe.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      variants: {
        where: { deletedAt: null },
        include: {
          boms: {
            where: { deletedAt: null },
            include: {
              items: {
                include: {
                  materialMaster: { select: { id: true, name: true, code: true, unit: true } },
                  subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });
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

// ── 레시피 삭제 (soft-delete + 연관 Variant, BOM cascade) ──
export async function deleteRecipe(companyId: string, id: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { variants: { where: { deletedAt: null }, select: { id: true } } },
  });

  if (!recipe) return null;

  return withTransaction(async (tx) => {
    const variantIds = recipe.variants.map((v) => v.id);
    if (variantIds.length > 0) {
      // 변형에 연결된 BOM soft-delete
      await tx.bOM.updateMany({
        where: {
          recipeVariantId: { in: variantIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      // 변형 soft-delete
      await tx.recipeVariant.updateMany({
        where: {
          id: { in: variantIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    // 레시피 soft-delete
    return tx.recipe.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}

// ════════════════════════════════════════
// RecipeVariant
// ════════════════════════════════════════

// ── 변형 목록 조회 (레시피별) ──
export async function getVariantsByRecipeId(recipeId: string) {
  return prisma.recipeVariant.findMany({
    where: { recipeId, deletedAt: null },
    include: {
      boms: {
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, version: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ── 변형 단건 조회 ──
export async function getVariantById(id: string) {
  return prisma.recipeVariant.findFirst({
    where: { id, deletedAt: null },
    include: {
      recipe: { select: { id: true, name: true, code: true, companyId: true } },
      boms: {
        where: { deletedAt: null },
        include: {
          items: {
            include: {
              materialMaster: { select: { id: true, name: true, code: true, unit: true } },
              subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { version: "desc" },
      },
    },
  });
}

// ── 변형 생성 ──
export async function createVariant(
  recipeId: string,
  input: CreateRecipeVariantInput
) {
  return prisma.recipeVariant.create({
    data: {
      ...input,
      recipeId,
    },
  });
}

// ── 변형 수정 ──
export async function updateVariant(id: string, input: UpdateRecipeVariantInput) {
  return prisma.recipeVariant.update({
    where: { id },
    data: input,
  });
}

// ── 변형 삭제 (soft-delete + 연관 BOM cascade) ──
export async function deleteVariant(id: string) {
  return withTransaction(async (tx) => {
    // 연결된 BOM들을 soft-delete 처리
    await tx.bOM.updateMany({
      where: { recipeVariantId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // RecipeVariant soft-delete
    return tx.recipeVariant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}
