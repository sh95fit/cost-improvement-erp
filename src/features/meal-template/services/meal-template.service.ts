// src/features/meal-template/services/meal-template.service.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  CreateMealTemplateInput,
  UpdateMealTemplateInput,
  MealTemplateListQuery,
  CreateMealTemplateContainerInput,
  UpdateMealTemplateContainerInput,
  CreateMealTemplateAccessoryInput,
  UpdateMealTemplateAccessoryInput,
} from "../schemas/meal-template.schema";

// ════════════════════════════════════════
// MealTemplate CRUD
// ════════════════════════════════════════

const TEMPLATE_INCLUDE = {
  containers: {
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  accessories: {
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
    orderBy: { id: "asc" as const },  // ★ createdAt → id (MealTemplateAccessory에 createdAt 없음)
  },
  _count: { select: { containers: true, accessories: true } },
} as const;

export async function getMealTemplates(companyId: string, query: MealTemplateListQuery) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.MealTemplateWhereInput = { companyId };

  if (search) {
    where.OR = [{ name: { contains: search, mode: "insensitive" } }];
  }

  const [items, total] = await Promise.all([
    prisma.mealTemplate.findMany({
      where,
      include: TEMPLATE_INCLUDE,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.mealTemplate.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getMealTemplateById(companyId: string, id: string) {
  return prisma.mealTemplate.findFirst({
    where: { id, companyId },
    include: TEMPLATE_INCLUDE,
  });
}

export async function createMealTemplate(companyId: string, input: CreateMealTemplateInput) {
  return prisma.mealTemplate.create({
    data: { companyId, name: input.name },
    include: TEMPLATE_INCLUDE,
  });
}

export async function updateMealTemplate(companyId: string, id: string, input: UpdateMealTemplateInput) {
  const existing = await prisma.mealTemplate.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplate.update({
    where: { id },
    data: input,
    include: TEMPLATE_INCLUDE,
  });
}

export async function deleteMealTemplate(companyId: string, id: string) {
  const existing = await prisma.mealTemplate.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    await tx.mealTemplateAccessory.deleteMany({ where: { mealTemplateId: id } });
    await tx.mealTemplateContainer.deleteMany({ where: { mealTemplateId: id } });
    return tx.mealTemplate.delete({ where: { id } });
  });
}

// ════════════════════════════════════════
// MealTemplateContainer (★ v5: MealTemplateSlot 대체)
// ════════════════════════════════════════

export async function addMealTemplateContainer(mealTemplateId: string, input: CreateMealTemplateContainerInput) {
  return prisma.mealTemplateContainer.create({
    data: {
      mealTemplateId,
      subsidiaryMasterId: input.subsidiaryMasterId,
      sortOrder: input.sortOrder,
    },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateMealTemplateContainer(id: string, input: UpdateMealTemplateContainerInput) {
  const existing = await prisma.mealTemplateContainer.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplateContainer.update({
    where: { id },
    data: input,
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteMealTemplateContainer(id: string) {
  const existing = await prisma.mealTemplateContainer.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");
  return prisma.mealTemplateContainer.delete({ where: { id } });
}

// ════════════════════════════════════════
// MealTemplateAccessory (★ v5: subsidiaryMasterId 기반)
// ════════════════════════════════════════

export async function addMealTemplateAccessory(mealTemplateId: string, input: CreateMealTemplateAccessoryInput) {
  return prisma.mealTemplateAccessory.create({
    data: {
      mealTemplateId,
      subsidiaryMasterId: input.subsidiaryMasterId,
      consumptionType: input.consumptionType,
      fixedQuantity: input.fixedQuantity,
      isRequired: input.isRequired,
    },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateMealTemplateAccessory(id: string, input: UpdateMealTemplateAccessoryInput) {
  const existing = await prisma.mealTemplateAccessory.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplateAccessory.update({
    where: { id },
    data: input,
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteMealTemplateAccessory(id: string) {
  const existing = await prisma.mealTemplateAccessory.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");
  return prisma.mealTemplateAccessory.delete({ where: { id } });
}
