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
  ReorderMealPlanSlotsInput,
  UpsertMealCountInput,
  BulkUpsertMealCountInput,
  CreateMealPlanAccessoryInput,
  UpdateMealPlanAccessoryInput,
  ApplyMealTemplateInput,
  CopyMealPlanGroupInput,
} from "../schemas/meal-plan.schema";

// ══════════════════════════════════════════════════════════════
// Include 상수 (Phase 5-R v2 구조)
// ══════════════════════════════════════════════════════════════

const GROUP_LIST_INCLUDE = {
  _count: { select: { mealPlans: true, mealCounts: true } },
} as const;

const SLOT_INCLUDE = {
  recipe: { select: { id: true, name: true, code: true } },
  recipeBom: { select: { id: true, version: true, status: true } },
  subsidiaryMaster: { select: { id: true, name: true, code: true, subsidiaryType: true } },
  supplierItem: {
    select: {
      id: true,
      name: true,
      itemCode: true,
      supplier: { select: { id: true, name: true } },
    },
  },
  productionLine: { select: { id: true, name: true, code: true } },
} satisfies Prisma.MealPlanSlotInclude;

const MEAL_PLAN_INCLUDE = {
  lineup: { select: { id: true, name: true, code: true } },
  mealTemplate: { select: { id: true, name: true } },
  slots: {
    where: { deletedAt: null },
    include: SLOT_INCLUDE,
    orderBy: { sortOrder: "asc" } as Prisma.MealPlanSlotOrderByWithRelationInput,
  },
  accessories: {
    where: { deletedAt: null },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" } as Prisma.MealPlanAccessoryOrderByWithRelationInput,
  },
} satisfies Prisma.MealPlanInclude;

const GROUP_LIST_INCLUDE = {
  _count: { select: { mealPlans: true, mealCounts: true } },
} satisfies Prisma.MealPlanGroupInclude;

const GROUP_DETAIL_INCLUDE = {
  mealPlans: {
    where: { deletedAt: null },
    include: MEAL_PLAN_INCLUDE,
    orderBy: [
      { slotType: "asc" },
      { lineup: { name: "asc" } },
    ] as Prisma.MealPlanOrderByWithRelationInput[],
  },
  mealCounts: {
    where: { deletedAt: null },
    include: {
      lineup: { select: { id: true, name: true, code: true } },
    },
    orderBy: [
      { slotType: "asc" },
      { lineup: { name: "asc" } },
    ] as Prisma.MealCountOrderByWithRelationInput[],
  },
} satisfies Prisma.MealPlanGroupInclude;

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

/**
 * Lineup이 해당 Company에 속하는지 검증
 * @throws Error("LINEUP_NOT_FOUND")
 */
async function assertLineupBelongsToCompany(
  tx: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  lineupId: string,
) {
  const lineup = await tx.lineup.findFirst({
    where: { id: lineupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!lineup) throw new Error("LINEUP_NOT_FOUND");
}

/**
 * MealPlan이 해당 Company의 그룹에 속하는지 검증
 * @returns 검증된 MealPlan 객체 (companyId 포함)
 * @throws Error("NOT_FOUND")
 */
async function assertMealPlanInCompany(
  tx: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  mealPlanId: string,
) {
  const plan = await tx.mealPlan.findFirst({
    where: {
      id: mealPlanId,
      deletedAt: null,
      mealPlanGroup: { companyId, deletedAt: null }, // ← 'group' → 'mealPlanGroup'
    },
    select: { id: true, mealPlanGroupId: true, lineupId: true, slotType: true },
  });
  if (!plan) throw new Error("NOT_FOUND");
  return plan;
}

// ══════════════════════════════════════════════════════════════
// MealPlanGroup CRUD
// ══════════════════════════════════════════════════════════════

export async function getMealPlanGroups(
  companyId: string,
  query: MealPlanGroupListQuery,
) {
  const {
    page,
    limit,
    search,
    status,
    lineupId,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.MealPlanGroupWhereInput = {
    companyId,
    deletedAt: null,
  };

  if (status) where.status = status;

  // 날짜 범위 필터
  if (dateFrom || dateTo) {
    where.planDate = {};
    if (dateFrom)
      (where.planDate as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo)
      (where.planDate as Prisma.DateTimeFilter).lte = new Date(dateTo);
  }

  // 검색: note에 대한 부분 일치
  if (search) {
    where.note = { contains: search, mode: "insensitive" };
  }

  // Phase 5-R: lineupId 필터는 MealPlan 하위로 이동 (그룹 단위로 lineup이 없음)
  if (lineupId) {
    where.mealPlans = {
      some: { lineupId, deletedAt: null },
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
    where: { id, companyId, deletedAt: null },
    include: GROUP_DETAIL_INCLUDE,
  });
}

export async function createMealPlanGroup(
  companyId: string,
  input: CreateMealPlanGroupInput,
) {
  try {
    return await prisma.mealPlanGroup.create({
      data: {
        companyId,
        planDate: new Date(input.planDate),
        note: input.note,
      },
      include: GROUP_DETAIL_INCLUDE,
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      // unique(companyId, planDate)
      throw new Error("DUPLICATE_PLAN_DATE");
    }
    throw e;
  }
}

export async function updateMealPlanGroup(
  companyId: string,
  id: string,
  input: UpdateMealPlanGroupInput,
) {
  const existing = await prisma.mealPlanGroup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanGroup.update({
    where: { id },
    data: {
      status: input.status,
      note: input.note,
    },
    include: GROUP_DETAIL_INCLUDE,
  });
}

/**
 * Soft delete: deletedAt 타임스탬프 설정.
 * 하위 MealPlan / Slot / Accessory / MealCount도 동일하게 soft delete.
 */
export async function deleteMealPlanGroup(companyId: string, id: string) {
  const existing = await prisma.mealPlanGroup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const mealPlans = await tx.mealPlan.findMany({
      where: { mealPlanGroupId: id, deletedAt: null },
      select: { id: true },
    });
    const mealPlanIds = mealPlans.map((mp) => mp.id);

    if (mealPlanIds.length > 0) {
      await tx.mealPlanSlot.updateMany({
        where: { mealPlanId: { in: mealPlanIds }, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.mealPlanAccessory.updateMany({
        where: { mealPlanId: { in: mealPlanIds }, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.mealPlan.updateMany({
        where: { id: { in: mealPlanIds } },
        data: { deletedAt: now },
      });
    }

    await tx.mealCount.updateMany({
      where: { mealPlanGroupId: id, deletedAt: null },
      data: { deletedAt: now },
    });

    return tx.mealPlanGroup.update({
      where: { id },
      data: { deletedAt: now },
    });
  });
}

/**
 * 식단 그룹 복사 — Phase 5-R: 시그니처 변경
 * 기존: copyMealPlanGroup(companyId, sourceId, targetDate, targetLineupId?)
 * 신규: copyMealPlanGroup(companyId, input: CopyMealPlanGroupInput)
 *   - targetPlanDate로 신규 그룹 생성
 *   - mealPlans (slotType+lineupId 조합) + 슬롯 + 부자재 복사
 *   - copyMealCounts=true이면 식수도 복사 (기본 false)
 *   - copyAccessories=true이면 부자재 복사 (기본 true)
 */
export async function copyMealPlanGroup(
  companyId: string,
  input: CopyMealPlanGroupInput,
) {
  const source = await prisma.mealPlanGroup.findFirst({
    where: { id: input.sourceMealPlanGroupId, companyId, deletedAt: null },
    include: {
      mealPlans: {
        where: { deletedAt: null },
        include: {
          slots: { where: { deletedAt: null } },
          accessories: { where: { deletedAt: null } },
        },
      },
      mealCounts: { where: { deletedAt: null } },
    },
  });
  if (!source) throw new Error("NOT_FOUND");

  try {
    return await prisma.$transaction(async (tx) => {
      const newGroup = await tx.mealPlanGroup.create({
        data: {
          companyId,
          planDate: new Date(input.targetPlanDate),
          note: source.note,
        },
      });

      for (const mp of source.mealPlans) {
        const newPlan = await tx.mealPlan.create({
          data: {
            mealPlanGroupId: newGroup.id,
            slotType: mp.slotType,
            lineupId: mp.lineupId,
            mealTemplateId: mp.mealTemplateId,
            note: mp.note,
          },
        });

        if (mp.slots.length > 0) {
          await tx.mealPlanSlot.createMany({
            data: mp.slots.map((s) => ({
              mealPlanId: newPlan.id,
              kind: s.kind,
              sortOrder: s.sortOrder,
              quantity: s.quantity,
              note: s.note,
              subsidiaryMasterId: s.subsidiaryMasterId,
              containerSlotIndex: s.containerSlotIndex,
              recipeId: s.recipeId,
              recipeBomId: s.recipeBomId,
              supplierItemId: s.supplierItemId,
              productionLineId: s.productionLineId,
            })),
          });
        }

        if (input.copyAccessories && mp.accessories.length > 0) {
          await tx.mealPlanAccessory.createMany({
            data: mp.accessories.map((a) => ({
              mealPlanId: newPlan.id,
              subsidiaryMasterId: a.subsidiaryMasterId,
              consumptionMode: a.consumptionMode,
              fixedQuantity: a.fixedQuantity,
              required: a.required,
              note: a.note,
              quantity: a.quantity, // ← 추가 (Prisma 모델에서 required)
            })),
          });
        }
      }

      if (input.copyMealCounts && source.mealCounts.length > 0) {
        await tx.mealCount.createMany({
          data: source.mealCounts.map((c) => ({
            mealPlanGroupId: newGroup.id,
            slotType: c.slotType,
            lineupId: c.lineupId,
            estimatedCount: c.estimatedCount,
            finalCount: c.finalCount,
          })),
        });
      }

      return tx.mealPlanGroup.findFirst({
        where: { id: newGroup.id },
        include: GROUP_DETAIL_INCLUDE,
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error("DUPLICATE_PLAN_DATE");
    }
    throw e;
  }
}
