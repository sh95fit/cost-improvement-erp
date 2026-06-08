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
        inserted,
        updated,
        undeleted,
        softDeleted,
        unchanged,
        recipeContainerSlots: stats.recipeContainerSlots,
        directSlotsSkipped: stats.directSlotsSkipped,
      },
    };
  });
}

// ============================================================
// 2. listMaterialRequirements
// ============================================================

export async function listMaterialRequirements(
  companyId: string,      
  query: ListMaterialRequirementsQuery,
): Promise<{
  items: MaterialRequirement[];
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
      orderBy: [
        { productionLineId: "asc" },
        { materialMasterId: "asc" },
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
// 그룹의 CONTAINER 슬롯을 모두 펼쳐 (라인 × 자재) 합산 맵을 만든다.
// 반제품 1-level 재귀 펼치기 포함.
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
    if (raw == null) continue; // null이면 맵에서 제외 → 후속 슬롯에서 throw
    countMap.set(`${mc.companyMealSlotId}::${mc.lineupId}`, raw);
  }

  // ---- (b) MealPlanSlot 조회 (CONTAINER만, 필요한 관계 include) ----
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

  // ---- (c) 슬롯 순회 → 합산 맵 ----
  const required = new Map<string, AggregatedRequirement>();
  let recipeContainerSlots = 0;
  let directSlotsSkipped = 0;

  for (const slot of slots) {
    if (slot.kind === SlotKind.DIRECT) {
      directSlotsSkipped++;
      continue;
    }
    // CONTAINER
    if (!slot.productionLineId || !slot.productionLine) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_PRODUCTION_LINE);
    }
    if (!slot.recipeBomId || !slot.recipeBom) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
    }
    if (slot.recipeBom.status !== BOMStatus.ACTIVE) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
    }

    const productionLineId = slot.productionLineId;
    const locationId = slot.productionLine.locationId;
    if (!locationId) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_LOCATION);
    }

    // 인분수 조회
    const countKey = `${slot.mealPlan.companyMealSlotId}::${slot.mealPlan.lineupId}`;
    const mealCount = countMap.get(countKey);
    if (mealCount == null) {
      throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_MEAL_COUNT);
    }

    recipeContainerSlots++;

    // BOM 슬롯 → 슬롯 아이템 펼치기
    for (const bomSlot of slot.recipeBom.slots) {
      for (const item of bomSlot.items) {
        // 입력 weightG를 g로 정규화 (자재 단위가 아닌 BOM 슬롯 아이템 단위)
        // 자재 환산표는 materialMasterId 기준이지만, weightG의 단위가 'g'이면 그대로 사용.
        const slotWeightG = await convertToG(
          item.weightG,
          item.unit,
          item.materialMasterId ?? null,
          companyId,
          tx,
        );

        if (item.ingredientType === IngredientType.MATERIAL) {
          if (!item.materialMasterId) {
            // 데이터 무결성 위반 — 이론상 발생하지 않지만 방어
            throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM);
          }
          const addQty = slotWeightG * mealCount;
          accumulate(required, {
            productionLineId,
            locationId,
            materialMasterId: item.materialMasterId,
            requiredQty: addQty,
          });
        } else if (item.ingredientType === IngredientType.SEMI_PRODUCT) {
          if (!item.semiProductId) {
            throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_SEMI_PRODUCT_BOM);
          }
          // 반제품 ACTIVE BOM 1건
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
                select: {
                  materialMasterId: true,
                  quantity: true,
                  unit: true,
                },
              },
            },
          });
          if (!spBom) {
            throw new Error(MATERIAL_REQUIREMENT_ERRORS.MISSING_SEMI_PRODUCT_BOM);
          }

          // 반제품 기준량을 g로 환산 (단위환산표 또는 kg→g 자동)
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

          // 반제품 1g 당 비율 = slotWeightG / baseQtyG
          const ratio = slotWeightG / baseQtyG;

          for (const bomItem of spBom.items) {
            const itemQtyG = await convertToG(
              bomItem.quantity,
              bomItem.unit,
              bomItem.materialMasterId,
              companyId,
              tx,
            );
            const addQty = itemQtyG * ratio * mealCount;
            accumulate(required, {
              productionLineId,
              locationId,
              materialMasterId: bomItem.materialMasterId,
              requiredQty: addQty,
            });
          }
        }
      }
    }
  }

  return {
    required,
    stats: { recipeContainerSlots, directSlotsSkipped },
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