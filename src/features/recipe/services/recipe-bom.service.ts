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
