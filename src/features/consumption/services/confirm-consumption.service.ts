import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  ItemType,
  ConsumptionSourceType,
  ConsumptionDisposition,
  DisposalReason,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/utils/audit";
import { buildConsumptionDraft } from "./consumption-draft.service";
import { getOrCreateCookingPlanForConsumption } from "./cooking-plan-upsert.service";
import { getAvailableQty } from "@/features/inventory/services/reservation.service";
import {
  StaleDraftError,
  InsufficientStockError,
  InvalidLayerBItemError,
} from "../errors/consumption.errors";

// ────────────────────────────────────────────────────────────
// 입력/출력 타입 (S4-3-c-R3-a 정합화)
// ────────────────────────────────────────────────────────────
export type ConfirmConsumptionInput = {
  companyId: string;
  userId: string;
  locationId: string;
  targetDate: Date; // UTC 자정 정규화 값
  layerAItems: Array<{
    itemType: ItemType;
    itemId: string;                    // materialMasterId | subsidiaryMasterId
    lineupId: string | null;           // 라인업/라인 세분화 키 (부자재는 null)
    productionLineId: string | null;
    suggestedQty: number;              // drift 검증용 (확정필요량 기준, 공급단위 환산 후 반올림)
    totalAvailable: number;            // 클라이언트 스냅샷 (서버 재조회로 검증)
    finalUsedQty: number;              // 실제 사용량 (사용자 입력)
    remainingToStock: number;          // 재고 잔량 (저장 X, InventoryLot 자연 이월)
    disposalReason?: DisposalReason;   // disposalQty>0 시 필수
    disposalNote?: string;             // OTHER 시 필수
  }>;
  layerBItems: Array<{
    itemType: ItemType;
    itemId: string;
    quantity: number;
    note?: string;
  }>;
};

export type ConfirmConsumptionResult = {
  consumptionItemIds: string[];
  totalItemCount: number;
  totalConsumedQty: number;
  totalDisposedQty: number;
  cookingPlanId: string;
};

// ────────────────────────────────────────────────────────────
// 내부 타입/상수
// ────────────────────────────────────────────────────────────
const EPS = 1e-6;

type LayerBItemWithMeta = {
  itemType: ItemType;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  note?: string;
};

type DispositionSource = {
  sourceType: ConsumptionSourceType;
  disposition: ConsumptionDisposition;
  qty: number;
  note?: string;
  disposalReason?: DisposalReason;
  disposalNote?: string;
};

type MergedItem = {
  itemType: ItemType;
  itemId: string;
  itemName: string;
  unit: string;
  totalQty: number;                    // FIFO 소진 대상 총량 (USED + DISPOSED, 재고 잔량 제외)
  sources: DispositionSource[];
};

function itemKey(t: ItemType, id: string): string {
  return `${t}:${id}`;
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
export async function confirmConsumption(
  input: ConfirmConsumptionInput,
): Promise<ConfirmConsumptionResult> {
  // 1) 사전 검증 (트랜잭션 밖 fast-fail, P11 강화)
  for (const b of input.layerBItems) {
    if (!(b.quantity > 0)) {
      throw new InvalidLayerBItemError("QUANTITY_NON_POSITIVE", b.itemId);
    }
  }
  for (const a of input.layerAItems) {
    // P11: 음수 금지
    if (a.finalUsedQty < 0 || a.remainingToStock < 0) {
      throw new InvalidLayerBItemError("QUANTITY_NEGATIVE", a.itemId);
    }
    // P14: 총량 초과 금지
    if (a.finalUsedQty + a.remainingToStock > a.totalAvailable + EPS) {
      throw new InvalidLayerBItemError("QUANTITY_OVERFLOW", a.itemId);
    }
    // P14: 폐기 사유 필수
    const disposalQty = a.totalAvailable - a.finalUsedQty - a.remainingToStock;
    if (disposalQty > EPS) {
      if (!a.disposalReason) {
        throw new InvalidLayerBItemError("DISPOSAL_REASON_REQUIRED", a.itemId);
      }
      if (a.disposalReason === "OTHER" && !a.disposalNote?.trim()) {
        throw new InvalidLayerBItemError("DISPOSAL_NOTE_REQUIRED", a.itemId);
      }
    }
  }

  return prisma.$transaction(
    async (tx) => {
      // 2) 서버 재빌드 (D2=α: totalAvailable/suggestedQty 정본)
      const rebuilt = await buildConsumptionDraft(
        input.companyId,
        input.targetDate,
        input.locationId,
        tx,
      );

      // 3) Drift 재검증 (suggestedQty 및 totalAvailable 편차)
      const diffs = detectLayerADrift(input.layerAItems, rebuilt.layerAItems);
      if (diffs.length > 0) throw new StaleDraftError(diffs);

      // 4) Layer B 재검증 (활성 상태 + 메타 확보)
      const layerBMeta = await validateLayerBItems(
        tx,
        input.companyId,
        input.layerBItems,
      );

      // 5) CookingPlan 확보
      const cookingPlanId = await getOrCreateCookingPlanForConsumption(tx, {
        companyId: input.companyId,
        locationId: input.locationId,
        planDate: input.targetDate,
      });

      // 6) A+B 병합 (같은 item 은 sources[] 로 분리, disposition 별 행 생성)
      const merged = mergeItems(input.layerAItems, layerBMeta, rebuilt.layerAItems);

      // 7) Pre-flight (P4/P11): 재고 부족 사전 검증
      const shortages: InsufficientStockError["shortages"] = [];
      const perItemLots = new Map<
        string,
        Array<{ id: string; remainingQty: number; unitPrice: number }>
      >();

      for (const m of merged) {
        if (m.totalQty <= EPS) continue; // USED=0, DISPOSED=0 이면 소진 대상 없음

        const lots = await tx.inventoryLot.findMany({
          where: {
            companyId: input.companyId,
            locationId: input.locationId,
            itemType: m.itemType,
            materialMasterId: m.itemType === "MATERIAL" ? m.itemId : null,
            subsidiaryMasterId: m.itemType === "SUBSIDIARY" ? m.itemId : null,
            remainingQty: { gt: 0 },
          },
          orderBy: [{ receivedAt: "asc" }, { id: "asc" }], // FIFO (P8)
          select: {
            id: true,
            remainingQty: true,
            unitPrice: true,
          },
        });

        let totalAvailable = 0;
        for (const lot of lots) {
          const avail = await getAvailableQty(lot.id, tx);
          totalAvailable += avail;
        }

        if (totalAvailable + EPS < m.totalQty) {
          shortages.push({
            itemType: m.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
            itemId: m.itemId,
            itemName: m.itemName,
            unit: m.unit,
            required: m.totalQty,
            available: totalAvailable,
          });
        }
        perItemLots.set(itemKey(m.itemType, m.itemId), lots);
      }
      if (shortages.length > 0) throw new InsufficientStockError(shortages);

      // 7.5) ConsumptionHeader upsert (P15) — S4-3-c-R3-c
      //   Header.productionLineId 는 CookingPlan.productionLineId 정본 사용
      //   AUTO_MEAL_PLAN 경로 idempotent: unique(mealPlanGroup, location, productionLine, source)
      const mealPlanGroup = await tx.mealPlanGroup.findUnique({
        where: {
          companyId_planDate: {
            companyId: input.companyId,
            planDate: input.targetDate,
          },
        },
        select: { id: true },
      });
      if (!mealPlanGroup) {
        throw new Error("MEAL_PLAN_GROUP_NOT_FOUND");
      }

      const cookingPlan = await tx.cookingPlan.findUnique({
        where: { id: cookingPlanId },
        select: { productionLineId: true },
      });
      if (!cookingPlan) {
        throw new Error("COOKING_PLAN_NOT_FOUND");
      }

      const consumptionHeader = await tx.consumptionHeader.upsert({
        where: {
          mealPlanGroupId_locationId_productionLineId_source: {
            mealPlanGroupId: mealPlanGroup.id,
            locationId: input.locationId,
            productionLineId: cookingPlan.productionLineId,
            source: "AUTO_MEAL_PLAN",
          },
        },
        create: {
          companyId: input.companyId,
          locationId: input.locationId,
          productionLineId: cookingPlan.productionLineId,
          mealPlanGroupId: mealPlanGroup.id,
          consumedDate: input.targetDate,
          source: "AUTO_MEAL_PLAN",
          status: "CONFIRMED",
          createdByUserId: input.userId,
          confirmedAt: new Date(),
          confirmedByUserId: input.userId,
        },
        update: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedByUserId: input.userId,
        },
        select: { id: true },
      });

      // 8) FIFO 차감 + ConsumptionItem(USED|DISPOSED) + LotDetail + InventoryTransaction
      const consumptionItemIds: string[] = [];
      let totalConsumedQty = 0;
      let totalDisposedQty = 0;

      for (const m of merged) {
        const lots = perItemLots.get(itemKey(m.itemType, m.itemId));

        for (const src of m.sources) {
          if (src.qty <= EPS) continue;

          const created = await tx.consumptionItem.create({
            data: {
              headerId: consumptionHeader.id, // S4-3-c-R3-c: Header 편입 (P15)
              companyId: input.companyId,
              itemType: m.itemType,
              materialMasterId: m.itemType === "MATERIAL" ? m.itemId : null,
              subsidiaryMasterId: m.itemType === "SUBSIDIARY" ? m.itemId : null,
              cookingPlanId,
              consumedQty: src.qty,
              unit: m.unit,
              consumedDate: input.targetDate,
              status: "CONFIRMED",
              sourceType: src.sourceType,
              disposition: src.disposition,
              disposalReason: src.disposalReason ?? null,
              disposalNote: src.disposalNote ?? null,
              note: src.note ?? null,
            },
            select: { id: true },
          });
          consumptionItemIds.push(created.id);

          // FIFO 차감 (P8) — pre-flight 로 P11 이미 보장
          let need = src.qty;
          for (const lot of lots ?? []) {
            if (need <= EPS) break;
            if (lot.remainingQty <= EPS) continue;

            const avail = await getAvailableQty(lot.id, tx);
            if (avail <= EPS) continue;

            const take = Math.min(avail, need);

            // (a) Lot 차감
            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { remainingQty: { decrement: take } },
            });

            // (b) ConsumptionLotDetail 스냅샷
            await tx.consumptionLotDetail.create({
              data: {
                consumptionItemId: created.id,
                inventoryLotId: lot.id,
                quantity: take,
                unitPrice: lot.unitPrice,
              },
            });

            // (c) InventoryTransaction 원장 (P4)
            //     - USED → CONSUMPTION / DISPOSED → DISPOSAL
            //     - 부호 관례 B: quantity 항상 양수
            await tx.inventoryTransaction.create({
              data: {
                companyId: input.companyId,
                locationId: input.locationId,
                itemType: m.itemType,
                materialMasterId: m.itemType === "MATERIAL" ? m.itemId : null,
                subsidiaryMasterId: m.itemType === "SUBSIDIARY" ? m.itemId : null,
                inventoryLotId: lot.id,
                transactionType:
                  src.disposition === "DISPOSED" ? "DISPOSAL" : "CONSUMPTION",
                quantity: take,
                unitPrice: lot.unitPrice,
                referenceType: "CONSUMPTION_ITEM",
                referenceId: created.id,
                transactionDate: input.targetDate,
              },
            });

            lot.remainingQty -= take;
            need -= take;
          }

          if (need > EPS) {
            // Pre-flight 통과 후 부족 → 동시성 이슈 (Serializable 로 롤백)
            throw new InsufficientStockError([
              {
                itemType: m.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
                itemId: m.itemId,
                itemName: m.itemName,
                unit: m.unit,
                required: src.qty,
                available: src.qty - need,
              },
            ]);
          }

          if (src.disposition === "DISPOSED") {
            totalDisposedQty += src.qty;
          } else {
            totalConsumedQty += src.qty;
          }
        }
      }

      // 9) AuditLog
      await writeAuditLog(tx, {
        companyId: input.companyId,
        userId: input.userId,
        action: "CONFIRM_CONSUMPTION",
        entityType: "Consumption",
        entityId: cookingPlanId,
        before: null,
        after: {
          cookingPlanId,
          itemCount: consumptionItemIds.length,
          totalConsumedQty,
          totalDisposedQty,
          layerACount: input.layerAItems.length,
          layerBCount: input.layerBItems.length,
        },
      });

      return {
        consumptionItemIds,
        totalItemCount: consumptionItemIds.length,
        totalConsumedQty,
        totalDisposedQty,
        cookingPlanId,
      };
    },
    {
      isolationLevel: "Serializable",
      timeout: 30_000,
    },
  );
}

// ────────────────────────────────────────────────────────────
// 헬퍼 함수
// ────────────────────────────────────────────────────────────

/**
 * Layer A drift 검증
 * - suggestedQty 편차: 라인업 확정식수·BOM 변경 감지
 * - totalAvailable 편차: 다른 사용자에 의한 동시 소진·입고 감지
 * - finalUsedQty/remainingToStock: 사용자 자유 입력이므로 검증 X
 */
function detectLayerADrift(
  client: ConfirmConsumptionInput["layerAItems"],
  server: Awaited<ReturnType<typeof buildConsumptionDraft>>["layerAItems"],
): StaleDraftError["diffs"] {
  const serverMap = new Map(server.map((s) => [itemKey(s.itemType, s.itemId), s]));
  const clientMap = new Map(client.map((c) => [itemKey(c.itemType, c.itemId), c]));
  const diffs: StaleDraftError["diffs"] = [];

  for (const c of client) {
    const s = serverMap.get(itemKey(c.itemType, c.itemId));
    if (!s) {
      diffs.push({
        itemType: c.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
        itemId: c.itemId,
        itemName: "(삭제됨)",
        clientQty: c.suggestedQty,
        serverQty: 0,
      });
      continue;
    }
    // suggestedQty 편차
    if (Math.abs(s.suggestedQty - c.suggestedQty) > EPS) {
      diffs.push({
        itemType: c.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
        itemId: c.itemId,
        itemName: s.itemName,
        clientQty: c.suggestedQty,
        serverQty: s.suggestedQty,
      });
      continue;
    }
    // totalAvailable 편차 (D2=α: 서버 정본)
    if (Math.abs(s.availableQty - c.totalAvailable) > EPS) {
      diffs.push({
        itemType: c.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
        itemId: c.itemId,
        itemName: s.itemName,
        clientQty: c.totalAvailable,
        serverQty: s.availableQty,
      });
    }
  }
  for (const s of server) {
    if (!clientMap.has(itemKey(s.itemType, s.itemId))) {
      diffs.push({
        itemType: s.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
        itemId: s.itemId,
        itemName: s.itemName,
        clientQty: 0,
        serverQty: s.suggestedQty,
      });
    }
  }
  return diffs;
}

async function validateLayerBItems(
  tx: Prisma.TransactionClient,
  companyId: string,
  items: ConfirmConsumptionInput["layerBItems"],
): Promise<LayerBItemWithMeta[]> {
  const result: LayerBItemWithMeta[] = [];
  for (const b of items) {
    if (b.itemType === "MATERIAL") {
      const m = await tx.materialMaster.findFirst({
        where: { id: b.itemId, companyId },
        select: { id: true, name: true, code: true, unit: true, isActive: true },
      });
      if (!m) throw new InvalidLayerBItemError("ITEM_NOT_FOUND", b.itemId);
      if (!m.isActive) throw new InvalidLayerBItemError("ITEM_INACTIVE", b.itemId);
      result.push({
        itemType: "MATERIAL",
        itemId: b.itemId,
        itemName: m.name,
        itemCode: m.code,
        unit: m.unit,
        quantity: b.quantity,
        note: b.note,
      });
    } else {
      const s = await tx.subsidiaryMaster.findFirst({
        where: { id: b.itemId, companyId },
        select: { id: true, name: true, code: true, unit: true, isActive: true },
      });
      if (!s) throw new InvalidLayerBItemError("ITEM_NOT_FOUND", b.itemId);
      if (!s.isActive) throw new InvalidLayerBItemError("ITEM_INACTIVE", b.itemId);
      result.push({
        itemType: "SUBSIDIARY",
        itemId: b.itemId,
        itemName: s.name,
        itemCode: s.code,
        unit: s.unit,
        quantity: b.quantity,
        note: b.note,
      });
    }
  }
  return result;
}

/**
 * A+B 병합 규칙 (S4-3-c-R3-a):
 * - A 항목: finalUsedQty>0 → USED source, disposalQty>0 → DISPOSED source (독립 행)
 * - B 항목: quantity → USED source (재고/폐기 분리 없음)
 * - 같은 자재는 sources[] 로 병합하되 disposition 분리 유지
 * - remainingToStock 은 저장 X (InventoryLot.remainingQty 자연 이월)
 */
function mergeItems(
  a: ConfirmConsumptionInput["layerAItems"],
  b: LayerBItemWithMeta[],
  serverA: Awaited<ReturnType<typeof buildConsumptionDraft>>["layerAItems"],
): MergedItem[] {
  const map = new Map<string, MergedItem>();
  const nameMap = new Map(serverA.map((s) => [itemKey(s.itemType, s.itemId), s]));

  for (const it of a) {
    const key = itemKey(it.itemType, it.itemId);
    const meta = nameMap.get(key)!;
    const cur =
      map.get(key) ??
      ({
        itemType: it.itemType,
        itemId: it.itemId,
        itemName: meta.itemName,
        unit: meta.unit,
        totalQty: 0,
        sources: [],
      } as MergedItem);

    // USED source
    if (it.finalUsedQty > EPS) {
      cur.totalQty += it.finalUsedQty;
      cur.sources.push({
        sourceType: "MEAL_PLAN_AUTO",
        disposition: "USED",
        qty: it.finalUsedQty,
      });
    }

    // DISPOSED source
    const disposalQty =
      it.totalAvailable - it.finalUsedQty - it.remainingToStock;
    if (disposalQty > EPS) {
      cur.totalQty += disposalQty;
      cur.sources.push({
        sourceType: "MEAL_PLAN_AUTO",
        disposition: "DISPOSED",
        qty: disposalQty,
        disposalReason: it.disposalReason,
        disposalNote: it.disposalNote,
      });
    }
    // remainingToStock 은 저장 X (재고 자연 이월)

    map.set(key, cur);
  }

  for (const it of b) {
    const key = itemKey(it.itemType, it.itemId);
    const cur =
      map.get(key) ??
      ({
        itemType: it.itemType,
        itemId: it.itemId,
        itemName: it.itemName,
        unit: it.unit,
        totalQty: 0,
        sources: [],
      } as MergedItem);
    cur.totalQty += it.quantity;
    cur.sources.push({
      sourceType: "MANUAL_ADDITION",
      disposition: "USED",
      qty: it.quantity,
      note: it.note,
    });
    map.set(key, cur);
  }

  return [...map.values()];
}
