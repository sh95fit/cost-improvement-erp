// src/features/material-requirement/services/material-requirement.service.ts
import { prisma } from "@/lib/prisma";
import {
  BOMStatus,
  IngredientType,
  MealCountSource,
  Prisma,
  SlotKind,
  type MaterialRequirement,
} from "@prisma/client";

import {
  MATERIAL_REQUIREMENT_ERRORS,
  type GenerateMaterialRequirementsInput,
  type GenerateResult,
  type GetMaterialRequirementByIdInput,
  type ListMaterialRequirementsQuery,
} from "../schemas/material-requirement.schema";

import {
  validateSlotQuantitiesForMealPlan,
  type RecipeGroupOk,
} from "@/features/meal-plan/services/meal-plan.service";

// ============================================================
// Phase 9-A-2: MaterialRequirement Service
// ------------------------------------------------------------
// 핵심 책임:
//   1) generateMaterialRequirements:
//      MealPlanGroup의 CONTAINER 슬롯들을 펼쳐 (라인 × 자재) 단위로
//      소요량을 합산하고, 기존 MR 행과 diff하여 UPSERT/UNDELETE/SOFT-DELETE.
//   2) listMaterialRequirements: 그룹/라인/자재/countSource 필터 조회.
//   3) getMaterialRequirementById: 단건 조회.
//
// 정책 (PROGRESS.md "Phase 9-A 결정사항" 참조):
//   - CONTAINER 슬롯만 대상. DIRECT는 stats.directSlotsSkipped로 집계 후 제외.
//   - MealPlanAccessory는 9-A 범위 외(소비처리 단계에서 다룸).
//   - 단위는 항상 "g" 기준으로 정규화 저장. kg→g 자동, 기타 단위는 UnitConversion 조회.
//   - RecipeBOMSlotItem.weightG는 "1인분 기준" → addQty = weightG × mealCount.
//   - 반제품(SEMI_PRODUCT)은 ACTIVE 상태 BOM 1-level 재귀로 펼침.
//   - RecipeBOM도 ACTIVE 상태만 사용(사용자: "사용중인 것 기준").
//   - 산출에 필요한 값이 하나라도 빠지면 산출 전체 중단(throw).
// ============================================================

// ============================================================
// 내부 타입
// ============================================================

interface AggregatedRequirement {
  productionLineId: string;
  locationId: string;
  materialMasterId: string;
  requiredQty: number; // grams
}

interface CalculationStats {
  recipeContainerSlots: number;
  directSlotsSkipped: number;
  // ★ Phase 9-C-Fix-H: 슬롯 수량 합계 ≠ MealCount 인 MealPlan 경고
  slotQuantityMismatchWarnings: number;
  mismatchDetails: Array<{
    mealPlanId: string;
    mealCount: number;
    slotsSum: number;
  }>;
}

// 부동소수점 비교 허용 오차 (g 단위)
const EPSILON = 1e-6;

// ============================================================
// 1. generateMaterialRequirements
// ============================================================

export async function generateMaterialRequirements(
  companyId: string,                                       
  input: GenerateMaterialRequirementsInput,
): Promise<GenerateResult> {
  const { mealPlanGroupId, countSource } = input;

  return await prisma.$transaction(async (tx) => {
    // ---- Step 1-1. 그룹 조회 (회사 가드 포함) ----
    const group = await tx.mealPlanGroup.findFirst({
      where: { id: mealPlanGroupId, companyId, deletedAt: null },  
      select: { id: true, companyId: true },
    });
    if (!group) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.GROUP_NOT_FOUND);
    }

    // ---- Step 1-2. 소요량 계산 ----
    const { required, stats } = await calculateRequirementsForGroup(
      mealPlanGroupId,
      group.companyId,
      countSource,
      tx,
    );

    // ---- Step 1-3. 기존 MR 행 조회 (soft-deleted 포함) ----
    const existing = await tx.materialRequirement.findMany({
      where: { mealPlanGroupId, countSource },
    });
    const existingMap = new Map<string, MaterialRequirement>();
    for (const row of existing) {
      existingMap.set(makeKey(row.productionLineId, row.materialMasterId), row);
    }

    // ---- Step 1-4. Diff 적용 ----
    let inserted = 0;
    let updated = 0;
    let undeleted = 0;
    let softDeleted = 0;
    let unchanged = 0;
    let maxVersion = 0;
    const now = new Date();

    for (const [key, agg] of required) {
      const prev = existingMap.get(key);

      if (!prev) {
        // 신규 키 → INSERT
        const created = await tx.materialRequirement.create({
          data: {
            companyId: group.companyId,
            mealPlanGroupId,
            productionLineId: agg.productionLineId,
            locationId: agg.locationId,
            materialMasterId: agg.materialMasterId,
            requiredQty: agg.requiredQty,
            unit: "g",
            countSource,
            generationVersion: 1,
          },
        });
        inserted++;
        if (created.generationVersion > maxVersion) {
          maxVersion = created.generationVersion;
        }
      } else if (prev.deletedAt !== null) {
        // soft-deleted였던 키가 다시 등장 → UNDELETE + 수량 갱신
        const next = prev.generationVersion + 1;
        await tx.materialRequirement.update({
          where: { id: prev.id },
          data: {
            requiredQty: agg.requiredQty,
            unit: "g",
            locationId: agg.locationId, // 라인 → 위치 매핑이 바뀌었을 수 있음
            deletedAt: null,
            generationVersion: next,
          },
        });
        undeleted++;
        if (next > maxVersion) maxVersion = next;
      } else if (
        Math.abs(prev.requiredQty - agg.requiredQty) > EPSILON ||
        prev.unit !== "g" ||
        prev.locationId !== agg.locationId
      ) {
        // 활성이지만 값이 다름 → UPDATE
        const next = prev.generationVersion + 1;
        await tx.materialRequirement.update({
          where: { id: prev.id },
          data: {
            requiredQty: agg.requiredQty,
            unit: "g",
            locationId: agg.locationId,
            generationVersion: next,
          },
        });
        updated++;
        if (next > maxVersion) maxVersion = next;
      } else {
        // 변경 없음
        unchanged++;
        if (prev.generationVersion > maxVersion) {
          maxVersion = prev.generationVersion;
        }
      }
      existingMap.delete(key);
    }

    // 남은 existing 중 활성 행 → SOFT-DELETE
    for (const row of existingMap.values()) {
      if (row.deletedAt !== null) continue;
      const next = row.generationVersion + 1;
      await tx.materialRequirement.update({
        where: { id: row.id },
        data: {
          deletedAt: now,
          generationVersion: next,
        },
      });
      softDeleted++;
      if (next > maxVersion) maxVersion = next;
    }

    // ---- Step 1-5. 빈 산출 가드 ----
    // 슬롯은 있었지만 모두 DIRECT여서 산출 행 0건이고 기존 행도 없는 경우 → GROUP_EMPTY
    if (
      required.size === 0 &&
      inserted === 0 &&
      updated === 0 &&
      undeleted === 0 &&
      softDeleted === 0 &&
      unchanged === 0
    ) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.GROUP_EMPTY);
    }

    return {
      mealPlanGroupId,
      countSource,
      generationVersion: maxVersion,
      stats: {
        inserted, updated, undeleted, softDeleted, unchanged,
        recipeContainerSlots: stats.recipeContainerSlots,
        directSlotsSkipped: stats.directSlotsSkipped,
        // ★ Phase 9-C-Fix-H
        slotQuantityMismatchWarnings: stats.slotQuantityMismatchWarnings,
        mismatchDetails: stats.mismatchDetails,
      },
    };
  });
}

// ============================================================
// 2. listMaterialRequirements
// ------------------------------------------------------------
// UI 표시용으로 materialMaster / productionLine / location 관계를
// 한 번에 조회 (N+1 방지). 정렬은 라인 → 자재 → countSource 순.
// ============================================================

// UI 표시에 필요한 관계 include 형태
const LIST_INCLUDE = {
  materialMaster: {
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,            // MaterialMaster.unit (예: "kg", "ea")
      unitCategory: true,
      materialType: true,
    },
  },
  productionLine: {
    select: {
      id: true,
      code: true,
      name: true,
      locationId: true,
    },
  },
  location: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.MaterialRequirementInclude;

export type MaterialRequirementListItem = Prisma.MaterialRequirementGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

export async function listMaterialRequirements(
  companyId: string,
  query: ListMaterialRequirementsQuery,
): Promise<{
  items: MaterialRequirementListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    mealPlanGroupId,
    productionLineId,
    materialMasterId,
    countSource,
    activeOnly,
    page,
    limit,
  } = query;

  const where: Prisma.MaterialRequirementWhereInput = {
    companyId,
    mealPlanGroupId,
    ...(productionLineId ? { productionLineId } : {}),
    ...(materialMasterId ? { materialMasterId } : {}),
    ...(countSource ? { countSource } : {}),
    ...(activeOnly ? { deletedAt: null } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.materialRequirement.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: [
        { productionLine: { name: "asc" } },
        { materialMaster: { name: "asc" } },
        { countSource: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.materialRequirement.count({ where }),
  ]);

  return { items, total, page, limit };
}

// ============================================================
// 3. getMaterialRequirementById
// ============================================================

export async function getMaterialRequirementById(
  companyId: string,       
  input: GetMaterialRequirementByIdInput,
): Promise<MaterialRequirement | null> {
  return await prisma.materialRequirement.findFirst({     
    where: { id: input.id, companyId },   
  });
}

// ============================================================
// 4. calculateRequirementsForGroup (내부 헬퍼)
// ------------------------------------------------------------
// 그룹의 CONTAINER 슬롯을 (MealPlan × recipeId) 그룹 단위로 펼쳐
// (라인 × 자재) 합산 맵을 만든다. 반제품 1-level 재귀 펼치기 포함.
//
// Phase 9-C-Fix-R1-3: 본 산출 루프를 레시피 그룹 단위로 재작성.
//   - FALLBACK 그룹: BOM × mealCount 1회 전개 (라인 1:1 보장 시)
//   - DISTRIBUTED 그룹: 슬롯별 quantity로 라인별 BOM 전개
//   - 같은 recipeId × 다중 슬롯에서의 중복 누적 결함 제거
// ============================================================

async function calculateRequirementsForGroup(
  mealPlanGroupId: string,
  companyId: string,
  countSource: MealCountSource,
  tx: Prisma.TransactionClient,
): Promise<{
  required: Map<string, AggregatedRequirement>;
  stats: CalculationStats;
}> {
  // ---- (a) MealCount 맵 구축 ----
  // key = `${companyMealSlotId}::${lineupId}` → count
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
    const raw =
      countSource === MealCountSource.ESTIMATED
        ? mc.estimatedCount
        : mc.finalCount;
    if (raw == null) continue; // null이면 맵에서 제외 → 후속 검증 루프에서 throw
    countMap.set(`${mc.companyMealSlotId}::${mc.lineupId}`, raw);
  }

  // ---- (b) MealPlanSlot 조회 (CONTAINER+DIRECT 전부, 필요한 관계 include) ----
  const slots = await tx.mealPlanSlot.findMany({
    where: {
      deletedAt: null,
      mealPlan: { mealPlanGroupId, deletedAt: null },
    },
    include: {
      mealPlan: {
        select: { companyMealSlotId: true, lineupId: true },
      },
      productionLine: {
        select: { id: true, locationId: true },
      },
      recipeBom: {
        select: {
          id: true,
          status: true,
          slots: {
            select: {
              id: true,
              items: {
                select: {
                  ingredientType: true,
                  materialMasterId: true,
                  semiProductId: true,
                  weightG: true,
                  unit: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // ---- (c) 합산/통계 변수 ----
  const required = new Map<string, AggregatedRequirement>();
  let recipeContainerSlots = 0;
  let directSlotsSkipped = 0;
  // (현재 미사용, R1-5에서 정리 예정 — schema/return 타입과 모양 맞추기 위해 유지)
  const slotQuantityMismatchWarnings = 0;
  const mismatchDetails: Array<{
    mealPlanId: string;
    mealCount: number;
    slotsSum: number;
  }> = [];

  // ---- (d) CONTAINER 슬롯을 MealPlan별로 그룹핑 ----
  const containerSlots = slots.filter((s) => s.kind === SlotKind.CONTAINER);
  const slotsByMealPlan = new Map<string, typeof containerSlots>();
  for (const s of containerSlots) {
    const arr = slotsByMealPlan.get(s.mealPlanId) ?? [];
    arr.push(s);
    slotsByMealPlan.set(s.mealPlanId, arr);
  }

  // ---- (e) ★ R1-3: 검증 결과(okGroups)를 산출 단계에서 재사용하기 위한 맵 ----
  const okGroupsByMealPlan = new Map<string, RecipeGroupOk[]>();

  // ---- (f) 검증 루프 (Phase 9-C-Fix-K1 + R1-2 + R1-3) ----
  //   - 레시피 그룹 단위로 검증, 위반 시 throw
  //   - 통과 시 okGroups를 (g) 산출 루프에서 재사용
  for (const [mealPlanId, list] of slotsByMealPlan) {
    const repSlot = list[0];
    const countKey = `${repSlot.mealPlan.companyMealSlotId}::${repSlot.mealPlan.lineupId}`;
    const mc = countMap.get(countKey);
    if (mc == null) {
      throw new Error(
        `${MATERIAL_REQUIREMENT_ERRORS.MISSING_MEAL_COUNT}::${mealPlanId}`,
      );
    }

    const result = validateSlotQuantitiesForMealPlan(
      mealPlanId,
      mc,
      list.map((s) => ({
        id: s.id,
        quantity: s.quantity ?? 0,
        kind: "CONTAINER" as const,
        recipeId: s.recipeId,
        productionLineId: s.productionLineId,
      })),
    );

    if (!result.ok) {
      const firstV = result.violations[0];
      const more = result.violations.length - 1;
      if (firstV.kind === "PARTIAL_INPUT") {
        throw new Error(
          `${MATERIAL_REQUIREMENT_ERRORS.SLOT_QTY_PARTIAL_INPUT}::${mealPlanId}::${firstV.recipeId}::${firstV.zeroSlotIds.length}::${firstV.totalSlotCount}::${more}`,
        );
      }
      if (firstV.kind === "SUM_MISMATCH") {
        throw new Error(
          `${MATERIAL_REQUIREMENT_ERRORS.SLOT_QTY_SUM_MISMATCH}::${mealPlanId}::${firstV.recipeId}::${firstV.mealCount}::${firstV.slotsSum}::${more}`,
        );
      }
      if (firstV.kind === "MULTI_LINE_REQUIRES_QUANTITY") {
        throw new Error(
          `${MATERIAL_REQUIREMENT_ERRORS.MULTI_LINE_REQUIRES_QUANTITY}::${mealPlanId}::${firstV.recipeId}::${firstV.productionLineCount}::${more}`,
        );
      }
    }

    okGroupsByMealPlan.set(
      mealPlanId,
      result.ok ? result.groups : result.okGroups,
    );
  }

  // ---- (g) ★ R1-3 본 산출 루프: (MealPlan × recipeId) 그룹 단위 1회 BOM 전개 ----
  //
  //  - FALLBACK 그룹 (전부 quantity=0):
  //      검증 단계에서 라인 1:1임이 보장 → 그 라인에 BOM × mealCount 1회 전개
  //  - DISTRIBUTED 그룹 (모두 quantity>0):
  //      슬롯별 quantity로 라인별 BOM 전개
  //
  //  recipeId=null 슬롯은 검증/산출 모두에서 자연 제외됨.
  for (const [mealPlanId, list] of slotsByMealPlan) {
    const okGroups = okGroupsByMealPlan.get(mealPlanId);
    if (!okGroups || okGroups.length === 0) continue; // 방어적

    // recipeId → 그룹 OK 결과
    const okByRecipe = new Map<string, RecipeGroupOk>();
    for (const g of okGroups) okByRecipe.set(g.recipeId, g);

    // recipeId → 그룹 내 슬롯들
    const slotsByRecipe = new Map<string, typeof list>();
    for (const s of list) {
      if (s.recipeId == null) continue;
      const arr = slotsByRecipe.get(s.recipeId) ?? [];
      arr.push(s);
      slotsByRecipe.set(s.recipeId, arr);
    }

    for (const [recipeId, ok] of okByRecipe) {
      const groupSlots = slotsByRecipe.get(recipeId) ?? [];
      if (groupSlots.length === 0) continue;

      // BOM 검증: 같은 recipeId 그룹은 같은 recipeBom을 가진다고 전제
      const repSlot = groupSlots[0];
      if (!repSlot.recipeBomId || !repSlot.recipeBom) {
        throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
      }
      if (repSlot.recipeBom.status !== BOMStatus.ACTIVE) {
        throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
      }

      if (ok.mode === "FALLBACK") {
        // 검증상 라인 1:1 보장 → 첫 슬롯의 라인에 1회 전개
        const repLineSlot = groupSlots.find(
          (s) => s.productionLineId != null && s.productionLine != null,
        );
        if (
          !repLineSlot ||
          !repLineSlot.productionLineId ||
          !repLineSlot.productionLine
        ) {
          throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_PRODUCTION_LINE);
        }
        const locationId = repLineSlot.productionLine.locationId;
        if (!locationId) {
          throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_LOCATION);
        }

        await expandBomAndAccumulate({
          required,
          recipeBom: repSlot.recipeBom,
          effectiveCount: ok.effectiveCount,
          productionLineId: repLineSlot.productionLineId,
          locationId,
          companyId,
          tx,
        });
        // BOM은 1회 전개됐지만 슬롯 개수는 그대로 카운트
        recipeContainerSlots += groupSlots.length;
      } else {
        // DISTRIBUTED: 슬롯별 quantity로 라인별 전개
        for (const slot of groupSlots) {
          if (!slot.productionLineId || !slot.productionLine) {
            throw new Error(
              MATERIAL_REQUIREMENT_ERRORS.MISSING_PRODUCTION_LINE,
            );
          }
          const locationId = slot.productionLine.locationId;
          if (!locationId) {
            throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_LOCATION);
          }
          const qty = slot.quantity ?? 0;
          if (qty <= 0) continue; // 방어적 (DISTRIBUTED는 검증상 모두 양수)

          await expandBomAndAccumulate({
            required,
            recipeBom: repSlot.recipeBom,
            effectiveCount: qty,
            productionLineId: slot.productionLineId,
            locationId,
            companyId,
            tx,
          });
          recipeContainerSlots++;
        }
      }
    }
  }

  // ---- (h) DIRECT 슬롯 통계 (검증·산출 모두 제외, 카운트만) ----
  directSlotsSkipped = slots.filter((s) => s.kind === SlotKind.DIRECT).length;

  // ---- (i) return ----
  return {
    required,
    stats: {
      recipeContainerSlots,
      directSlotsSkipped,
      slotQuantityMismatchWarnings,
      mismatchDetails,
    },
  };
}
  
// ============================================================
// 헬퍼: 단위 환산 (→ "g")
// ------------------------------------------------------------
// 1) fromUnit === "g" → 그대로
// 2) fromUnit === "kg" → ×1000 (시스템 기본 변환)
// 3) UnitConversion(companyId, materialMasterId, fromUnit, toUnit="g") 조회
//    materialMasterId가 null이면 일반 환산표(materialMasterId IS NULL)
// 4) 모두 실패 → MR_INVALID_UNIT throw
// ============================================================

async function convertToG(
  qty: number,
  fromUnit: string,
  materialMasterId: string | null,
  companyId: string,
  tx: Prisma.TransactionClient,
): Promise<number> {
  if (fromUnit === "g") return qty;
  if (fromUnit === "kg") return qty * 1000;

  const conv = await tx.unitConversion.findFirst({
    where: {
      companyId,
      materialMasterId: materialMasterId ?? null,
      fromUnit,
      toUnit: "g",
    },
    select: { factor: true },
  });

  if (!conv) {
    // 자재별 환산표가 없으면 일반 환산표(materialMasterId IS NULL)도 시도
    if (materialMasterId !== null) {
      const generic = await tx.unitConversion.findFirst({
        where: {
          companyId,
          materialMasterId: null,
          fromUnit,
          toUnit: "g",
        },
        select: { factor: true },
      });
      if (generic) return qty * generic.factor;
    }
    throw new Error(MATERIAL_REQUIREMENT_ERRORS.INVALID_UNIT);
  }

  return qty * conv.factor;
}

// ============================================================
// 헬퍼: 합산 맵에 누적
// ============================================================

function accumulate(
  map: Map<string, AggregatedRequirement>,
  next: AggregatedRequirement,
): void {
  const key = makeKey(next.productionLineId, next.materialMasterId);
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...next });
  } else {
    // 같은 (line, material)이면 locationId는 반드시 동일해야 함
    // (locationId는 productionLine에 종속되므로)
    prev.requiredQty += next.requiredQty;
  }
}

function makeKey(productionLineId: string, materialMasterId: string): string {
  return `${productionLineId}::${materialMasterId}`;
}

// ============================================================
// 헬퍼: BOM 전개 + 누적 (Phase 9-C-Fix-R1-3에서 분리)
// ------------------------------------------------------------
// 같은 recipeId 그룹에 대해 1회 호출되며, effectiveCount만큼 곱해 누적.
// ============================================================

// expandBomAndAccumulate가 필요로 하는 recipeBom의 최소 형태.
// 호출부의 select와 정확히 일치해야 함 (calculateRequirementsForGroup의 (b) include 참조).
type BomForExpand = {
  slots: Array<{
    items: Array<{
      ingredientType: IngredientType;
      materialMasterId: string | null;
      semiProductId: string | null;
      weightG: number;
      unit: string;
    }>;
  }>;
};

async function expandBomAndAccumulate(args: {
  required: Map<string, AggregatedRequirement>;
  recipeBom: BomForExpand;
  effectiveCount: number;
  productionLineId: string;
  locationId: string;
  companyId: string;
  tx: Prisma.TransactionClient;
}): Promise<void> {
  const { required, recipeBom, effectiveCount, productionLineId, locationId, companyId, tx } = args;

  for (const bomSlot of recipeBom.slots) {
    for (const item of bomSlot.items) {
      const slotWeightG = await convertToG(
        item.weightG,
        item.unit,
        item.materialMasterId ?? null,
        companyId,
        tx,
      );

      if (item.ingredientType === IngredientType.MATERIAL) {
        if (!item.materialMasterId) {
          throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
        }
        accumulate(required, {
          productionLineId,
          locationId,
          materialMasterId: item.materialMasterId,
          requiredQty: slotWeightG * effectiveCount,
        });
      } else if (item.ingredientType === IngredientType.SEMI_PRODUCT) {
        if (!item.semiProductId) {
          throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_SEMI_PRODUCT_BOM);
        }
        const spBom = await tx.bOM.findFirst({
          where: {
            semiProductId: item.semiProductId,
            status: BOMStatus.ACTIVE,
            deletedAt: null,
          },
          select: {
            baseQuantity: true,
            baseUnit: true,
            items: {
              select: { materialMasterId: true, quantity: true, unit: true },
            },
          },
        });
        if (!spBom) {
          throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_SEMI_PRODUCT_BOM);
        }
        const baseQtyG = await convertToG(
          spBom.baseQuantity,
          spBom.baseUnit,
          null,
          companyId,
          tx,
        );
        if (baseQtyG <= 0) {
          throw new Error(MATERIAL_REQUIREMENT_ERRORS.INVALID_UNIT);
        }
        const ratio = slotWeightG / baseQtyG;
        for (const bomItem of spBom.items) {
          const itemQtyG = await convertToG(
            bomItem.quantity,
            bomItem.unit,
            bomItem.materialMasterId,
            companyId,
            tx,
          );
          accumulate(required, {
            productionLineId,
            locationId,
            materialMasterId: bomItem.materialMasterId,
            requiredQty: itemQtyG * ratio * effectiveCount,
          });
        }
      }
    }
  }
}