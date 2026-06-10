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

import {
  findMatchingActiveBom,
  diagnoseBomMatch,
} from "@/features/recipe/services/recipe-bom.service";

import { MealPlanStatus } from "@prisma/client";

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
// Phase 9-C-Fix-R1: 슬롯 수량 검증 — 레시피 그룹 단위
// ────────────────────────────────────────────────────────────────
// 정책 (PROGRESS.md "Phase 9-C 결정사항" 참조):
//   - CONTAINER 슬롯을 recipeId로 그룹핑하여 각 레시피별 독립 판정
//   - 그룹 내 모든 슬롯 quantity=0 → OK_FALLBACK (그 레시피만 mealCount 전량 적용)
//   - 모두 quantity>0, 합계 = mealCount → OK_DISTRIBUTED
//   - 모두 quantity>0, 합계 ≠ mealCount → SUM_MISMATCH (차단)
//   - 일부만 quantity>0 → PARTIAL_INPUT (차단)
//   - recipeId=null 슬롯 → 검증 제외 (산출에서도 자연 제외됨)
//   - ProductionLine은 그룹핑 키에 포함하지 않음 (식수 정합성은 라인 무관)
// ════════════════════════════════════════════════════════════════

/**
 * 슬롯 수량 검증 입력 단위.
 * - kind는 호출부 호환을 위해 유지하되, CONTAINER만 실제 검증 대상.
 * - recipeId는 그룹핑 키. null이면 검증에서 제외.
 */
export type SlotQuantityValidationInput = {
  id: string;
  quantity: number;
  kind: "CONTAINER" | "DIRECT";
  recipeId: string | null;
};

/**
 * 레시피 그룹별 위반 상세.
 * action 레이어에서 레시피명 조회용으로 recipeId를 그대로 들고 올라간다.
 */
export type RecipeGroupViolation =
  | {
      kind: "PARTIAL_INPUT";
      recipeId: string;
      zeroSlotIds: string[];
      totalSlotCount: number;
      mealCount: number;
    }
  | {
      kind: "SUM_MISMATCH";
      recipeId: string;
      mealCount: number;
      slotsSum: number;
    };

/**
 * 그룹별 OK 결과 (산출 단계에서 effectiveCount 계산에 사용).
 */
export type RecipeGroupOk = {
  recipeId: string;
  mode: "FALLBACK" | "DISTRIBUTED";
  effectiveCount: number; // FALLBACK이면 mealCount, DISTRIBUTED면 슬롯 합계
};

export type SlotQuantityValidation =
  | {
      ok: true;
      mealPlanId: string;
      groups: RecipeGroupOk[];
    }
  | {
      ok: false;
      mealPlanId: string;
      mealCount: number;
      violations: RecipeGroupViolation[];
      // 성공한 그룹도 함께 반환 (UI 배지에 활용)
      okGroups: RecipeGroupOk[];
    };

export function validateSlotQuantitiesForMealPlan(
  mealPlanId: string,
  mealCount: number,
  slots: Array<SlotQuantityValidationInput>,
): SlotQuantityValidation {
  // CONTAINER + recipeId 있는 슬롯만 그룹핑 대상
  const targets = slots.filter(
    (s) => s.kind === "CONTAINER" && s.recipeId != null,
  );
  if (targets.length === 0) {
    return { ok: true, mealPlanId, groups: [] };
  }

  // recipeId로 그룹핑
  const groupMap = new Map<string, SlotQuantityValidationInput[]>();
  for (const s of targets) {
    const key = s.recipeId as string;
    const arr = groupMap.get(key) ?? [];
    arr.push(s);
    groupMap.set(key, arr);
  }

  const okGroups: RecipeGroupOk[] = [];
  const violations: RecipeGroupViolation[] = [];

  for (const [recipeId, list] of groupMap) {
    const positive = list.filter((s) => s.quantity > 0);
    const zero = list.filter((s) => s.quantity === 0);

    // (a) 전부 0 → fallback
    if (positive.length === 0) {
      okGroups.push({
        recipeId,
        mode: "FALLBACK",
        effectiveCount: mealCount,
      });
      continue;
    }

    // (b) 부분 입력 → 차단
    if (zero.length > 0) {
      violations.push({
        kind: "PARTIAL_INPUT",
        recipeId,
        zeroSlotIds: zero.map((s) => s.id),
        totalSlotCount: list.length,
        mealCount,
      });
      continue;
    }

    // (c) 전부 입력 → 합계 검사
    const sum = positive.reduce((a, s) => a + s.quantity, 0);
    if (sum !== mealCount) {
      violations.push({
        kind: "SUM_MISMATCH",
        recipeId,
        mealCount,
        slotsSum: sum,
      });
      continue;
    }

    okGroups.push({
      recipeId,
      mode: "DISTRIBUTED",
      effectiveCount: sum,
    });
  }

  if (violations.length === 0) {
    return { ok: true, mealPlanId, groups: okGroups };
  }
  return { ok: false, mealPlanId, mealCount, violations, okGroups };
}

// ════════════════════════════════════════════════════════════════
// Phase 7-F1 + 9-C-Fix-A: CONTAINER 슬롯 BOM 매칭 검증 헬퍼
// ────────────────────────────────────────────────────────────────
// 실패 시 원인을 3가지로 구분해 throw:
//   - BOM_NOT_MATCHED_NO_ACTIVE_BOM
//   - BOM_NOT_MATCHED_ZERO_WEIGHT
//   - BOM_NOT_MATCHED_NO_SLOT::<hint>   (콜론 2개로 prefix/suffix 구분)
// action 레이어가 위 키를 사용자 메시지로 매핑.
// ════════════════════════════════════════════════════════════════
async function resolveAndAssertBomMatch(
  recipeId: string,
  subsidiaryMasterId: string,
  containerSlotIndex: number,
): Promise<string> {
  const d = await diagnoseBomMatch(
    recipeId,
    subsidiaryMasterId,
    containerSlotIndex,
  );

  if (d.ok) return d.bomId;

  if (d.reason === "NO_ACTIVE_BOM") {
    throw new Error("BOM_NOT_MATCHED_NO_ACTIVE_BOM");
  }
  if (d.reason === "ZERO_TOTAL_WEIGHT") {
    throw new Error("BOM_NOT_MATCHED_ZERO_WEIGHT");
  }
  // NO_MATCHING_SLOT — hint를 메시지에 포함
  const hint = d.availableSlots
    .slice(0, 5)
    .map((s) => `${s.subsidiaryName}#${s.slotIndex}(${s.totalWeightG}g)`)
    .join(", ");
  // 한 줄 문장. action 매핑이 안 잡혀도 사용자가 읽을 수 있음.
  throw new Error(
    `선택한 (용기, 슬롯) 조합이 ACTIVE BOM에 정의되어 있지 않습니다. 사용 가능한 슬롯: ${hint || "없음"}`,
  );
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

/**
 * Phase 9-C-Fix-K2: 그룹 단위 슬롯 수량 검증.
 * 각 MealPlan 의 CONTAINER 슬롯에 대해 validateSlotQuantitiesForMealPlan 을
 * 호출하고, 하나라도 실패하면 즉시 throw.
 *
 * @throws Error("GROUP_SLOT_QTY_PARTIAL_INPUT::<mealPlanId>::<zeroCount>")
 * @throws Error("GROUP_SLOT_QTY_SUM_MISMATCH::<mealPlanId>::<mealCount>::<slotsSum>")
 * @throws Error("GROUP_MISSING_MEAL_COUNT::<mealPlanId>")
 */
async function assertGroupSlotQuantitiesValid(
  tx: DbClient,
  mealPlanGroupId: string,
): Promise<void> {
  const mealPlans = await tx.mealPlan.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: {
      id: true,
      companyMealSlotId: true,
      lineupId: true,
      slots: {
        where: { deletedAt: null },
        select: { id: true, kind: true, quantity: true },
      },
    },
  });

  // 식수 맵
  const mealCounts = await tx.mealCount.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: {
      companyMealSlotId: true,
      lineupId: true,
      estimatedCount: true,
      finalCount: true,
    },
  });
  // 상태 전환 시점에서는 finalCount 가 아직 비어있을 수 있으므로
  // estimatedCount 우선, 없으면 finalCount fallback.
  const countMap = new Map<string, number>();
  for (const mc of mealCounts) {
    const v = mc.estimatedCount ?? mc.finalCount;
    if (v == null) continue;
    countMap.set(`${mc.companyMealSlotId}::${mc.lineupId}`, v);
  }

  for (const mp of mealPlans) {
    const containerSlots = mp.slots.filter((s) => s.kind === "CONTAINER");
    if (containerSlots.length === 0) continue;

    const mc = countMap.get(`${mp.companyMealSlotId}::${mp.lineupId}`);
    if (mc == null) {
      throw new Error(`GROUP_MISSING_MEAL_COUNT::${mp.id}`);
    }

    // ★ R1-1 임시: recipeId는 null로 채워 검증 자체가 비활성됨
    //   (모든 슬롯이 검증 제외되어 ok=true). R1-2에서 slot 조회에 recipeId 추가.
    const result = validateSlotQuantitiesForMealPlan(
      mp.id,
      mc,
      containerSlots.map((s) => ({
        id: s.id,
        quantity: s.quantity ?? 0,
        kind: "CONTAINER" as const,
        recipeId: null,
      })),
    );
    if (!result.ok) {
      const first = result.violations[0];
      if (first.kind === "PARTIAL_INPUT") {
        throw new Error(
          `GROUP_SLOT_QTY_PARTIAL_INPUT::${mp.id}::${first.recipeId}::${first.zeroSlotIds.length}::${first.totalSlotCount}`,
        );
      }
      if (first.kind === "SUM_MISMATCH") {
        throw new Error(
          `GROUP_SLOT_QTY_SUM_MISMATCH::${mp.id}::${first.recipeId}::${first.mealCount}::${first.slotsSum}`,
        );
      }
    }
  }
}

export async function updateMealPlanGroup(
  companyId: string,
  id: string,
  input: UpdateMealPlanGroupInput,
) {
  const existing = await prisma.mealPlanGroup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  // ★ Phase 9-C-Fix-K2: DRAFT → CONFIRMED / IN_PROGRESS 전환 시 슬롯 수량 검증
  //    정책:
  //      - DRAFT 상태에서 다른 상태로 전환되는 순간 식단 데이터 무결성을 검증
  //      - CANCELLED 로 전환은 검증 면제 (취소는 언제든 허용)
  //      - 검증 항목: 각 MealPlan 의 slot.quantity 부분 입력 / 합계 불일치
  if (
    input.status &&
    input.status !== existing.status &&
    existing.status === MealPlanStatus.DRAFT &&
    input.status !== MealPlanStatus.CANCELLED
  ) {
    await assertGroupSlotQuantitiesValid(prisma, id);
  }

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

  // Phase 7-F1 + 9-C-Fix-A: 행별 BOM 매칭 검증 (실패 시 행 번호와 원인 명시)
  const bomMatchMap = new Map<number, string>();
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    if (!it.recipeId) continue;
    const d = await diagnoseBomMatch(
      it.recipeId,
      input.subsidiaryMasterId,
      it.containerSlotIndex,
    );
    if (d.ok) {
      bomMatchMap.set(i, d.bomId);
      continue;
    }
    // 어떤 행에서 실패했는지 사용자가 알도록 1-based 행 번호 포함
    const rowLabel = `행 ${i + 1} (slotIndex=${it.containerSlotIndex})`;
    if (d.reason === "NO_ACTIVE_BOM") {
      throw new Error(`BOM_NOT_MATCHED_NO_ACTIVE_BOM::${rowLabel}`);
    }
    if (d.reason === "ZERO_TOTAL_WEIGHT") {
      throw new Error(`BOM_NOT_MATCHED_ZERO_WEIGHT::${rowLabel}`);
    }
    const hint = d.availableSlots
      .slice(0, 5)
      .map((s) => `${s.subsidiaryName}#${s.slotIndex}(${s.totalWeightG}g)`)
      .join(", ");
    throw new Error(
      `BOM_NOT_MATCHED_NO_SLOT::${rowLabel} / 사용 가능: ${hint || "없음"}`,
    );
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
