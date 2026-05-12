// src/features/meal-template/services/meal-template.service.ts
import { prisma } from "@/lib/prisma";
import type {
  CreateMealTemplateInput,
  UpdateMealTemplateInput,
  MealTemplateListQuery,
  CreateMealTemplateSlotInput,
  UpdateMealTemplateSlotInput,
  CreateMealTemplateAccessoryInput,
  UpdateMealTemplateAccessoryInput,
} from "../schemas/meal-template.schema";

// ════════════════════════════════════════
// MealTemplate CRUD
// ════════════════════════════════════════

const TEMPLATE_INCLUDE = {
  containerGroup: { select: { id: true, name: true, code: true } },
  slots: { orderBy: { slotIndex: "asc" as const } },
  accessories: { orderBy: { name: "asc" as const } },
  _count: { select: { slots: true, accessories: true } },
};

export async function getMealTemplates(
  companyId: string,
  query: MealTemplateListQuery
) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { companyId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { containerGroup: { name: { contains: search, mode: "insensitive" } } },
    ];
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getMealTemplateById(companyId: string, id: string) {
  return prisma.mealTemplate.findFirst({
    where: { id, companyId },
    include: TEMPLATE_INCLUDE,
  });
}

export async function createMealTemplate(
  companyId: string,
  input: CreateMealTemplateInput
) {
  return prisma.mealTemplate.create({
    data: {
      companyId,
      name: input.name,
      containerGroupId: input.containerGroupId,
    },
    include: TEMPLATE_INCLUDE,
  });
}

export async function updateMealTemplate(
  companyId: string,
  id: string,
  input: UpdateMealTemplateInput
) {
  const existing = await prisma.mealTemplate.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplate.update({
    where: { id },
    data: input,
    include: TEMPLATE_INCLUDE,
  });
}

export async function deleteMealTemplate(companyId: string, id: string) {
  const existing = await prisma.mealTemplate.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new Error("NOT_FOUND");

  // 연관 슬롯·악세서리 함께 삭제 (트랜잭션)
  return prisma.$transaction(async (tx) => {
    await tx.mealTemplateAccessory.deleteMany({
      where: { mealTemplateId: id },
    });
    await tx.mealTemplateSlot.deleteMany({
      where: { mealTemplateId: id },
    });
    return tx.mealTemplate.delete({ where: { id } });
  });
}

// ════════════════════════════════════════
// MealTemplateSlot CRUD
// ════════════════════════════════════════

export async function addMealTemplateSlot(
  mealTemplateId: string,
  input: CreateMealTemplateSlotInput
) {
  return prisma.mealTemplateSlot.create({
    data: {
      mealTemplateId,
      slotIndex: input.slotIndex,
      label: input.label,
      isRequired: input.isRequired,
    },
  });
}

export async function updateMealTemplateSlot(
  id: string,
  input: UpdateMealTemplateSlotInput
) {
  const existing = await prisma.mealTemplateSlot.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplateSlot.update({
    where: { id },
    data: input,
  });
}

export async function deleteMealTemplateSlot(id: string) {
  const existing = await prisma.mealTemplateSlot.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplateSlot.delete({ where: { id } });
}

// ════════════════════════════════════════
// MealTemplateAccessory CRUD
// ════════════════════════════════════════

export async function addMealTemplateAccessory(
  mealTemplateId: string,
  input: CreateMealTemplateAccessoryInput
) {
  return prisma.mealTemplateAccessory.create({
    data: {
      mealTemplateId,
      name: input.name,
      isRequired: input.isRequired,
    },
  });
}

export async function updateMealTemplateAccessory(
  id: string,
  input: UpdateMealTemplateAccessoryInput
) {
  const existing = await prisma.mealTemplateAccessory.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplateAccessory.update({
    where: { id },
    data: input,
  });
}

export async function deleteMealTemplateAccessory(id: string) {
  const existing = await prisma.mealTemplateAccessory.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealTemplateAccessory.delete({ where: { id } });
}
