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
 * S4-3-b — buildConsumptionDraft
 * ════════════════════════════════════════
 *
 * 헌법 P13: 사용 처리 진입 시점에 Layer A(자동 산출) 초안과 참조 데이터를
 * 순수 계산·조회한다. DB 쓰기 없음. 실제 ConsumptionItem 은 confirmConsumption(S4-3-d)
 * 에서 처음 INSERT.
 *
 * 입력:
 *   (companyId, targetDate, locationId)
 *
 * 출력:
 *   {
 *     header: { mealPlanGroupId, planDate, totalEstimatedCount, totalFinalCount },
 *     layerAItems: [{ itemType, itemId, itemName, itemCode, unit, expectedQty,
 *                     sourceType, cookingPlanId (null for now),
 *                     availableQty, inboundQtyOnDate }],
 *     references: { generatedAt, note }
 *   }
 *
 * 스키마 실측 근거:
 *   - MealPlanGroup(companyId, planDate) 유니크 → targetDate 로 groupId 결정
 *   - MaterialRequirement(FINAL) 은 status COMPLETED 전이 시 meal-plan.service 가
 *     동일 트랜잭션에서 자동 생성 (재산출 필요 없음)
 *   - MealPlanAccessory(consumptionMode=PER_MEAL_COUNT) 는 MR 범위 외 → 별도 산출
 *   - MealPlanAccessory.quantity 는 "1인분당 수량", finalCount 는 MealCount 조인
 *   - InventoryLot.materialMasterId/subsidiaryMasterId nullable + itemType XOR
 *   - ReceivingNote.receivedDate = targetDate & status = CONFIRMED → 당일입고
 *
 * 미해결:
 *   - cookingPlanId 는 현 시점 null (CookingPlan 도메인 S4-2 미착수).
 *     S4-3-d 에서 필요시 productionLineId 기반 조회로 대체 예정.
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
  unit: string;
  /** Layer A 자동 산출 예상 사용량 (자재는 grams, 부자재는 unit 기준) */
  expectedQty: number;
  /** 대상 Location 의 해당 아이템 availableQty 합계 (Reservation 반영) */
  availableQty: number;
  /** targetDate 에 CONFIRMED 된 ReceivingNote 로 입고된 수량 합계 */
  inboundQtyOnDate: number;
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
// 메인 서비스
// ────────────────────────────────────────

export async function buildConsumptionDraft(
  companyId: string,
  targetDate: Date,
  locationId: string,
): Promise<ConsumptionDraft> {
  // 0) 진입 가드 재확인 (외부에서 이미 통과했더라도 방어)
  await assertMealPlanCompletedForConsumption(companyId, targetDate, locationId);

  // UTC 자정 정규화 (planDate 는 @db.Date)
  const normalizedDate = normalizeToUtcDate(targetDate);

  // 1) MealPlanGroup 확정
  const group = await prisma.mealPlanGroup.findFirst({
    where: {
      companyId,
      planDate: normalizedDate,
      deletedAt: null,
      status: MealPlanStatus.COMPLETED,
    },
    select: {
      id: true,
      planDate: true,
      mealCounts: {
        where: { deletedAt: null },
        select: { estimatedCount: true, finalCount: true },
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

  // 2) Layer A 자재: MaterialRequirement(FINAL) 조회 → 자재별 SUM
  const mrRows = await prisma.materialRequirement.findMany({
    where: {
      companyId,
      mealPlanGroupId: group.id,
      countSource: MealCountSource.FINAL,
      locationId,
      deletedAt: null,
    },
    select: {
      materialMasterId: true,
      requiredQty: true,
      unit: true,
      materialMaster: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (mrRows.length === 0) {
    // 부자재만 있는 경우도 실무에선 드무므로 방어적으로 throw.
    // 완전한 부재는 P13 자동 생성 로직 실패를 의미.
    throw new MaterialRequirementNotGeneratedError(group.id);
  }

  // 자재별 aggregate (같은 자재가 여러 productionLine 에 걸쳐 있을 수 있음)
  const materialAgg = new Map<
    string,
    { qty: number; unit: string; name: string; code: string }
  >();
  for (const r of mrRows) {
    const prev = materialAgg.get(r.materialMasterId);
    if (prev) {
      prev.qty += r.requiredQty;
    } else {
      materialAgg.set(r.materialMasterId, {
        qty: r.requiredQty,
        unit: r.unit,
        name: r.materialMaster.name,
        code: r.materialMaster.code,
      });
    }
  }

  // 3) Layer A 부자재: MealPlanAccessory(PER_MEAL_COUNT) × MealCount.finalCount
  //    MealPlan 은 MealPlanGroup 하위, MealCount 는 (group, companyMealSlot, lineup) 조합
  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      mealPlanGroupId: group.id,
      deletedAt: null,
    },
    select: {
      id: true,
      companyMealSlotId: true,
      lineupId: true,
      accessories: {
        where: {
          deletedAt: null,
          consumptionMode: ConsumptionMode.PER_MEAL_COUNT,
        },
        select: {
          subsidiaryMasterId: true,
          quantity: true,
          subsidiaryMaster: {
            select: { id: true, name: true, code: true, unit: true },
          },
        },
      },
    },
  });

  // finalCount 조회 헬퍼 (mealPlan → (group, companyMealSlot, lineup) 매핑)
  const mealCountByKey = new Map<string, number>();
  for (const mc of group.mealCounts) {
    // NOTE: 위 select 에는 keys 가 없음. 다시 조회 필요 → 직접 재조회
  }
  // ↑ 위 헬퍼는 group.mealCounts select 를 확장해서 재작성 필요. 아래에서 재조회.
  const mealCountsFull = await prisma.mealCount.findMany({
    where: {
      mealPlanGroupId: group.id,
      deletedAt: null,
    },
    select: {
      companyMealSlotId: true,
      lineupId: true,
      finalCount: true,
    },
  });
  const finalCountByKey = new Map<string, number>();
  for (const mc of mealCountsFull) {
    finalCountByKey.set(
      `${mc.companyMealSlotId}::${mc.lineupId}`,
      mc.finalCount ?? 0,
    );
  }

  // subsidiaryMasterId → 누적
  const subsidiaryAgg = new Map<
    string,
    { qty: number; unit: string; name: string; code: string }
  >();
  for (const mp of mealPlans) {
    const key = `${mp.companyMealSlotId}::${mp.lineupId}`;
    const finalCount = finalCountByKey.get(key) ?? 0;
    if (finalCount === 0) continue;

    for (const acc of mp.accessories) {
      const addQty = finalCount * acc.quantity;
      const prev = subsidiaryAgg.get(acc.subsidiaryMasterId);
      if (prev) {
        prev.qty += addQty;
      } else {
        subsidiaryAgg.set(acc.subsidiaryMasterId, {
          qty: addQty,
          unit: acc.subsidiaryMaster.unit,
          name: acc.subsidiaryMaster.name,
          code: acc.subsidiaryMaster.code,
        });
      }
    }
  }

  // 4) 자재별 availableQty 집계
  //    각 자재에 대해 대상 location 의 lot 을 조회 → getAvailableQty 매핑·합산
  const materialAvailability = await computeAvailability(
    Array.from(materialAgg.keys()),
    "MATERIAL",
    companyId,
    locationId,
  );
  const subsidiaryAvailability = await computeAvailability(
    Array.from(subsidiaryAgg.keys()),
    "SUBSIDIARY",
    companyId,
    locationId,
  );

  // 5) 당일입고 수량 집계 (ReceivingNote.receivedDate = targetDate & CONFIRMED)
  const inboundMap = await computeInboundOnDate(
    companyId,
    locationId,
    normalizedDate,
  );

  // 6) Layer A 라인 조립
  const layerAItems: ConsumptionDraftItem[] = [];

  for (const [materialId, agg] of materialAgg) {
    layerAItems.push({
      itemType: ItemType.MATERIAL,
      itemId: materialId,
      itemName: agg.name,
      itemCode: agg.code,
      unit: agg.unit,
      expectedQty: agg.qty,
      availableQty: materialAvailability.get(materialId) ?? 0,
      inboundQtyOnDate: inboundMap.get(`MATERIAL::${materialId}`) ?? 0,
    });
  }
  for (const [subsidiaryId, agg] of subsidiaryAgg) {
    layerAItems.push({
      itemType: ItemType.SUBSIDIARY,
      itemId: subsidiaryId,
      itemName: agg.name,
      itemCode: agg.code,
      unit: agg.unit,
      expectedQty: agg.qty,
      availableQty: subsidiaryAvailability.get(subsidiaryId) ?? 0,
      inboundQtyOnDate: inboundMap.get(`SUBSIDIARY::${subsidiaryId}`) ?? 0,
    });
  }

  // 이름 오름차순 정렬 (UI 안정성)
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
        note: "S4-3-b buildConsumptionDraft (Layer A 자동 산출 완료)",
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
 * 자재/부자재 목록에 대해 locationId 기준 availableQty 합계를 반환.
 * 각 lot 에 getAvailableQty() 를 매핑 (예약 반영).
 */
async function computeAvailability(
  itemIds: string[],
  itemType: "MATERIAL" | "SUBSIDIARY",
  companyId: string,
  locationId: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (itemIds.length === 0) return result;

  const where: Prisma.InventoryLotWhereInput = {
    companyId,
    locationId,
    itemType: itemType === "MATERIAL" ? ItemType.MATERIAL : ItemType.SUBSIDIARY,
    remainingQty: { gt: 0 },
    ...(itemType === "MATERIAL"
      ? { materialMasterId: { in: itemIds } }
      : { subsidiaryMasterId: { in: itemIds } }),
  };

  const lots = await prisma.inventoryLot.findMany({
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
      itemType === "MATERIAL"
        ? lot.materialMasterId!
        : lot.subsidiaryMasterId!;
    const avail = await getAvailableQty(lot.id);
    result.set(key, (result.get(key) ?? 0) + avail);
  }
  return result;
}

/**
 * targetDate 에 CONFIRMED 된 ReceivingNote 로부터 자재/부자재별 입고량 합계.
 * key 형식: `${itemType}::${itemId}` (MATERIAL / SUBSIDIARY 통합 맵)
 */
async function computeInboundOnDate(
  companyId: string,
  locationId: string,
  targetDate: Date,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // ReceivingNote.receivedDate = targetDate & CONFIRMED
  // + PurchaseOrder.locationId = locationId 로 위치 필터
  const notes = await prisma.receivingNote.findMany({
    where: {
      companyId,
      receivedDate: targetDate,
      status: ReceivingNoteStatus.CONFIRMED,
      purchaseOrder: { locationId },
    },
    select: {
      items: {
        select: {
          receivedQty: true,
          purchaseOrderItem: {
            select: {
              itemType: true,
              materialMasterId: true,
              subsidiaryMasterId: true,
            },
          },
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
