import type { Prisma } from "@prisma/client";
import {
  ConsumptionMode,
  ItemType,
  MealCountSource,
  MealPlanStatus,
  ReceivingNoteStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAvailableQty } from "@/features/inventory/services/reservation.service";
import { assertMealPlanCompletedForConsumption } from "./consumption-guard.service";

/**
 * ════════════════════════════════════════
 * S4-3-c-4-2 — buildConsumptionDraft (확장판)
 * ════════════════════════════════════════
 *
 * 헌법 P4/P8/P11/P12/P13/P14 준수.
 *
 * 이전(S4-3-b) 대비 변경:
 *   1) 집계 키: (itemType, itemId, lineupId, productionLineId) — 라인업/라인 세분화
 *   2) 부자재 consumptionMode 이원화 (PER_MEAL_COUNT + FIXED_QUANTITY)
 *   3) 공급 단위(supplyUnit) 정본 — Material.supplyUnitId / Subsidiary.supplyUnitId 경유 (발주단위 개념 폐기)
 *   4) 이론 사용량 + 반올림 최종 사용량 (Math.round, 0→1 예외)
 *   5) 라인업/라인 이름 include (UI 그룹핑)
 *   6) computeAvailability 트랜잭션 클라이언트 전달 (P11 강화)
 *
 * 스키마 실측 근거:
 *   - MaterialRequirement UNIQUE: (mealPlanGroupId, productionLineId, lineupId,
 *     materialMasterId, countSource) — 물리적으로 이미 세분화 저장
 *   - MealPlanAccessory: lineupId 필드 없음 → 라인업 무관 (lineupId=null)
 *   - UnitMaster: code(문자 심볼, 예 "kg"/"팩"), name(전체명) — symbol 필드는 없음
 *   - MaterialMaster/SubsidiaryMaster.defaultSupplierItem → SupplierItem
 *
 * Prisma 7 주의: select 내부 nested relation 은 반환 타입 추론이 불안정 →
 * findMany 는 include 방식으로 통일, 응답에서 필요한 필드만 접근.
 */

// ────────────────────────────────────────
// 타입
// ────────────────────────────────────────

export type ConsumptionDraftHeader = {
  mealPlanGroupId: string;
  planDate: Date;
  totalEstimatedCount: number;
  totalFinalCount: number;
};

export type ConsumptionDraftItem = {
  itemType: ItemType;
  itemId: string;
  itemName: string;
  itemCode: string;
  /** 자재 기본 단위 (BOM 단위: g, ml, ea 등) */
  unit: string;

  // ── 라인업/라인 (부자재는 null) ──
  lineupId: string | null;
  lineupName: string | null;
  productionLineId: string | null;
  productionLineName: string | null;

  // ── 이론 사용량 (P14) ──
  /** 이론 사용량 (자재: requiredQty 합, 부자재: quantity*mealCount 또는 fixedQuantity) */
  suggestedQty: number;
  /** 공급 단위로 환산 후 반올림한 최종 사용량 (Math.round, 0→1 예외) */
  roundedFinalQty: number;

  // ── 공급 단위 (Material.supplyUnitId / Subsidiary.supplyUnitId 정본) ──
  /** true = defaultSupplierItem 등록됨. false = 미등록 (기본 단위 fallback) */
  hasSupplyUnit: boolean;
  /** 공급 단위 심볼 (예 "kg"/"팩"). 미등록 시 unit 과 동일 */
  supplyUnit: string;
  /** 1 공급단위 = supplyUnitQty 기본단위 (예 1kg=1000g → 1000). 미등록 시 1 */
  supplyUnitQty: number;

  // ── 재고/입고 ──
  /** locationId 기준 availableQty 합계 (Reservation 반영). 라인업 무관 총계 */
  availableQty: number;
  /** targetDate CONFIRMED ReceivingNote 로 입고된 수량 합계 */
  inboundQtyOnDate: number;

  // ── 원천 정보 ──
  /** MATERIAL: MaterialRequirement.id[] / SUBSIDIARY: MealPlanAccessory.id[] */
  sourceIds: string[];
  /** SUBSIDIARY 만 해당 */
  consumptionMode: ConsumptionMode | null;
};

export type ConsumptionDraft = {
  header: ConsumptionDraftHeader;
  layerAItems: ConsumptionDraftItem[];
  references: {
    generatedAt: Date;
    note: string;
  };
};

export class MaterialRequirementNotGeneratedError extends Error {
  constructor(mealPlanGroupId: string) {
    super(
      `MaterialRequirement(FINAL) 이 존재하지 않음. meal-plan.service 의 ` +
        `COMPLETED 전이 로직이 실패했을 가능성. mealPlanGroupId=${mealPlanGroupId}`,
    );
    this.name = "MaterialRequirementNotGeneratedError";
  }
}

export class MealPlanGroupNotFoundError extends Error {
  constructor(companyId: string, planDate: Date) {
    super(
      `MealPlanGroup 을 찾을 수 없음. companyId=${companyId}, ` +
        `planDate=${planDate.toISOString().slice(0, 10)}`,
    );
    this.name = "MealPlanGroupNotFoundError";
  }
}

// ────────────────────────────────────────
// 라운딩 헬퍼 (P14)
// ────────────────────────────────────────

function roundToSupplyUnit(suggestedQty: number, factor: number): number {
  if (suggestedQty <= 0) return 0;
  const inSupplyUnit = suggestedQty / (factor > 0 ? factor : 1);
  const rounded = Math.round(inSupplyUnit);
  return rounded === 0 ? 1 : rounded;
}

// ────────────────────────────────────────
// 메인 서비스
// ────────────────────────────────────────

export async function buildConsumptionDraft(
  companyId: string,
  targetDate: Date,
  locationId: string,
  tx?: Prisma.TransactionClient,
): Promise<ConsumptionDraft> {
  const client = tx ?? prisma;

  // 0) 진입 가드 (P13)
  await assertMealPlanCompletedForConsumption(companyId, targetDate, locationId, tx);

  const normalizedDate = normalizeToUtcDate(targetDate);

  // 1) MealPlanGroup 확정 — include 방식
  const group = await client.mealPlanGroup.findFirst({
    where: {
      companyId,
      planDate: normalizedDate,
      deletedAt: null,
      status: MealPlanStatus.COMPLETED,
    },
    include: {
      mealCounts: {
        where: { deletedAt: null },
      },
    },
  });
  if (!group) {
    throw new MealPlanGroupNotFoundError(companyId, normalizedDate);
  }

  const totalEstimatedCount = group.mealCounts.reduce(
    (sum, mc) => sum + (mc.estimatedCount ?? 0),
    0,
  );
  const totalFinalCount = group.mealCounts.reduce(
    (sum, mc) => sum + (mc.finalCount ?? 0),
    0,
  );

  const finalCountByKey = new Map<string, number>();
  for (const mc of group.mealCounts) {
    finalCountByKey.set(
      `${mc.companyMealSlotId}::${mc.lineupId}`,
      mc.finalCount ?? 0,
    );
  }

  // 2) MaterialRequirement(FINAL) — include 방식으로 relation 로드
  const mrRows = await client.materialRequirement.findMany({
    where: {
      companyId,
      mealPlanGroupId: group.id,
      countSource: MealCountSource.FINAL,
      locationId,
      deletedAt: null,
    },
    include: {
      materialMaster: {
        include: {
          defaultSupplierItem: {
            include: {
              supplyUnit: true,
            },
          },
        },
      },
      lineup: true,
      productionLine: true,
    },
  });

  if (mrRows.length === 0) {
    throw new MaterialRequirementNotGeneratedError(group.id);
  }

  // 자재 집계 키: materialId::lineupId::productionLineId
  type MaterialAggValue = {
    materialId: string;
    materialName: string;
    materialCode: string;
    baseUnit: string;
    lineupId: string | null;
    lineupName: string | null;
    productionLineId: string | null;
    productionLineName: string | null;
    supplyUnitCode: string | null;
    supplyUnitQty: number | null;
    qty: number;
    sourceIds: string[];
  };
  const materialAgg = new Map<string, MaterialAggValue>();

  for (const r of mrRows) {
    const key = `${r.materialMasterId}::${r.lineupId ?? "-"}::${r.productionLineId ?? "-"}`;
    const prev = materialAgg.get(key);
    if (prev) {
      prev.qty += r.requiredQty;
      prev.sourceIds.push(r.id);
    } else {
      materialAgg.set(key, {
        materialId: r.materialMasterId,
        materialName: r.materialMaster.name,
        materialCode: r.materialMaster.code,
        baseUnit: r.materialMaster.unit,
        lineupId: r.lineupId,
        lineupName: r.lineup?.name ?? null,
        productionLineId: r.productionLineId,
        productionLineName: r.productionLine?.name ?? null,
        supplyUnitCode: r.materialMaster.defaultSupplierItem?.supplyUnit.code ?? null,
        supplyUnitQty: r.materialMaster.defaultSupplierItem?.supplyUnitQty ?? null,
        qty: r.requiredQty,
        sourceIds: [r.id],
      });
    }
  }

  // 3) MealPlanAccessory — include 방식
  const mealPlans = await client.mealPlan.findMany({
    where: {
      mealPlanGroupId: group.id,
      deletedAt: null,
    },
    include: {
      accessories: {
        where: { deletedAt: null },
        include: {
          subsidiaryMaster: {
            include: {
              defaultSupplierItem: {
                include: {
                  supplyUnit: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // 부자재 집계 키: subsidiaryId::consumptionMode
  type SubsidiaryAggValue = {
    subsidiaryId: string;
    subsidiaryName: string;
    subsidiaryCode: string;
    baseUnit: string;
    consumptionMode: ConsumptionMode;
    supplyUnitCode: string | null;
    supplyUnitQty: number | null;
    qty: number;
    sourceIds: string[];
  };
  const subsidiaryAgg = new Map<string, SubsidiaryAggValue>();

  for (const mp of mealPlans) {
    const key = `${mp.companyMealSlotId}::${mp.lineupId}`;
    const finalCount = finalCountByKey.get(key) ?? 0;

    for (const acc of mp.accessories) {
      let addQty = 0;
      if (acc.consumptionMode === ConsumptionMode.PER_MEAL_COUNT) {
        if (finalCount === 0) continue;
        addQty = finalCount * acc.quantity;
      } else if (acc.consumptionMode === ConsumptionMode.FIXED_QUANTITY) {
        // D2 α: mealCount 무관, fixedQuantity 그대로
        addQty = acc.fixedQuantity ?? 0;
      }
      if (addQty <= 0) continue;

      const aggKey = `${acc.subsidiaryMasterId}::${acc.consumptionMode}`;
      const prev = subsidiaryAgg.get(aggKey);
      if (prev) {
        prev.qty += addQty;
        prev.sourceIds.push(acc.id);
      } else {
        subsidiaryAgg.set(aggKey, {
          subsidiaryId: acc.subsidiaryMasterId,
          subsidiaryName: acc.subsidiaryMaster.name,
          subsidiaryCode: acc.subsidiaryMaster.code,
          baseUnit: acc.subsidiaryMaster.unit,
          consumptionMode: acc.consumptionMode,
          supplyUnitCode:
            acc.subsidiaryMaster.defaultSupplierItem?.supplyUnit.code ?? null,
          supplyUnitQty:
            acc.subsidiaryMaster.defaultSupplierItem?.supplyUnitQty ?? null,
          qty: addQty,
          sourceIds: [acc.id],
        });
      }
    }
  }

  // 4) availableQty (라인업 무관 총계)
  const materialAvailability = await computeAvailability(
    Array.from(new Set(Array.from(materialAgg.values()).map((v) => v.materialId))),
    ItemType.MATERIAL,
    companyId,
    locationId,
    client,
  );
  const subsidiaryAvailability = await computeAvailability(
    Array.from(new Set(Array.from(subsidiaryAgg.values()).map((v) => v.subsidiaryId))),
    ItemType.SUBSIDIARY,
    companyId,
    locationId,
    client,
  );

  // 5) 당일 입고
  const inboundMap = await computeInboundOnDate(
    companyId,
    locationId,
    normalizedDate,
    client,
  );

  // 6) Layer A 조립
  const layerAItems: ConsumptionDraftItem[] = [];

  for (const v of materialAgg.values()) {
    const hasSupplyUnit =
      !!v.supplyUnitCode && v.supplyUnitQty !== null && v.supplyUnitQty > 0;
    const factor = hasSupplyUnit ? v.supplyUnitQty! : 1;
    const theoretical = v.qty;
    layerAItems.push({
      itemType: ItemType.MATERIAL,
      itemId: v.materialId,
      itemName: v.materialName,
      itemCode: v.materialCode,
      unit: v.baseUnit,
      lineupId: v.lineupId,
      lineupName: v.lineupName,
      productionLineId: v.productionLineId,
      productionLineName: v.productionLineName,
      suggestedQty: theoretical,
      roundedFinalQty: roundToSupplyUnit(theoretical, factor),
      hasSupplyUnit,
      supplyUnit: hasSupplyUnit ? v.supplyUnitCode! : v.baseUnit,
      supplyUnitQty: factor,
      availableQty: materialAvailability.get(v.materialId) ?? 0,
      inboundQtyOnDate: inboundMap.get(`MATERIAL::${v.materialId}`) ?? 0,
      sourceIds: v.sourceIds,
      consumptionMode: null,
    });
  }

  for (const v of subsidiaryAgg.values()) {
    const hasSupplyUnit =
      !!v.supplyUnitCode && v.supplyUnitQty !== null && v.supplyUnitQty > 0;
    const factor = hasSupplyUnit ? v.supplyUnitQty! : 1;
    const theoretical = v.qty;
    layerAItems.push({
      itemType: ItemType.SUBSIDIARY,
      itemId: v.subsidiaryId,
      itemName: v.subsidiaryName,
      itemCode: v.subsidiaryCode,
      unit: v.baseUnit,
      lineupId: null,
      lineupName: null,
      productionLineId: null,
      productionLineName: null,
      suggestedQty: theoretical,
      roundedFinalQty: roundToSupplyUnit(theoretical, factor),
      hasSupplyUnit,
      supplyUnit: hasSupplyUnit ? v.supplyUnitCode! : v.baseUnit,
      supplyUnitQty: factor,
      availableQty: subsidiaryAvailability.get(v.subsidiaryId) ?? 0,
      inboundQtyOnDate: inboundMap.get(`SUBSIDIARY::${v.subsidiaryId}`) ?? 0,
      sourceIds: v.sourceIds,
      consumptionMode: v.consumptionMode,
    });
  }

  // c-4-3: 자재/부자재 혼합 이름 오름차순 (테스트 명세: buildConsumptionDraft 반환 순서)
  // 라인업/라인 그룹핑은 UI(consumption-draft-form)에서 담당
  layerAItems.sort((a, b) => a.itemName.localeCompare(b.itemName, "ko"));

  return {
    header: {
      mealPlanGroupId: group.id,
      planDate: group.planDate,
      totalEstimatedCount,
      totalFinalCount,
    },
    layerAItems,
    references: {
      generatedAt: new Date(),
      note: "S4-3-c-R3-a buildConsumptionDraft (라인업/라인별 세분화, 공급단위 정본, 필드명 정합화: suggestedQty/supplyUnit/supplyUnitQty)",
    },
  };
}

// ────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────

function normalizeToUtcDate(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * 자재/부자재 목록에 대해 locationId 기준 availableQty 합계 반환.
 * S4-3-c-4-2 hotfix: getAvailableQty 에 트랜잭션 클라이언트 전달 (P11 격리)
 */
async function computeAvailability(
  itemIds: string[],
  itemType: ItemType,
  companyId: string,
  locationId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (itemIds.length === 0) return result;

  const where: Prisma.InventoryLotWhereInput = {
    companyId,
    locationId,
    itemType,
    remainingQty: { gt: 0 },
    ...(itemType === ItemType.MATERIAL
      ? { materialMasterId: { in: itemIds } }
      : { subsidiaryMasterId: { in: itemIds } }),
  };

  const lots = await client.inventoryLot.findMany({
    where,
    select: {
      id: true,
      materialMasterId: true,
      subsidiaryMasterId: true,
      remainingQty: true,
      purchaseKind: true,
      itemType: true,
    },
  });

  for (const lot of lots) {
    const key =
      itemType === ItemType.MATERIAL
        ? lot.materialMasterId!
        : lot.subsidiaryMasterId!;
    // ★ hotfix: tx 전달로 P11 격리 강화
    const avail = await getAvailableQty(lot.id, client as Prisma.TransactionClient);
    result.set(key, (result.get(key) ?? 0) + avail);
  }
  return result;
}

/**
 * targetDate 에 CONFIRMED ReceivingNote 로부터 자재/부자재별 입고량 합계.
 * key: `${itemType}::${itemId}`
 */
async function computeInboundOnDate(
  companyId: string,
  locationId: string,
  targetDate: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const notes = await client.receivingNote.findMany({
    where: {
      companyId,
      receivedDate: targetDate,
      status: ReceivingNoteStatus.CONFIRMED,
      purchaseOrder: { locationId },
    },
    include: {
      items: {
        include: {
          purchaseOrderItem: true,
        },
      },
    },
  });

  for (const note of notes) {
    for (const it of note.items) {
      const poi = it.purchaseOrderItem;
      if (!poi) continue;
      const id =
        poi.itemType === ItemType.MATERIAL
          ? poi.materialMasterId
          : poi.subsidiaryMasterId;
      if (!id) continue;
      const key = `${poi.itemType}::${id}`;
      result.set(key, (result.get(key) ?? 0) + it.receivedQty);
    }
  }

  return result;
}
