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

import { MealPlanStatus, MealCountSource } from "@prisma/client";

import { generateMaterialRequirements } from "@/features/material-requirement/services/material-requirement.service";

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
 * Phase 9-D-Sym: quantity는 호출부에서 estimated 또는 final 중 어느 값을
 * 검증할지에 따라 채워 넣는다. (검증 함수는 두 컬럼을 구분하지 않는다.)
 */
export type SlotQuantityValidationInput = {
  id: string;
  quantity: number; // estimated 또는 final (호출부 결정)
  kind: "CONTAINER" | "DIRECT";
  recipeId: string | null;
  productionLineId: string | null; // ★ R1-3 추가
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
    }
  // ★ Phase 9-C-Fix-R1-3
  | {
      kind: "MULTI_LINE_REQUIRES_QUANTITY";
      recipeId: string;
      // 그룹 내 등장한 productionLine 개수 (전부 quantity=0인 슬롯들 기준)
      productionLineCount: number;
      // 검사 대상 슬롯 ID들 (UI에서 강조 표시용)
      zeroSlotIds: string[];
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

    // (a) 전부 0 → fallback 가능 여부 검사
    if (positive.length === 0) {
      // ★ R1-3: productionLine 다양성 검사
      const lineIds = new Set(
        list.map((s) => s.productionLineId).filter((id) => id != null),
      );
      if (lineIds.size > 1) {
        violations.push({
          kind: "MULTI_LINE_REQUIRES_QUANTITY",
          recipeId,
          productionLineCount: lineIds.size,
          zeroSlotIds: list.map((s) => s.id),
        });
        continue;
      }
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

// ════════════════════════════════════════════════════════════════
// Phase 9-C-Fix-R1-6: 상태 전환 가드용 신규 헬퍼
// ────────────────────────────────────────────────────────────────
// 정책: 식단 데이터 정합성은 IN_PROGRESS 진입 시점에 단일 검증.
// - assertAllEstimatedCountsFilled: CONFIRMED → IN_PROGRESS 진입 시
// - assertAllFinalCountsFilled:     IN_PROGRESS → COMPLETED 진입 시
//
// 에러 포맷:
//   GROUP_ESTIMATED_COUNT_MISSING::<firstMealPlanId>::<moreCount>
//   GROUP_FINAL_COUNT_MISSING::<firstMealPlanId>::<moreCount>
//   GROUP_NO_MEAL_PLAN  (식단이 하나도 없음)
// ════════════════════════════════════════════════════════════════

async function assertAllEstimatedCountsFilled(
  tx: DbClient,
  mealPlanGroupId: string,
): Promise<void> {
  const mealPlans = await tx.mealPlan.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: { id: true, companyMealSlotId: true, lineupId: true },
  });
  if (mealPlans.length === 0) {
    throw new Error("GROUP_NO_MEAL_PLAN");
  }

  const counts = await tx.mealCount.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: { companyMealSlotId: true, lineupId: true, estimatedCount: true },
  });
  const countMap = new Map<string, number | null>();
  for (const c of counts) {
    countMap.set(`${c.companyMealSlotId}::${c.lineupId}`, c.estimatedCount);
  }

  const missing: string[] = [];
  for (const mp of mealPlans) {
    const v = countMap.get(`${mp.companyMealSlotId}::${mp.lineupId}`);
    if (v == null) missing.push(mp.id);
  }
  if (missing.length > 0) {
    const more = missing.length - 1;
    throw new Error(`GROUP_ESTIMATED_COUNT_MISSING::${missing[0]}::${more}`);
  }
}

async function assertAllFinalCountsFilled(
  tx: DbClient,
  mealPlanGroupId: string,
): Promise<void> {
  const mealPlans = await tx.mealPlan.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: { id: true, companyMealSlotId: true, lineupId: true },
  });
  if (mealPlans.length === 0) {
    throw new Error("GROUP_NO_MEAL_PLAN");
  }

  const counts = await tx.mealCount.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: { companyMealSlotId: true, lineupId: true, finalCount: true },
  });
  const countMap = new Map<string, number | null>();
  for (const c of counts) {
    countMap.set(`${c.companyMealSlotId}::${c.lineupId}`, c.finalCount);
  }

  const missing: string[] = [];
  for (const mp of mealPlans) {
    const v = countMap.get(`${mp.companyMealSlotId}::${mp.lineupId}`);
    if (v == null) missing.push(mp.id);
  }
  if (missing.length > 0) {
    const more = missing.length - 1;
    throw new Error(`GROUP_FINAL_COUNT_MISSING::${missing[0]}::${more}`);
  }
}

/**
 * Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
 *
 * 정책:
 *   - 그룹이 DRAFT 일 때 식단/슬롯/식수/부자재 mutation 발생 시 호출
 *   - DRAFT 가 아니면 no-op (idempotent)
 *   - 실패는 본 mutation 결과에 영향 주지 않도록 호출부에서 swallow
 */
async function promoteDraftToConfirmedIfNeeded(
  tx: DbClient,
  mealPlanGroupId: string,
): Promise<void> {
  const g = await tx.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, deletedAt: null },
    select: { status: true },
  });
  if (!g || g.status !== MealPlanStatus.DRAFT) return;
  await tx.mealPlanGroup.update({
    where: { id: mealPlanGroupId },
    data: { status: MealPlanStatus.CONFIRMED },
  });
}

/**
 * Phase 9-C-Fix-K2: 그룹 단위 슬롯 수량 검증.
 * 각 MealPlan 의 CONTAINER 슬롯에 대해 validateSlotQuantitiesForMealPlan 을
 * 호출하고, 하나라도 실패하면 즉시 throw.
 *
 * @throws Error("GROUP_SLOT_QTY_PARTIAL_INPUT::<mealPlanId>::<zeroCount>")
 * @throws Error("GROUP_SLOT_QTY_SUM_MISMATCH::<mealPlanId>::<mealCount>::<slotsSum>")
 * @throws Error("GROUP_MISSING_MEAL_COUNT::<mealPlanId>")
 *
 * Phase 9-D-Sym: countSource 인자 추가 — 어느 컬럼 쌍(estimated/final)을 검증할지 분기.
 *   - "ESTIMATED": mc.estimatedCount × slot.estimatedQuantity
 *   - "FINAL":     mc.finalCount     × slot.finalQuantity (NULL은 PARTIAL_INPUT로 처리)
 */
async function assertGroupSlotQuantitiesValid(
  tx: DbClient,
  mealPlanGroupId: string,
  countSource: "ESTIMATED" | "FINAL",
): Promise<void> {
  const mealPlans = await tx.mealPlan.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: {
      id: true,
      companyMealSlotId: true,
      lineupId: true,
      slots: {
        where: { deletedAt: null },
        select: {
          id: true,
          kind: true,
          // ★ Phase 9-D-Sym: estimated/final 둘 다 select
          estimatedQuantity: true,
          finalQuantity: true,
          recipeId: true,
          productionLineId: true,
        },
      },
    },
  });

  // 식수 맵 — countSource에 따라 다른 컬럼 사용
  const mealCounts = await tx.mealCount.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    select: {
      companyMealSlotId: true,
      lineupId: true,
      estimatedCount: true,
      finalCount: true,
    },
  });
  const countMap = new Map<string, number>();
  for (const mc of mealCounts) {
    // ★ Phase 9-D-Sym: countSource 기반 선택. fallback 없음 — 누락은 GROUP_MISSING_MEAL_COUNT로 처리.
    const v =
      countSource === "ESTIMATED" ? mc.estimatedCount : mc.finalCount;
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

    // ★ Phase 9-C-Fix-R1-2 + 9-D-Sym: 레시피 그룹 단위 검증
    // countSource에 따라 estimatedQuantity 또는 finalQuantity 를 입력 값으로 사용.
    // FINAL인데 슬롯의 finalQuantity가 NULL이면 0으로 처리되어 PARTIAL_INPUT로 검출됨.
    const result = validateSlotQuantitiesForMealPlan(
      mp.id,
      mc,
      containerSlots.map((s) => ({
        id: s.id,
        quantity:
          countSource === "ESTIMATED"
            ? (s.estimatedQuantity ?? 0)
            : (s.finalQuantity ?? 0),
        kind: "CONTAINER" as const,
        recipeId: s.recipeId,
        productionLineId: s.productionLineId,
      })),
    );
    if (!result.ok) {
      // 위반이 여러 건이면 첫 건을 throw + 추가 건수 전달
      // (action 레이어에서 "외 N건" 표기에 활용)
      const first = result.violations[0];
      const more = result.violations.length - 1;
      if (first.kind === "PARTIAL_INPUT") {
        throw new Error(
          `GROUP_SLOT_QTY_PARTIAL_INPUT::${mp.id}::${first.recipeId}::${first.zeroSlotIds.length}::${first.totalSlotCount}::${more}`,
        );
      }
      if (first.kind === "SUM_MISMATCH") {
        throw new Error(
          `GROUP_SLOT_QTY_SUM_MISMATCH::${mp.id}::${first.recipeId}::${first.mealCount}::${first.slotsSum}::${more}`,
        );
      }
      if (first.kind === "MULTI_LINE_REQUIRES_QUANTITY") {
        throw new Error(
          `GROUP_SLOT_QTY_MULTI_LINE::${mp.id}::${first.recipeId}::${first.productionLineCount}::${more}`,
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

  const isStatusChange = input.status && input.status !== existing.status;
  const isForwardToInProgress =
    isStatusChange &&
    existing.status === MealPlanStatus.CONFIRMED &&
    input.status === MealPlanStatus.IN_PROGRESS;
  const isForwardToCompleted =
    isStatusChange &&
    existing.status === MealPlanStatus.IN_PROGRESS &&
    input.status === MealPlanStatus.COMPLETED;

  // ★ Phase 4-G G-1: 전진 전이는 [검증 → 상태 update → MR 자동 산출] 을
  //   단일 트랜잭션에 묶어 부분 상태 방지.
  //   그 외 전이(역행 / 취소 / note-only)는 기존처럼 단순 update.
  //
  //   재산출 트리거는 별도로 두지 않음 (G-1-b) — 사용자가 재산출을 원하면
  //   상태를 되돌린 뒤 다시 전진하면 자연 재산출된다.
  //
  //   unmapped 품목(default supplier 미지정 등)이 있어도 MR 산출 자체는
  //   성공한다 (G-1-c). unmapped 판정은 발주 위저드 Step 2 책임.
  if (isForwardToInProgress || isForwardToCompleted) {
    return await prisma.$transaction(async (tx) => {
      // 1) 검증 (tx 사용)
      if (isForwardToInProgress) {
        await assertAllEstimatedCountsFilled(tx, id);
        await assertGroupSlotQuantitiesValid(tx, id, "ESTIMATED");
      } else {
        await assertAllFinalCountsFilled(tx, id);
        await assertGroupSlotQuantitiesValid(tx, id, "FINAL");
      }

      // 2) 상태 update 를 먼저 커밋 — generateMaterialRequirements 의
      //    상태 가드(INVALID_STATUS_FOR_ESTIMATED/FINAL) 통과 조건
      const updated = await tx.mealPlanGroup.update({
        where: { id },
        data: {
          status: input.status,
          note: input.note,
        },
        include: GROUP_DETAIL_INCLUDE,
      });

      // 3) MR 자동 산출 (동일 트랜잭션 합류)
      //    실패 시 전체 롤백 → status 도 원복
      const countSource = isForwardToInProgress
        ? MealCountSource.ESTIMATED
        : MealCountSource.FINAL;
      await generateMaterialRequirements(
        companyId,
        { mealPlanGroupId: id, countSource },
        { existingTx: tx },
      );

      return updated;
    });
  }

  // 그 외 전이 (역행 / 취소 / note-only): 기존 그대로
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
              // ★ Phase 9-D-Sym: estimatedQuantity는 그대로 복사, finalQuantity는 복사하지 않음
              //   (복사된 식단은 신규 작성 상태이므로 final은 NULL로 초기화)
              estimatedQuantity: s.estimatedQuantity,
              finalQuantity: null,
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

  const companyMealSlotId = await resolveCompanyMealSlotIdFromInput(
    prisma,
    companyId,
    input,
  );

  try {
    const created = await prisma.mealPlan.create({
      data: {
        mealPlanGroupId,
        companyMealSlotId,
        lineupId: input.lineupId,
        mealTemplateId: input.mealTemplateId,
        note: input.note,
      },
      include: MEAL_PLAN_INCLUDE,
    });
    // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
    await promoteDraftToConfirmedIfNeeded(prisma, mealPlanGroupId).catch(() => {});
    return created;
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
  // ★ Phase 9-C-Fix-R1-6: 반환값 받아서 mealPlanGroupId 활용
  const plan = await assertMealPlanInCompany(prisma, companyId, id);

  const updated = await prisma.mealPlan.update({
    where: { id },
    data: {
      mealTemplateId: input.mealTemplateId,
      note: input.note,
    },
    include: MEAL_PLAN_INCLUDE,
  });
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, plan.mealPlanGroupId).catch(() => {});
  return updated;
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
  // ★ Phase 9-C-Fix-R1-6: 반환값 받아서 mealPlanGroupId 활용
  const plan = await assertMealPlanInCompany(prisma, companyId, mealPlanId);

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

    const resolvedBomId = await resolveAndAssertBomMatch(
      input.recipeId,
      input.subsidiaryMasterId,
      input.containerSlotIndex,
    );

    const created = await prisma.mealPlanSlot.create({
      data: {
        mealPlanId,
        kind: "CONTAINER",
        sortOrder: input.sortOrder,
        // ★ Phase 9-D-Sym: estimated/final 분리. final은 슬롯 생성 시점엔 NULL.
        estimatedQuantity: input.estimatedQuantity,
        finalQuantity: input.finalQuantity ?? null,
        note: input.note,
        productionLineId: input.productionLineId,
        subsidiaryMasterId: input.subsidiaryMasterId,
        containerSlotIndex: input.containerSlotIndex,
        recipeId: input.recipeId,
        recipeBomId: resolvedBomId,
      },
      include: SLOT_INCLUDE,
    });
    // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
    await promoteDraftToConfirmedIfNeeded(prisma, plan.mealPlanGroupId).catch(() => {});
    return created;
  }

  // DIRECT
  const supplierItem = await prisma.supplierItem.findFirst({
    where: {
      id: input.supplierItemId,
      supplier: { companyId, deletedAt: null },
    },
    select: { id: true },
  });
  if (!supplierItem) throw new Error("SUPPLIER_ITEM_NOT_FOUND");

  const created = await prisma.mealPlanSlot.create({
    data: {
      mealPlanId,
      kind: "DIRECT",
      sortOrder: input.sortOrder,
      // ★ Phase 9-D-Sym
      estimatedQuantity: input.estimatedQuantity,
      finalQuantity: input.finalQuantity ?? null,
      note: input.note,
      productionLineId: input.productionLineId,
      supplierItemId: input.supplierItemId,
    },
    include: SLOT_INCLUDE,
  });
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, plan.mealPlanGroupId).catch(() => {});
  return created;
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
      mealPlan: { select: { mealPlanGroupId: true } }, // ★ R1-6
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

  // ★ Phase 9-D-Sym: estimatedQuantity / finalQuantity 분리 갱신
  const data: Prisma.MealPlanSlotUpdateInput = {
    sortOrder: input.sortOrder,
    estimatedQuantity: input.estimatedQuantity,
    finalQuantity: input.finalQuantity,
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

  const updated = await prisma.mealPlanSlot.update({
    where: { id },
    data,
    include: SLOT_INCLUDE,
  });
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, existing.mealPlan.mealPlanGroupId).catch(() => {});
  return updated;
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
  // ★ Phase 9-C-Fix-R1-6: 반환값 받아서 mealPlanGroupId 활용
  const plan = await assertMealPlanInCompany(prisma, companyId, mealPlanId);

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
    // ★ Phase 9-D-Sym: bulk 생성은 신규 식단 작성 단계 → estimated만 입력, final은 NULL.
    estimatedQuantity: it.estimatedQuantity ?? 0,
    // finalQuantity는 default NULL (생략)
    note: it.note ?? null,
  }));

  // 5) 트랜잭션 일괄 생성 후 생성된 슬롯들 반환
  const result = await prisma.$transaction(async (tx) => {
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
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, plan.mealPlanGroupId).catch(() => {});
  return result;
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

  const companyMealSlotId = await resolveCompanyMealSlotIdFromInput(
    prisma,
    companyId,
    input,
  );

  const result = await prisma.mealCount.upsert({
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
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, mealPlanGroupId).catch(() => {});
  return result;
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

  const result = await prisma.$transaction(
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
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, mealPlanGroupId).catch(() => {});
  return result;
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
  // ★ Phase 9-C-Fix-R1-6: 반환값 받아서 mealPlanGroupId 활용
  const plan = await assertMealPlanInCompany(prisma, companyId, mealPlanId);

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

  const created = await prisma.mealPlanAccessory.create({
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
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, plan.mealPlanGroupId).catch(() => {});
  return created;
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
    select: {
      id: true,
      consumptionMode: true,
      fixedQuantity: true,
      mealPlan: { select: { mealPlanGroupId: true } }, // ★ R1-6
    },
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

  const updated = await prisma.mealPlanAccessory.update({
    where: { id },
    data,
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, existing.mealPlan.mealPlanGroupId).catch(() => {});
  return updated;
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
  // ★ Phase 9-C-Fix-R1-6: 반환값 받아서 mealPlanGroupId 활용
  const plan = await assertMealPlanInCompany(prisma, companyId, mealPlanId);

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

  const result = await prisma.$transaction(async (tx) => {
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
          // ★ Phase 9-D-Sym: 템플릿 적용은 신규 작성 → estimated 0, final NULL
          estimatedQuantity: 0,
          // finalQuantity는 default NULL
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
  // ★ Phase 9-C-Fix-R1-6: DRAFT → CONFIRMED 자동 승격
  await promoteDraftToConfirmedIfNeeded(prisma, plan.mealPlanGroupId).catch(() => {});
  return result;
}
