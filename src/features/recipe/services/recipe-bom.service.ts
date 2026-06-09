// src/features/recipe/services/recipe-bom.service.ts
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

// ── include 정의 ──
const SLOT_INCLUDE = {
  subsidiaryMaster: { select: { id: true, name: true, code: true } },
  items: {
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

// ════════════════════════════════════════
// RecipeBOM
// ════════════════════════════════════════

export async function getRecipeBOMsByRecipeId(companyId: string, recipeId: string) {
  return prisma.recipeBOM.findMany({
    where: { companyId, recipeId, deletedAt: null },
    include: {
      slots: {
        include: SLOT_INCLUDE,
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { version: "desc" },
  });
}

export async function getRecipeBOMById(companyId: string, id: string) {
  const bom = await prisma.recipeBOM.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      recipe: { select: { id: true, name: true, code: true } },
      slots: {
        include: SLOT_INCLUDE,
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!bom) throw new Error("NOT_FOUND");
  return bom;
}

export async function getNextRecipeBOMVersion(companyId: string, recipeId: string): Promise<number> {
  const latest = await prisma.recipeBOM.findFirst({
    where: { companyId, recipeId, deletedAt: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function createRecipeBOM(companyId: string, input: CreateRecipeBOMInput) {
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

export async function updateRecipeBOMStatus(companyId: string, id: string, input: UpdateRecipeBOMStatusInput) {
  const bom = await prisma.recipeBOM.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!bom) throw new Error("NOT_FOUND");

  if (bom.status === "ACTIVE" && input.status === "ARCHIVED") {
    const activeCount = await prisma.recipeBOM.count({
      where: { companyId, recipeId: bom.recipeId, status: "ACTIVE", deletedAt: null },
    });
    if (activeCount <= 1) throw new Error("LAST_ACTIVE_BOM");
  }

  if (input.status === "ACTIVE") {
    return withTransaction(async (tx) => {
      await tx.recipeBOM.updateMany({
        where: { companyId, recipeId: bom.recipeId, status: "ACTIVE", deletedAt: null, id: { not: id } },
        data: { status: "ARCHIVED" },
      });
      return tx.recipeBOM.update({ where: { id }, data: { status: input.status, activatedAt: new Date() } });
    });
  }

  return prisma.recipeBOM.update({ where: { id }, data: { status: input.status } });
}

export async function updateRecipeBOMBaseWeight(companyId: string, id: string, input: UpdateRecipeBOMBaseWeightInput) {
  const bom = await prisma.recipeBOM.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!bom) throw new Error("NOT_FOUND");
  return prisma.recipeBOM.update({ where: { id }, data: { baseWeightG: input.baseWeightG } });
}

export async function deleteRecipeBOM(companyId: string, id: string) {
  const bom = await prisma.recipeBOM.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!bom) return null;
  if (bom.status === "ACTIVE") throw new Error("CANNOT_DELETE_ACTIVE");
  return prisma.recipeBOM.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function buildRecipeBOMSnapshot(companyId: string, id: string) {
  const bom = await getRecipeBOMById(companyId, id);
  return {
    id: bom.id,
    version: bom.version,
    status: bom.status,
    baseWeightG: bom.baseWeightG,
    snapshotAt: new Date().toISOString(),
    slots: bom.slots.map((slot) => ({
      subsidiaryMaster: slot.subsidiaryMaster,
      slotIndex: slot.slotIndex,
      totalWeightG: slot.totalWeightG,
      note: slot.note,
      items: slot.items.map((item) => ({
        ingredientType: item.ingredientType,
        materialMaster: item.materialMaster,
        semiProduct: item.semiProduct,
        weightG: item.weightG,
        unit: item.unit,
      })),
    })),
  };
}

// ════════════════════════════════════════
// RecipeBOMSlot
// ════════════════════════════════════════

export async function addRecipeBOMSlot(recipeBomId: string, input: CreateRecipeBOMSlotInput) {
  return prisma.recipeBOMSlot.create({
    data: { ...input, recipeBomId },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function addRecipeBOMSlotWithIngredients(recipeBomId: string, input: CreateRecipeBOMSlotInput) {
  return withTransaction(async (tx) => {
    const slot = await tx.recipeBOMSlot.create({
      data: { ...input, recipeBomId },
      include: { subsidiaryMaster: { select: { id: true, name: true, code: true } } },
    });

    const bom = await tx.recipeBOM.findUnique({ where: { id: recipeBomId }, select: { recipeId: true } });
    if (!bom) throw new Error("NOT_FOUND");

    const ingredients = await tx.recipeIngredient.findMany({
      where: { recipeId: bom.recipeId },
      orderBy: { sortOrder: "asc" },
    });

    if (ingredients.length > 0) {
      await tx.recipeBOMSlotItem.createMany({
        data: ingredients.map((ing, idx) => ({
          recipeBomSlotId: slot.id,
          ingredientType: ing.ingredientType,
          materialMasterId: ing.materialMasterId,
          semiProductId: ing.semiProductId,
          weightG: 0,
          unit: "g",
          sortOrder: idx,
        })),
      });
    }

    return tx.recipeBOMSlot.findUnique({
      where: { id: slot.id },
      include: {
        subsidiaryMaster: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            materialMaster: { select: { id: true, name: true, code: true, unit: true } },
            semiProduct: { select: { id: true, name: true, code: true, unit: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  });
}

export async function updateRecipeBOMSlot(id: string, input: UpdateRecipeBOMSlotInput) {
  return prisma.recipeBOMSlot.update({ where: { id }, data: input });
}

export async function deleteRecipeBOMSlot(id: string) {
  return withTransaction(async (tx) => {
    await tx.recipeBOMSlotItem.deleteMany({ where: { recipeBomSlotId: id } });
    return tx.recipeBOMSlot.delete({ where: { id } });
  });
}

// ════════════════════════════════════════
// RecipeBOMSlotItem
// ════════════════════════════════════════

export async function addRecipeBOMSlotItem(recipeBomSlotId: string, input: CreateRecipeBOMSlotItemInput) {
  return prisma.recipeBOMSlotItem.create({
    data: { ...input, recipeBomSlotId },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

export async function updateRecipeBOMSlotItem(id: string, input: UpdateRecipeBOMSlotItemInput) {
  return prisma.recipeBOMSlotItem.update({ where: { id }, data: input });
}

export async function deleteRecipeBOMSlotItem(id: string) {
  return prisma.recipeBOMSlotItem.delete({ where: { id } });
}

// ════════════════════════════════════════
// RecipeBOM 복제
// ════════════════════════════════════════

export async function duplicateRecipeBOM(companyId: string, sourceBomId: string) {
  const source = await getRecipeBOMById(companyId, sourceBomId);
  const nextVersion = await getNextRecipeBOMVersion(companyId, source.recipe.id);

  return withTransaction(async (tx) => {
    const newBom = await tx.recipeBOM.create({
      data: {
        companyId,
        recipeId: source.recipe.id,
        version: nextVersion,
        status: "DRAFT",
        baseWeightG: source.baseWeightG,
        activatedAt: null,
      },
    });

    for (const slot of source.slots) {
      const newSlot = await tx.recipeBOMSlot.create({
        data: {
          recipeBomId: newBom.id,
          subsidiaryMasterId: slot.subsidiaryMasterId,
          slotIndex: slot.slotIndex,
          totalWeightG: slot.totalWeightG,
          note: slot.note,
          sortOrder: slot.sortOrder,
        },
      });

      if (slot.items.length > 0) {
        await tx.recipeBOMSlotItem.createMany({
          data: slot.items.map((item) => ({
            recipeBomSlotId: newSlot.id,
            ingredientType: item.ingredientType,
            materialMasterId: item.materialMasterId,
            semiProductId: item.semiProductId,
            weightG: item.weightG,
            unit: item.unit,
            sortOrder: item.sortOrder,
          })),
        });
      }
    }

    return tx.recipeBOM.findUnique({
      where: { id: newBom.id },
      include: {
        recipe: { select: { id: true, name: true, code: true } },
        slots: {
          include: SLOT_INCLUDE,
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  });
}

// ════════════════════════════════════════════════════════════════
// Phase 7-F1: 매칭 가능 ACTIVE RecipeBOM 조회
// ────────────────────────────────────────────────────────────────
// RecipeBOMSlot은 soft delete 미사용 (schema 확인). RecipeBOM만 deletedAt 존재.
// ════════════════════════════════════════════════════════════════

export async function findMatchingActiveBom(
  recipeId: string,
  subsidiaryMasterId: string,
  containerSlotIndex: number,
): Promise<{ bomId: string; slotId: string; totalWeightG: number } | null> {
  const bom = await prisma.recipeBOM.findFirst({
    where: {
      recipeId,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      slots: {
        where: {
          subsidiaryMasterId,
          slotIndex: containerSlotIndex,
        },
        select: { id: true, totalWeightG: true },
        take: 1,
      },
    },
  });

  if (!bom) return null;
  const slot = bom.slots[0];
  if (!slot) return null;
  if (slot.totalWeightG <= 0) return null;

  return { bomId: bom.id, slotId: slot.id, totalWeightG: slot.totalWeightG };
}

export async function getEligibleRecipesForContainerSlot(
  companyId: string,
  subsidiaryMasterId: string,
  containerSlotIndex: number,
): Promise<
  { id: string; code: string; name: string; bomId: string; totalWeightG: number }[]
> {
  const boms = await prisma.recipeBOM.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      recipe: { companyId, deletedAt: null },
      slots: {
        some: {
          subsidiaryMasterId,
          slotIndex: containerSlotIndex,
          totalWeightG: { gt: 0 },
        },
      },
    },
    include: {
      recipe: { select: { id: true, code: true, name: true } },
      slots: {
        where: {
          subsidiaryMasterId,
          slotIndex: containerSlotIndex,
          totalWeightG: { gt: 0 },
        },
        select: { totalWeightG: true },
        take: 1,
      },
    },
    orderBy: { recipe: { name: "asc" } },
  });

  return boms.map((b) => ({
    id: b.recipe.id,
    code: b.recipe.code,
    name: b.recipe.name,
    bomId: b.id,
    totalWeightG: b.slots[0]?.totalWeightG ?? 0,
  }));
}

// ════════════════════════════════════════════════════════════════
// Phase 9-C-Fix-A: BOM 매칭 실패 원인 진단
// ────────────────────────────────────────────────────────────────
// findMatchingActiveBom은 boolean 매칭만 알려주지만,
// diagnoseBomMatch는 실패 원인을 3가지로 구분해 알려준다.
// 1) NO_ACTIVE_BOM    : 레시피에 ACTIVE 상태 BOM이 없음
// 2) NO_MATCHING_SLOT : ACTIVE BOM은 있으나 (용기, slotIndex) 일치 슬롯 없음
// 3) ZERO_TOTAL_WEIGHT: 매칭 슬롯은 있으나 totalWeightG <= 0
// ════════════════════════════════════════════════════════════════

export type BomMatchDiagnosis =
  | { ok: true; bomId: string; slotId: string; totalWeightG: number }
  | { ok: false; reason: "NO_ACTIVE_BOM" }
  | {
      ok: false;
      reason: "NO_MATCHING_SLOT";
      bomId: string;
      availableSlots: Array<{
        subsidiaryMasterId: string;
        subsidiaryName: string;
        slotIndex: number;
        totalWeightG: number;
      }>;
    }
  | { ok: false; reason: "ZERO_TOTAL_WEIGHT"; bomId: string; slotId: string };

export async function diagnoseBomMatch(
  recipeId: string,
  subsidiaryMasterId: string,
  containerSlotIndex: number,
): Promise<BomMatchDiagnosis> {
  const bom = await prisma.recipeBOM.findFirst({
    where: { recipeId, status: "ACTIVE", deletedAt: null },
    include: {
      slots: {
        select: {
          id: true,
          slotIndex: true,
          totalWeightG: true,
          subsidiaryMaster: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!bom) {
    return { ok: false, reason: "NO_ACTIVE_BOM" };
  }

  const exact = bom.slots.find(
    (s) =>
      s.subsidiaryMaster.id === subsidiaryMasterId &&
      s.slotIndex === containerSlotIndex,
  );

  if (!exact) {
    return {
      ok: false,
      reason: "NO_MATCHING_SLOT",
      bomId: bom.id,
      availableSlots: bom.slots.map((s) => ({
        subsidiaryMasterId: s.subsidiaryMaster.id,
        subsidiaryName: s.subsidiaryMaster.name,
        slotIndex: s.slotIndex,
        totalWeightG: s.totalWeightG,
      })),
    };
  }

  if (exact.totalWeightG <= 0) {
    return {
      ok: false,
      reason: "ZERO_TOTAL_WEIGHT",
      bomId: bom.id,
      slotId: exact.id,
    };
  }

  return {
    ok: true,
    bomId: bom.id,
    slotId: exact.id,
    totalWeightG: exact.totalWeightG,
  };
}