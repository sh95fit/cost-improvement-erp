import { prisma } from "@/lib/prisma";
import type { Prisma, ItemType, ConsumptionSourceType } from "@prisma/client";
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
// 입력/출력 타입
// ────────────────────────────────────────────────────────────
export type ConfirmConsumptionInput = {
  companyId: string;
  userId: string;
  locationId: string;
  targetDate: Date; // UTC 자정 정규화 값
  layerAItems: Array<{
    itemType: ItemType;
    itemId: string;      // materialMasterId | subsidiaryMasterId
    expectedQty: number; // drift 검증용
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

type MergedItem = {
  itemType: ItemType;
  itemId: string;
  itemName: string;
  unit: string;
  totalQty: number;
  sources: Array<{
    sourceType: ConsumptionSourceType;
    qty: number;
    note?: string;
  }>;
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
  // 1) 사전 검증 (트랜잭션 밖 fast-fail)
  for (const b of input.layerBItems) {
    if (!(b.quantity > 0)) {
      throw new InvalidLayerBItemError("QUANTITY_NON_POSITIVE", b.itemId);
    }
  }

  return prisma.$transaction(
    async (tx) => {
      // 2) Drift 재검증 (Layer A 재계산)
      const rebuilt = await buildConsumptionDraft(
        input.companyId,
        input.targetDate,
        input.locationId,
        tx,
      );

      const diffs = detectLayerADrift(input.layerAItems, rebuilt.layerAItems);
      if (diffs.length > 0) throw new StaleDraftError(diffs);

      // 3) Layer B 재검증 (활성 상태 + 메타 확보)
      const layerBMeta = await validateLayerBItems(
        tx,
        input.companyId,
        input.layerBItems,
      );

      // 4) CookingPlan 확보
      const cookingPlanId = await getOrCreateCookingPlanForConsumption(tx, {
        companyId: input.companyId,
        locationId: input.locationId,
        planDate: input.targetDate,
      });

      // 5) A+B 병합 (같은 item 은 sources[] 로만 분리 관리)
      const merged = mergeItems(input.layerAItems, layerBMeta, rebuilt.layerAItems);

      // 6) Pre-flight (P4): 재고 부족 사전 검증
      const shortages: InsufficientStockError["shortages"] = [];
      const perItemLots = new Map<
        string,
        Array<{ id: string; remainingQty: number; unitPrice: number }>
      >();

      for (const m of merged) {
        const lots = await tx.inventoryLot.findMany({
          where: {
            companyId: input.companyId,
            locationId: input.locationId,
            itemType: m.itemType,
            materialMasterId: m.itemType === "MATERIAL" ? m.itemId : null,
            subsidiaryMasterId: m.itemType === "SUBSIDIARY" ? m.itemId : null,
            remainingQty: { gt: 0 },
          },
          orderBy: [{ receivedAt: "asc" }, { id: "asc" }], // FIFO
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

      // 7) FIFO 차감 + ConsumptionItem 생성
      const consumptionItemIds: string[] = [];
      let totalConsumedQty = 0;

      for (const m of merged) {
        const lots = perItemLots.get(itemKey(m.itemType, m.itemId))!;

        for (const src of m.sources) {
          const created = await tx.consumptionItem.create({
            data: {
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
              disposition: "USED",
              note: src.note ?? null,
            },
            select: { id: true },
          });
          consumptionItemIds.push(created.id);

          // FIFO 차감
          let need = src.qty;
          for (const lot of lots) {
            if (need <= EPS) break;
            if (lot.remainingQty <= EPS) continue;

            const avail = await getAvailableQty(lot.id, tx);
            if (avail <= EPS) continue;

            const take = Math.min(avail, need);
            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { remainingQty: { decrement: take } },
            });
            await tx.consumptionLotDetail.create({
              data: {
                consumptionItemId: created.id,
                inventoryLotId: lot.id,
                quantity: take,
                unitPrice: lot.unitPrice,
              },
            });
            lot.remainingQty -= take;
            need -= take;
          }

          if (need > EPS) {
            // Pre-flight 를 통과했는데 여기서 부족하면 동시성 문제 → 트랜잭션 롤백
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

          totalConsumedQty += src.qty;
        }
      }

      // 8) AuditLog
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
          layerACount: input.layerAItems.length,
          layerBCount: input.layerBItems.length,
        },
      });

      return {
        consumptionItemIds,
        totalItemCount: consumptionItemIds.length,
        totalConsumedQty,
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
        clientQty: c.expectedQty,
        serverQty: 0,
      });
      continue;
    }
    if (Math.abs(s.expectedQty - c.expectedQty) > EPS) {
      diffs.push({
        itemType: c.itemType === "MATERIAL" ? "MATERIAL" : "SUBSIDIARY",
        itemId: c.itemId,
        itemName: s.itemName,
        clientQty: c.expectedQty,
        serverQty: s.expectedQty,
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
        serverQty: s.expectedQty,
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
    cur.totalQty += it.expectedQty;
    cur.sources.push({ sourceType: "MEAL_PLAN_AUTO", qty: it.expectedQty });
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
      qty: it.quantity,
      note: it.note,
    });
    map.set(key, cur);
  }

  return [...map.values()];
}
