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
  BulkCreateContainerSlotsInput,
  UpsertMealCountInput,
  BulkUpsertMealCountInput,
  CreateMealPlanAccessoryInput,
  UpdateMealPlanAccessoryInput,
  ApplyMealTemplateInput,
  CopyMealPlanGroupInput,
} from "../schemas/meal-plan.schema";

import { findMatchingActiveBom } from "@/features/recipe/services/recipe-bom.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Step 3.2b-2-β: companyMealSlotId 회사 격리 검증.
 * - slot_type 컬럼은 β에서 제거됐고, 본 함수는 입력 검증만 담당.
 */
async function resolveCompanyMealSlotIdFromInput(
  tx: DbClient,
  companyId: string,
  input: { companyMealSlotId: string },
): Promise<string> {
  const slot = await tx.companyMealSlot.findUnique({
    where: { id: input.companyMealSlotId },
    select: { id: true, companyId: true, deletedAt: true },
  });
  if (!slot || slot.companyId !== companyId || slot.deletedAt !== null) {
    throw new Error("COMPANY_MEAL_SLOT_NOT_FOUND");
  }
  return slot.id;
}

// ══════════════════════════════════════════════════════════════
// Include 상수 (Phase 5-R v2 구조)
// ══════════════════════════════════════════════════════════════

const GROUP_LIST_INCLUDE = {
  _count: { select: { mealPlans: true, mealCounts: true } },
} satisfies Prisma.MealPlanGroupInclude;

const SLOT_INCLUDE = {
  recipe: { select: { id: true, name: true, code: true } },
  recipeBom: { select: { id: true, version: true, status: true } },
  subsidiaryMaster: {
    select: { id: true, name: true, code: true, subsidiaryType: true },
  },
  supplierItem: {
    select: {
      id: true,
      productName: true, // ← name → productName
      supplierItemCode: true, // ← itemCode → supplierItemCode
      supplier: { select: { id: true, name: true } },
    },
  },
  productionLine: { select: { id: true, name: true } },
} satisfies Prisma.MealPlanSlotInclude;

const MEAL_PLAN_INCLUDE = {
  lineup: { select: { id: true, name: true, code: true } },
  mealTemplate: { select: { id: true, name: true } },
  companyMealSlot: {
    select: { id: true, code: true, displayName: true, sortOrder: true },
  },
  slots: {
    where: { deletedAt: null },
    include: SLOT_INCLUDE,
    orderBy: {
      sortOrder: "asc",
    } as Prisma.MealPlanSlotOrderByWithRelationInput,
  },
  accessories: {
    where: { deletedAt: null },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
    orderBy: {
      createdAt: "asc",
    } as Prisma.MealPlanAccessoryOrderByWithRelationInput,
  },
} satisfies Prisma.MealPlanInclude;

const GROUP_DETAIL_INCLUDE = {
  mealPlans: {
    where: { deletedAt: null },
    include: MEAL_PLAN_INCLUDE,
    orderBy: [
      { companyMealSlot: { sortOrder: "asc" } },
      { lineup: { name: "asc" } },
    ] as Prisma.MealPlanOrderByWithRelationInput[],
  },
  mealCounts: {
    where: { deletedAt: null },
    include: {
      lineup: { select: { id: true, name: true, code: true } },
      companyMealSlot: {
        select: { id: true, code: true, displayName: true, sortOrder: true },
      },
    },
    orderBy: [
      { companyMealSlot: { sortOrder: "asc" } },
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
  tx: DbClient,
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
  tx: DbClient,
  companyId: string,
  mealPlanId: string,
) {
  const plan = await tx.mealPlan.findFirst({
    where: {
      id: mealPlanId,
      deletedAt: null,
      mealPlanGroup: { companyId, deletedAt: null },
    },
    select: { id: true, mealPlanGroupId: true, lineupId: true, companyMealSlotId: true },
  });
  if (!plan) throw new Error("NOT_FOUND");
  return plan;
}

// ════════════════════════════════════════════════════════════════
// Phase 7-F1: CONTAINER 슬롯 BOM 매칭 검증 헬퍼
// ════════════════════════════════════════════════════════════════
async function resolveAndAssertBomMatch(
  recipeId: string,
  subsidiaryMasterId: string,
  containerSlotIndex: number,
): Promise<string> {
  const match = await findMatchingActiveBom(
    recipeId,
    subsidiaryMasterId,
    containerSlotIndex,
  );
  if (!match) {
    throw new Error("BOM_NOT_MATCHED");
  }
  return match.bomId;
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

  if (dateFrom || dateTo) {
    where.planDate = {};
    if (dateFrom)
      (where.planDate as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo)
      (where.planDate as Prisma.DateTimeFilter).lte = new Date(dateTo);
  }

  if (search) {
    where.note = { contains: search, mode: "insensitive" };
  }

  if (lineupId) {
    where.mealPlans = { some: { lineupId, deletedAt: null } };
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
            companyMealSlotId: mp.companyMealSlotId,
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
              quantity: a.quantity,
            })),
          });
        }
      }

      if (input.copyMealCounts && source.mealCounts.length > 0) {
        await tx.mealCount.createMany({
          data: source.mealCounts.map((c) => ({
            mealPlanGroupId: newGroup.id,
            companyMealSlotId: c.companyMealSlotId,
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

// ══════════════════════════════════════════════════════════════
// MealPlan CRUD
// ══════════════════════════════════════════════════════════════

export async function getMealPlansByGroup(
  companyId: string,
  mealPlanGroupId: string,
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  return prisma.mealPlan.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    include: MEAL_PLAN_INCLUDE,
    orderBy: [
      { companyMealSlot: { sortOrder: "asc" } },
      { lineup: { name: "asc" } },
    ] as Prisma.MealPlanOrderByWithRelationInput[],
  });
}

export async function createMealPlan(
  companyId: string,
  mealPlanGroupId: string,
  input: CreateMealPlanInput,
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  await assertLineupBelongsToCompany(prisma, companyId, input.lineupId);

  // Step 3.2b-2-β: companyMealSlotId 단일 입력. 회사 격리 검증.
  const companyMealSlotId = await resolveCompanyMealSlotIdFromInput(
    prisma,
    companyId,
    input,
  );

  try {
    return await prisma.mealPlan.create({
      data: {
        mealPlanGroupId,
        companyMealSlotId,
        lineupId: input.lineupId,
        mealTemplateId: input.mealTemplateId,
        note: input.note,
      },
      include: MEAL_PLAN_INCLUDE,
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error("DUPLICATE_MEAL_PLAN");
    }
    throw e;
  }
}

export async function updateMealPlan(
  companyId: string,
  id: string,
  input: UpdateMealPlanInput,
) {
  await assertMealPlanInCompany(prisma, companyId, id);

  return prisma.mealPlan.update({
    where: { id },
    data: {
      mealTemplateId: input.mealTemplateId,
      note: input.note,
    },
    include: MEAL_PLAN_INCLUDE,
  });
}

export async function deleteMealPlan(companyId: string, id: string) {
  // assertMealPlanInCompany는 { id, mealPlanGroupId, lineupId, companyMealSlotId }을 반환
  const plan = await assertMealPlanInCompany(prisma, companyId, id);

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.mealPlanSlot.updateMany({
      where: { mealPlanId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.mealPlanAccessory.updateMany({
      where: { mealPlanId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    // ★ Phase 5-R Step 1.2: MealPlan 삭제 시 동일 (group, companyMealSlot, lineup) 조합의
    //   MealCount도 함께 soft delete. deleteMealPlanGroup과 정책 일관성 유지.
    //   사용자가 식단을 삭제했을 때 식수 현황도 함께 사라지도록 한다.
    await tx.mealCount.updateMany({
      where: {
        mealPlanGroupId: plan.mealPlanGroupId,
        companyMealSlotId: plan.companyMealSlotId,
        lineupId: plan.lineupId,
        deletedAt: null,
      },
      data: { deletedAt: now },
    });
    return tx.mealPlan.update({
      where: { id },
      data: { deletedAt: now },
    });
  });
}


// ══════════════════════════════════════════════════════════════
// MealPlanSlot CRUD (SlotKind 분기)
// ══════════════════════════════════════════════════════════════

export async function getMealPlanSlots(companyId: string, mealPlanId: string) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  return prisma.mealPlanSlot.findMany({
    where: { mealPlanId, deletedAt: null },
    include: SLOT_INCLUDE,
    orderBy: { sortOrder: "asc" },
  });
}

export async function createMealPlanSlot(
  companyId: string,
  mealPlanId: string,
  input: CreateMealPlanSlotInput,
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  if (input.productionLineId) {
    const line = await prisma.productionLine.findFirst({
      where: { id: input.productionLineId, companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!line) throw new Error("PRODUCTION_LINE_NOT_FOUND");
  }

  if (input.kind === "CONTAINER") {
    const [sub, recipe] = await Promise.all([
      prisma.subsidiaryMaster.findFirst({
        where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
        select: { id: true },
      }),
      prisma.recipe.findFirst({
        where: { id: input.recipeId, companyId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!sub) throw new Error("SUBSIDIARY_NOT_FOUND");
    if (!recipe) throw new Error("RECIPE_NOT_FOUND");

    // Phase 7-F1: BOM 매칭 검증 + recipeBomId 자동 결정
    const resolvedBomId = await resolveAndAssertBomMatch(
      input.recipeId,
      input.subsidiaryMasterId,
      input.containerSlotIndex,
    );    

    return prisma.mealPlanSlot.create({
      data: {
        mealPlanId,
        kind: "CONTAINER",
        sortOrder: input.sortOrder,
        quantity: input.quantity,
        note: input.note,
        productionLineId: input.productionLineId,
        subsidiaryMasterId: input.subsidiaryMasterId,
        containerSlotIndex: input.containerSlotIndex,
        recipeId: input.recipeId,
        recipeBomId: resolvedBomId, // Phase 7-F1: 서버가 결정한 값으로 덮어씀
      },
      include: SLOT_INCLUDE,
    });
  }

  // DIRECT
  const supplierItem = await prisma.supplierItem.findFirst({
    where: {
      id: input.supplierItemId,
      supplier: { companyId, deletedAt: null },
      // deletedAt 제거 (SupplierItem 모델에 없음)
    },
    select: { id: true },
  });
  if (!supplierItem) throw new Error("SUPPLIER_ITEM_NOT_FOUND");

  return prisma.mealPlanSlot.create({
    data: {
      mealPlanId,
      kind: "DIRECT",
      sortOrder: input.sortOrder,
      quantity: input.quantity,
      note: input.note,
      productionLineId: input.productionLineId,
      supplierItemId: input.supplierItemId,
    },
    include: SLOT_INCLUDE,
  });
}

export async function updateMealPlanSlot(
  companyId: string,
  id: string,
  input: UpdateMealPlanSlotInput,
) {
  const existing = await prisma.mealPlanSlot.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: {
      id: true,
      kind: true,
      subsidiaryMasterId: true,
      containerSlotIndex: true,
    },
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (existing.kind !== input.kind) {
    throw new Error("SLOT_KIND_MISMATCH");
  }

  if (input.productionLineId) {
    const line = await prisma.productionLine.findFirst({
      where: { id: input.productionLineId, companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!line) throw new Error("PRODUCTION_LINE_NOT_FOUND");
  }

  const data: Prisma.MealPlanSlotUpdateInput = {
    sortOrder: input.sortOrder,
    quantity: input.quantity,
    note: input.note,
    productionLine:
      input.productionLineId === null
        ? { disconnect: true }
        : input.productionLineId
          ? { connect: { id: input.productionLineId } }
          : undefined,
  };

  if (input.kind === "CONTAINER") {
    if (input.subsidiaryMasterId) {
      const sub = await prisma.subsidiaryMaster.findFirst({
        where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!sub) throw new Error("SUBSIDIARY_NOT_FOUND");
      data.subsidiaryMaster = { connect: { id: input.subsidiaryMasterId } };
    }
    if (input.containerSlotIndex !== undefined) {
      data.containerSlotIndex = input.containerSlotIndex;
    }
    if (input.recipeId !== undefined) {
      if (input.recipeId === null) {
        data.recipe = { disconnect: true };
        data.recipeBom = { disconnect: true };
      } else {
        const recipe = await prisma.recipe.findFirst({
          where: { id: input.recipeId, companyId, deletedAt: null },
          select: { id: true },
        });
        if (!recipe) throw new Error("RECIPE_NOT_FOUND");

        // Phase 7-F1: 최종 (subsidiary, slotIndex)로 BOM 매칭 검증
        const finalSubsidiaryId =
          input.subsidiaryMasterId ?? existing.subsidiaryMasterId;
        const finalSlotIndex =
          input.containerSlotIndex ?? existing.containerSlotIndex;

        if (!finalSubsidiaryId || finalSlotIndex === null || finalSlotIndex === undefined) {
          throw new Error("CONTAINER_SLOT_INFO_MISSING");
        }

        const resolvedBomId = await resolveAndAssertBomMatch(
          input.recipeId,
          finalSubsidiaryId,
          finalSlotIndex,
        );
        data.recipe = { connect: { id: input.recipeId } };
        data.recipeBom = { connect: { id: resolvedBomId } };
      }
    }
    // Phase 7-F1: input.recipeBomId는 더 이상 사용하지 않음 (서버가 결정)
  } else if (input.supplierItemId) {
    const supplierItem = await prisma.supplierItem.findFirst({
      where: {
        id: input.supplierItemId,
        supplier: { companyId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!supplierItem) throw new Error("SUPPLIER_ITEM_NOT_FOUND");
    data.supplierItem = { connect: { id: input.supplierItemId } };
  }

  return prisma.mealPlanSlot.update({
    where: { id },
    data,
    include: SLOT_INCLUDE,
  });
}

export async function deleteMealPlanSlot(companyId: string, id: string) {
  const existing = await prisma.mealPlanSlot.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanSlot.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function reorderMealPlanSlots(
  companyId: string,
  mealPlanId: string,
  input: ReorderMealPlanSlotsInput,
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  const ids = input.items.map((it) => it.id);
  const existingSlots = await prisma.mealPlanSlot.findMany({
    where: { id: { in: ids }, mealPlanId, deletedAt: null },
    select: { id: true },
  });
  if (existingSlots.length !== ids.length) {
    throw new Error("SLOT_NOT_FOUND");
  }

  return prisma.$transaction(
    input.items.map((it) =>
      prisma.mealPlanSlot.update({
        where: { id: it.id },
        data: { sortOrder: it.sortOrder },
      }),
    ),
  );
}


// ══════════════════════════════════════════════════════════════
// Phase 7-A3: bulkCreateContainerSlots
// 한 식단 + 한 용기 그룹의 모든 슬롯을 트랜잭션으로 일괄 생성.
// recipeId는 슬롯별 null 허용. 회사 격리 검증 포함.
// ══════════════════════════════════════════════════════════════

export async function bulkCreateContainerSlots(
  companyId: string,
  mealPlanId: string,
  input: BulkCreateContainerSlotsInput,
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  // 1) 용기 그룹 회사 격리 검증
  const subsidiary = await prisma.subsidiaryMaster.findFirst({
    where: {
      id: input.subsidiaryMasterId,
      companyId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!subsidiary) throw new Error("SUBSIDIARY_NOT_FOUND");

  // 2) 기본 라인 + 행별 라인 모두 ACTIVE 검증
  const lineIds = new Set<string>();
  if (input.defaultProductionLineId) {
    lineIds.add(input.defaultProductionLineId);
  }
  for (const it of input.items) {
    if (it.productionLineId) lineIds.add(it.productionLineId);
  }
  if (lineIds.size > 0) {
    const validLines = await prisma.productionLine.findMany({
      where: {
        id: { in: Array.from(lineIds) },
        companyId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (validLines.length !== lineIds.size) {
      throw new Error("PRODUCTION_LINE_NOT_FOUND");
    }
  }

  // 3) 레시피 회사 격리 검증 (지정된 것만)
  const recipeIds = Array.from(
    new Set(
      input.items
        .map((it) => it.recipeId)
        .filter((v): v is string => !!v),
    ),
  );
  if (recipeIds.length > 0) {
    const validRecipes = await prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (validRecipes.length !== recipeIds.length) {
      throw new Error("RECIPE_NOT_FOUND");
    }
  }

  // Phase 7-F1: recipeId가 있는 행마다 BOM 매칭 검증
  const bomMatchMap = new Map<number, string>();
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    if (!it.recipeId) continue;
    const match = await findMatchingActiveBom(
      it.recipeId,
      input.subsidiaryMasterId,
      it.containerSlotIndex,
    );
    if (!match) {
      throw new Error("BOM_NOT_MATCHED");
    }
    bomMatchMap.set(i, match.bomId);
  }

  // 4) sortOrder 시작점 계산
  const lastSlot = await prisma.mealPlanSlot.findFirst({
    where: { mealPlanId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextSortOrder = (lastSlot?.sortOrder ?? -1) + 1;

  const data: Prisma.MealPlanSlotCreateManyInput[] = input.items.map((it, i) => ({
    mealPlanId,
    kind: "CONTAINER",
    sortOrder: nextSortOrder++,
    subsidiaryMasterId: input.subsidiaryMasterId,
    containerSlotIndex: it.containerSlotIndex,
    recipeId: it.recipeId ?? null,
    recipeBomId: bomMatchMap.get(i) ?? null, // Phase 7-F1
    productionLineId:
      it.productionLineId ?? input.defaultProductionLineId ?? null,
    quantity: it.quantity ?? 0,
    note: it.note ?? null,
  }));

  // 5) 트랜잭션 일괄 생성 후 생성된 슬롯들 반환
  return prisma.$transaction(async (tx) => {
    await tx.mealPlanSlot.createMany({ data });
    return tx.mealPlanSlot.findMany({
      where: {
        mealPlanId,
        subsidiaryMasterId: input.subsidiaryMasterId,
        sortOrder: { gte: data[0].sortOrder ?? 0 },
        deletedAt: null,
      },
      include: SLOT_INCLUDE,
      orderBy: { sortOrder: "asc" },
    });
  });
}

// ══════════════════════════════════════════════════════════════
// MealCount
// ══════════════════════════════════════════════════════════════

export async function getMealCounts(
  companyId: string,
  mealPlanGroupId: string,
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  return prisma.mealCount.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    include: {
      lineup: { select: { id: true, name: true, code: true } },
      companyMealSlot: {
        select: { id: true, code: true, displayName: true, sortOrder: true },
      },
    },
    orderBy: [
      { companyMealSlot: { sortOrder: "asc" } },
      { lineup: { name: "asc" } },
    ] as Prisma.MealCountOrderByWithRelationInput[],
  });
}

export async function upsertMealCount(
  companyId: string,
  mealPlanGroupId: string,
  input: UpsertMealCountInput,
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  await assertLineupBelongsToCompany(prisma, companyId, input.lineupId);

  // Step 3.2b-2-β: companyMealSlotId 단일 입력으로 통일. slotType 제거 완료.
  const companyMealSlotId = await resolveCompanyMealSlotIdFromInput(
    prisma,
    companyId,
    input,
  );
  // upsert의 where 키는 (mealPlanGroupId, companyMealSlotId, lineupId) 기준

  return prisma.mealCount.upsert({
    where: {
      mealPlanGroupId_companyMealSlotId_lineupId: {
        mealPlanGroupId,
        companyMealSlotId,
        lineupId: input.lineupId,
      },
    },
    create: {
      mealPlanGroupId,
      companyMealSlotId,
      lineupId: input.lineupId,
      estimatedCount: input.estimatedCount,
      finalCount: input.finalCount,
    },
    update: {
      estimatedCount: input.estimatedCount,
      finalCount: input.finalCount,
      deletedAt: null,
    },
    include: {
      lineup: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function bulkUpsertMealCount(
  companyId: string,
  mealPlanGroupId: string,
  input: BulkUpsertMealCountInput,
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  const lineupIds = Array.from(
    new Set(input.items.map((it: UpsertMealCountInput) => it.lineupId)),
  );  
  const validLineups = await prisma.lineup.findMany({
    where: { id: { in: lineupIds }, companyId, deletedAt: null },
    select: { id: true },
  });
  if (validLineups.length !== lineupIds.length) {
    throw new Error("LINEUP_NOT_FOUND");
  }

  // Step 3.2b-2-β: companyMealSlotId만 입력으로 받음. slotType 사전 조회 불필요.
  type ResolvedItem = {
    companyMealSlotId: string;
    lineupId: string;
    estimatedCount: number;
    finalCount: number | null | undefined;
  };

  const resolved: ResolvedItem[] = [];
  for (const it of input.items as UpsertMealCountInput[]) {
    const companyMealSlotId = await resolveCompanyMealSlotIdFromInput(
      prisma,
      companyId,
      it,
    );
    resolved.push({
      companyMealSlotId,
      lineupId: it.lineupId,
      estimatedCount: it.estimatedCount,
      finalCount: it.finalCount,
    });
  }

  return prisma.$transaction(
    resolved.map((it) =>
      prisma.mealCount.upsert({
        where: {
          mealPlanGroupId_companyMealSlotId_lineupId: {
            mealPlanGroupId,
            companyMealSlotId: it.companyMealSlotId,
            lineupId: it.lineupId,
          },
        },
        create: {
          mealPlanGroupId,
          companyMealSlotId: it.companyMealSlotId,
          lineupId: it.lineupId,
          estimatedCount: it.estimatedCount,
          finalCount: it.finalCount,
        },
        update: {
          estimatedCount: it.estimatedCount,
          finalCount: it.finalCount,
          deletedAt: null,
        },
      }),
    ),
  );
}

export async function deleteMealCount(companyId: string, id: string) {
  const existing = await prisma.mealCount.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlanGroup: { companyId, deletedAt: null },
    },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealCount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ══════════════════════════════════════════════════════════════
// MealPlanAccessory CRUD
// ══════════════════════════════════════════════════════════════

export async function getMealPlanAccessories(
  companyId: string,
  mealPlanId: string,
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  return prisma.mealPlanAccessory.findMany({
    where: { mealPlanId, deletedAt: null },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMealPlanAccessory(
  companyId: string,
  mealPlanId: string,
  input: CreateMealPlanAccessoryInput,
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  const subsidiary = await prisma.subsidiaryMaster.findFirst({
    where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!subsidiary) throw new Error("SUBSIDIARY_NOT_FOUND");

  if (
    input.consumptionMode === "FIXED_QUANTITY" &&
    input.fixedQuantity == null
  ) {
    throw new Error("FIXED_QUANTITY_REQUIRED");
  }

  const computedQuantity =
    input.consumptionMode === "FIXED_QUANTITY" ? (input.fixedQuantity ?? 0) : 0;

  return prisma.mealPlanAccessory.create({
    data: {
      mealPlanId,
      subsidiaryMasterId: input.subsidiaryMasterId,
      consumptionMode: input.consumptionMode,
      fixedQuantity: input.fixedQuantity,
      required: input.required,
      note: input.note,
      quantity: computedQuantity,
    },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateMealPlanAccessory(
  companyId: string,
  id: string,
  input: UpdateMealPlanAccessoryInput,
) {
  const existing = await prisma.mealPlanAccessory.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true, consumptionMode: true, fixedQuantity: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const finalMode = input.consumptionMode ?? existing.consumptionMode;
  const finalFixed =
    input.fixedQuantity !== undefined
      ? input.fixedQuantity
      : existing.fixedQuantity;
  if (finalMode === "FIXED_QUANTITY" && finalFixed == null) {
    throw new Error("FIXED_QUANTITY_REQUIRED");
  }

  const data: Prisma.MealPlanAccessoryUpdateInput = {
    consumptionMode: input.consumptionMode,
    fixedQuantity: input.fixedQuantity,
    required: input.required,
    note: input.note,
  };

  if (input.subsidiaryMasterId) {
    const subsidiary = await prisma.subsidiaryMaster.findFirst({
      where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!subsidiary) throw new Error("SUBSIDIARY_NOT_FOUND");
    data.subsidiaryMaster = { connect: { id: input.subsidiaryMasterId } };
  }

  if (finalMode === "FIXED_QUANTITY" && finalFixed != null) {
    data.quantity = finalFixed;
  }

  return prisma.mealPlanAccessory.update({
    where: { id },
    data,
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteMealPlanAccessory(companyId: string, id: string) {
  const existing = await prisma.mealPlanAccessory.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanAccessory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ══════════════════════════════════════════════════════════════
// applyMealTemplate
// ══════════════════════════════════════════════════════════════

export async function applyMealTemplate(
  companyId: string,
  mealPlanId: string,
  input: ApplyMealTemplateInput,
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  const template = await prisma.mealTemplate.findFirst({
    where: { id: input.mealTemplateId, companyId }, // ← deletedAt 제거
    include: {
      containers: {
        include: {
          subsidiaryMaster: {
            include: {
              containerSlots: { orderBy: { slotIndex: "asc" } },
            },
          },
        },
      },
      accessories: true,
    },
  });
  if (!template) throw new Error("MEAL_TEMPLATE_NOT_FOUND");

  // ← 명시 변수로 분리: TS 타입 좁힘 강화
  const templateContainers = template.containers;
  const templateAccessories = template.accessories;

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    if (input.replaceExisting) {
      await tx.mealPlanSlot.updateMany({
        where: { mealPlanId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.mealPlanAccessory.updateMany({
        where: { mealPlanId, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    const lastSlot = await tx.mealPlanSlot.findFirst({
      where: { mealPlanId, deletedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let nextSortOrder = (lastSlot?.sortOrder ?? -1) + 1;

    const slotData: Prisma.MealPlanSlotCreateManyInput[] = [];
    for (const container of templateContainers) {
      const containerSlots = container.subsidiaryMaster.containerSlots;
      for (const cs of containerSlots) {
        slotData.push({
          mealPlanId,
          kind: "CONTAINER",
          sortOrder: nextSortOrder++,
          subsidiaryMasterId: container.subsidiaryMasterId,
          containerSlotIndex: cs.slotIndex,
          recipeId: null,
          recipeBomId: null,
          quantity: 0,
        });
      }
    }
    if (slotData.length > 0) {
      await tx.mealPlanSlot.createMany({ data: slotData });
    }

    // ⚠ 주의: MealTemplateAccessory 모델은 consumptionType / isRequired 이름을 씁니다.
    //   MealPlanAccessory는 consumptionMode / required 이름입니다.
    const accessoryData: Prisma.MealPlanAccessoryCreateManyInput[] =
      templateAccessories.map((a) => ({
        mealPlanId,
        subsidiaryMasterId: a.subsidiaryMasterId,
        consumptionMode: a.consumptionType, // ← 이름 매핑
        fixedQuantity: a.fixedQuantity,
        required: a.isRequired, // ← 이름 매핑
        quantity:
          a.consumptionType === "FIXED_QUANTITY" ? (a.fixedQuantity ?? 0) : 0,
      }));
    if (accessoryData.length > 0) {
      await tx.mealPlanAccessory.createMany({ data: accessoryData });
    }

    await tx.mealPlan.update({
      where: { id: mealPlanId },
      data: { mealTemplateId: input.mealTemplateId },
    });

    return tx.mealPlan.findFirst({
      where: { id: mealPlanId },
      include: MEAL_PLAN_INCLUDE,
    });
  });
}
