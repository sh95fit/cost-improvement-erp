import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateRecipeBOMInput,
  UpdateRecipeBOMStatusInput,
  UpdateRecipeBOMBaseWeightInput,
  CreateRecipeBOMSlotInput,
  UpdateRecipeBOMSlotInput,
  CreateRecipeBOMSlotItemInput,
  UpdateRecipeBOMSlotItemInput,
} from "../schemas/recipe.schema";

// ════════════════════════════════════════
// RecipeBOM
// ════════════════════════════════════════

// ── RecipeBOM 목록 조회 (레시피별) ──
export async function getRecipeBOMsByRecipeId(
  companyId: string,
  recipeId: string
) {
  return prisma.recipeBOM.findMany({
    where: { companyId, recipeId, deletedAt: null },
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
  });
}

// ── RecipeBOM 단건 조회 ──
export async function getRecipeBOMById(companyId: string, id: string) {
  const bom = await prisma.recipeBOM.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      recipe: { select: { id: true, name: true, code: true } },
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
  });

  if (!bom) throw new Error("NOT_FOUND");
  return bom;
}

// ── RecipeBOM 다음 버전 번호 ──
export async function getNextRecipeBOMVersion(
  companyId: string,
  recipeId: string
): Promise<number> {
  const latest = await prisma.recipeBOM.findFirst({
    where: { companyId, recipeId, deletedAt: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

// ── RecipeBOM 생성 ──
export async function createRecipeBOM(
  companyId: string,
  input: CreateRecipeBOMInput
) {
  return prisma.recipeBOM.create({
    data: {
      companyId,
      recipeId: input.recipeId,
      version: input.version,
      status: input.status,
      baseWeightG: input.baseWeightG,
    },
  });
}

// ── RecipeBOM 상태 변경 (ACTIVE 중복 방지) ──
export async function updateRecipeBOMStatus(
  companyId: string,
  id: string,
  input: UpdateRecipeBOMStatusInput
) {
  const bom = await prisma.recipeBOM.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!bom) throw new Error("NOT_FOUND");

  if (input.status === "ACTIVE") {
    return withTransaction(async (tx) => {
      // 같은 레시피의 기존 ACTIVE BOM을 ARCHIVED로 전환
      await tx.recipeBOM.updateMany({
        where: {
          companyId,
          recipeId: bom.recipeId,
          status: "ACTIVE",
          deletedAt: null,
          id: { not: id },
        },
        data: { status: "ARCHIVED" },
      });

      return tx.recipeBOM.update({
        where: { id },
        data: { status: input.status },
      });
    });
  }

  return prisma.recipeBOM.update({
    where: { id },
    data: { status: input.status },
  });
}

// ── RecipeBOM 기준 중량 변경 ──
export async function updateRecipeBOMBaseWeight(
  companyId: string,
  id: string,
  input: UpdateRecipeBOMBaseWeightInput
) {
  const bom = await prisma.recipeBOM.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!bom) throw new Error("NOT_FOUND");

  return prisma.recipeBOM.update({
    where: { id },
    data: { baseWeightG: input.baseWeightG },
  });
}

// ── RecipeBOM 삭제 (soft-delete) ──
export async function deleteRecipeBOM(companyId: string, id: string) {
  const bom = await prisma.recipeBOM.findFirst({
    where: { id, companyId, deletedAt: null },
  });

  if (!bom) return null;

  return prisma.recipeBOM.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ════════════════════════════════════════
// RecipeBOMSlot
// ════════════════════════════════════════

// ── 슬롯 추가 ──
export async function addRecipeBOMSlot(
  recipeBomId: string,
  input: CreateRecipeBOMSlotInput
) {
  return prisma.recipeBOMSlot.create({
    data: {
      ...input,
      recipeBomId,
    },
    include: {
      containerGroup: { select: { id: true, name: true, code: true } },
    },
  });
}

// ── 슬롯 수정 ──
export async function updateRecipeBOMSlot(
  id: string,
  input: UpdateRecipeBOMSlotInput
) {
  return prisma.recipeBOMSlot.update({
    where: { id },
    data: input,
  });
}

// ── 슬롯 삭제 (하위 아이템도 삭제) ──
export async function deleteRecipeBOMSlot(id: string) {
  return withTransaction(async (tx) => {
    await tx.recipeBOMSlotItem.deleteMany({
      where: { recipeBomSlotId: id },
    });
    return tx.recipeBOMSlot.delete({
      where: { id },
    });
  });
}

// ════════════════════════════════════════
// RecipeBOMSlotItem
// ════════════════════════════════════════

// ── 슬롯 아이템 추가 ──
export async function addRecipeBOMSlotItem(
  recipeBomSlotId: string,
  input: CreateRecipeBOMSlotItemInput
) {
  return prisma.recipeBOMSlotItem.create({
    data: {
      ...input,
      recipeBomSlotId,
    },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

// ── 슬롯 아이템 수정 ──
export async function updateRecipeBOMSlotItem(
  id: string,
  input: UpdateRecipeBOMSlotItemInput
) {
  return prisma.recipeBOMSlotItem.update({
    where: { id },
    data: input,
  });
}

// ── 슬롯 아이템 삭제 ──
export async function deleteRecipeBOMSlotItem(id: string) {
  return prisma.recipeBOMSlotItem.delete({
    where: { id },
  });
}
