import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateServingSetInput,
  UpdateServingSetStatusInput,
  CreateServingSetItemInput,
  UpdateServingSetItemInput,
} from "../schemas/recipe.schema";

// ── ServingSet 목록 조회 (변형별) ──
export async function getServingSetsByVariant(
  companyId: string,
  recipeVariantId: string
) {
  return prisma.servingSet.findMany({
    where: { companyId, recipeVariantId, deletedAt: null },
    include: {
      items: {
        include: {
          containerGroup: {
            select: {
              id: true,
              name: true,
              code: true,
              slots: {
                select: { slotIndex: true, label: true },
                orderBy: { slotIndex: "asc" },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { version: "desc" }],
  });
}

// ── ServingSet 단건 조회 ──
export async function getServingSetById(companyId: string, id: string) {
  return prisma.servingSet.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      recipeVariant: {
        select: { id: true, variantName: true, baseWeightG: true },
      },
      items: {
        include: {
          containerGroup: {
            select: {
              id: true,
              name: true,
              code: true,
              slots: {
                select: { slotIndex: true, label: true },
                orderBy: { slotIndex: "asc" },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ── 다음 버전 번호 조회 ──
export async function getNextServingSetVersion(
  companyId: string,
  recipeVariantId: string
): Promise<number> {
  const latest = await prisma.servingSet.findFirst({
    where: { companyId, recipeVariantId, deletedAt: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

// ── ServingSet 생성 ──
export async function createServingSet(
  companyId: string,
  input: CreateServingSetInput
) {
  return prisma.servingSet.create({
    data: {
      ...input,
      companyId,
    },
  });
}

// ── ServingSet 상태 변경 (ACTIVE 중복 방지) ──
export async function updateServingSetStatus(
  companyId: string,
  id: string,
  input: UpdateServingSetStatusInput
) {
  const set = await prisma.servingSet.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!set) throw new Error("NOT_FOUND");

  if (input.status === "ACTIVE") {
    return withTransaction(async (tx) => {
      // 같은 변형의 기존 ACTIVE를 ARCHIVED로
      await tx.servingSet.updateMany({
        where: {
          companyId,
          recipeVariantId: set.recipeVariantId,
          status: "ACTIVE",
          deletedAt: null,
          id: { not: id },
        },
        data: { status: "ARCHIVED" },
      });

      return tx.servingSet.update({
        where: { id },
        data: { status: input.status },
      });
    });
  }

  return prisma.servingSet.update({
    where: { id },
    data: { status: input.status },
  });
}

// ── ServingSet 삭제 (soft-delete) ──
export async function deleteServingSet(companyId: string, id: string) {
  const set = await prisma.servingSet.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!set) return null;

  return prisma.servingSet.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ════════════════════════════════════════
// ServingSetItem
// ════════════════════════════════════════

// ── 아이템 추가 ──
export async function addServingSetItem(
  servingSetId: string,
  input: CreateServingSetItemInput
) {
  return prisma.servingSetItem.create({
    data: {
      ...input,
      servingSetId,
    },
    include: {
      containerGroup: {
        select: {
          id: true,
          name: true,
          code: true,
          slots: {
            select: { slotIndex: true, label: true },
            orderBy: { slotIndex: "asc" },
          },
        },
      },
    },
  });
}

// ── 아이템 수정 (중량 인라인 편집) ──
export async function updateServingSetItem(
  id: string,
  input: UpdateServingSetItemInput
) {
  return prisma.servingSetItem.update({
    where: { id },
    data: input,
  });
}

// ── 아이템 삭제 ──
export async function deleteServingSetItem(id: string) {
  return prisma.servingSetItem.delete({
    where: { id },
  });
}

// ── RecipeVariant baseWeightG 업데이트 ──
export async function updateVariantBaseWeight(
  id: string,
  baseWeightG: number | null
) {
  return prisma.recipeVariant.update({
    where: { id },
    data: { baseWeightG },
  });
}
