// src/features/meal-plan/services/meal-plan.service.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  MealPlanGroupListQuery,
  CreateMealPlanGroupInput,
  UpdateMealPlanGroupInput,
  CreateMealPlanInput,
  UpdateMealPlanInput,
  CreateMealPlanSlotInput,
  UpdateMealPlanSlotInput,
} from "../schemas/meal-plan.schema";

// ══════════════════════════════════════════
// Include 상수
// ══════════════════════════════════════════

const GROUP_LIST_INCLUDE = {
  lineup: { select: { id: true, name: true, code: true } },
  _count: { select: { mealPlans: true } },
} as const;

const GROUP_DETAIL_INCLUDE = {
  lineup: { select: { id: true, name: true, code: true } },
  mealPlans: {
    include: {
      slots: {
        include: {
          recipe: { select: { id: true, name: true, code: true } },
        },
        orderBy: { slotIndex: "asc" as const },
      },
      accessories: {
        include: {
          subsidiaryMaster: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { slotType: "asc" as const },
  },
  mealCounts: true,
} as const;

const MEAL_PLAN_INCLUDE = {
  slots: {
    include: {
      recipe: { select: { id: true, name: true, code: true } },
    },
    orderBy: { slotIndex: "asc" as const },
  },
  accessories: {
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

// ══════════════════════════════════════════
// MealPlanGroup CRUD
// ══════════════════════════════════════════

export async function getMealPlanGroups(
  companyId: string,
  query: MealPlanGroupListQuery
) {
  const { page, limit, search, status, lineupId, dateFrom, dateTo, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.MealPlanGroupWhereInput = { companyId };

  if (status) where.status = status;
  if (lineupId) where.lineupId = lineupId;

  // 날짜 범위 필터
  if (dateFrom || dateTo) {
    where.planDate = {};
    if (dateFrom) where.planDate.gte = new Date(dateFrom);
    if (dateTo) where.planDate.lte = new Date(dateTo);
  }

  // 검색: lineup 이름 기준
  if (search) {
    where.lineup = {
      name: { contains: search, mode: "insensitive" },
    };
  }

  const [items, total] = await Promise.all([
    prisma.mealPlanGroup.findMany({
      where,
      include: GROUP_LIST_INCLUDE,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.mealPlanGroup.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getMealPlanGroupById(companyId: string, id: string) {
  return prisma.mealPlanGroup.findFirst({
    where: { id, companyId },
    include: GROUP_DETAIL_INCLUDE,
  });
}

export async function createMealPlanGroup(
  companyId: string,
  input: CreateMealPlanGroupInput
) {
  return prisma.mealPlanGroup.create({
    data: {
      companyId,
      lineupId: input.lineupId,
      planDate: new Date(input.planDate),
    },
    include: GROUP_DETAIL_INCLUDE,
  });
}

export async function updateMealPlanGroup(
  companyId: string,
  id: string,
  input: UpdateMealPlanGroupInput
) {
  const existing = await prisma.mealPlanGroup.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanGroup.update({
    where: { id },
    data: input,
    include: GROUP_DETAIL_INCLUDE,
  });
}

export async function deleteMealPlanGroup(companyId: string, id: string) {
  const existing = await prisma.mealPlanGroup.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new Error("NOT_FOUND");

  // 트랜잭션으로 하위 엔티티 일괄 삭제
  return prisma.$transaction(async (tx) => {
    // 1. MealPlanSlot 삭제 (MealPlan 하위)
    const mealPlans = await tx.mealPlan.findMany({
      where: { mealPlanGroupId: id },
      select: { id: true },
    });
    const mealPlanIds = mealPlans.map((mp) => mp.id);

    if (mealPlanIds.length > 0) {
      await tx.mealPlanSlot.deleteMany({
        where: { mealPlanId: { in: mealPlanIds } },
      });
      await tx.mealPlanAccessory.deleteMany({
        where: { mealPlanId: { in: mealPlanIds } },
      });
    }

    // 2. MealPlan 삭제
    await tx.mealPlan.deleteMany({ where: { mealPlanGroupId: id } });

    // 3. MealCount 삭제
    await tx.mealCount.deleteMany({ where: { mealPlanGroupId: id } });

    // 4. MealPlanGroup 삭제
    return tx.mealPlanGroup.delete({ where: { id } });
  });
}

// ── 날짜 기간 식단 복사 ──
export async function copyMealPlanGroup(
  companyId: string,
  sourceId: string,
  targetDate: string,
  targetLineupId?: string
) {
  const source = await prisma.mealPlanGroup.findFirst({
    where: { id: sourceId, companyId },
    include: {
      mealPlans: {
        include: {
          slots: true,
          accessories: true,
        },
      },
    },
  });

  if (!source) throw new Error("NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    // 그룹 생성
    const newGroup = await tx.mealPlanGroup.create({
      data: {
        companyId,
        lineupId: targetLineupId ?? source.lineupId,
        planDate: new Date(targetDate),
      },
    });

    // 하위 MealPlan + MealPlanSlot + MealPlanAccessory 복사
    for (const mp of source.mealPlans) {
      const newPlan = await tx.mealPlan.create({
        data: {
          mealPlanGroupId: newGroup.id,
          slotType: mp.slotType,
          mealTemplateId: mp.mealTemplateId,
        },
      });

      if (mp.slots.length > 0) {
        await tx.mealPlanSlot.createMany({
          data: mp.slots.map((s) => ({
            mealPlanId: newPlan.id,
            slotIndex: s.slotIndex,
            recipeId: s.recipeId,
            recipeBomId: s.recipeBomId,
            quantity: s.quantity,
            note: s.note,
          })),
        });
      }

      if (mp.accessories.length > 0) {
        await tx.mealPlanAccessory.createMany({
          data: mp.accessories.map((a) => ({
            mealPlanId: newPlan.id,
            subsidiaryMasterId: a.subsidiaryMasterId,
            quantity: a.quantity,
          })),
        });
      }
    }

    // 생성된 그룹 반환 (상세 include)
    return tx.mealPlanGroup.findFirst({
      where: { id: newGroup.id },
      include: GROUP_DETAIL_INCLUDE,
    });
  });
}

// ══════════════════════════════════════════
// MealPlan CRUD
// ══════════════════════════════════════════

export async function getMealPlansByGroup(mealPlanGroupId: string) {
  return prisma.mealPlan.findMany({
    where: { mealPlanGroupId },
    include: MEAL_PLAN_INCLUDE,
    orderBy: { slotType: "asc" },
  });
}

export async function createMealPlan(
  mealPlanGroupId: string,
  input: CreateMealPlanInput
) {
  return prisma.mealPlan.create({
    data: {
      mealPlanGroupId,
      slotType: input.slotType,
      mealTemplateId: input.mealTemplateId,
    },
    include: MEAL_PLAN_INCLUDE,
  });
}

export async function updateMealPlan(id: string, input: UpdateMealPlanInput) {
  const existing = await prisma.mealPlan.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlan.update({
    where: { id },
    data: input,
    include: MEAL_PLAN_INCLUDE,
  });
}

export async function deleteMealPlan(id: string) {
  const existing = await prisma.mealPlan.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    await tx.mealPlanSlot.deleteMany({ where: { mealPlanId: id } });
    await tx.mealPlanAccessory.deleteMany({ where: { mealPlanId: id } });
    return tx.mealPlan.delete({ where: { id } });
  });
}

// ══════════════════════════════════════════
// MealPlanSlot CRUD
// ══════════════════════════════════════════

export async function getMealPlanSlots(mealPlanId: string) {
  return prisma.mealPlanSlot.findMany({
    where: { mealPlanId },
    include: {
      recipe: { select: { id: true, name: true, code: true } },
    },
    orderBy: { slotIndex: "asc" },
  });
}

export async function createMealPlanSlot(
  mealPlanId: string,
  input: CreateMealPlanSlotInput
) {
  return prisma.mealPlanSlot.create({
    data: {
      mealPlanId,
      slotIndex: input.slotIndex,
      recipeId: input.recipeId,
      recipeBomId: input.recipeBomId,
      quantity: input.quantity,
      note: input.note,
    },
    include: {
      recipe: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateMealPlanSlot(
  id: string,
  input: UpdateMealPlanSlotInput
) {
  const existing = await prisma.mealPlanSlot.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanSlot.update({
    where: { id },
    data: input,
    include: {
      recipe: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteMealPlanSlot(id: string) {
  const existing = await prisma.mealPlanSlot.findFirst({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanSlot.delete({ where: { id } });
}
