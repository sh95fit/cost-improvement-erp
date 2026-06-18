import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ItemType } from "@prisma/client";
import { POBatchMode, MealCountSource } from "@prisma/client";
import {
  computeDeltaPlan,
  type ExistingPOItemForDelta,
  type NewItemForDelta,
  type ComputeDeltaPlanResult,
} from "./po-delta.service";
import { POAdjustmentAction } from "@prisma/client";

// ── 도메인 에러 키 ──
export const PO_BATCH_ERRORS = {
  EMPTY_ITEMS: "EMPTY_ITEMS",
  LOCATION_NOT_FOUND: "LOCATION_NOT_FOUND",
  PRODUCTION_LINE_NOT_FOUND: "PRODUCTION_LINE_NOT_FOUND",
  LINE_LOCATION_MISMATCH: "LINE_LOCATION_MISMATCH",
  SUPPLIER_NOT_FOUND: "SUPPLIER_NOT_FOUND",
  SUPPLIER_ITEM_NOT_FOUND: "SUPPLIER_ITEM_NOT_FOUND",
  IDEMPOTENT_REPLAY: "IDEMPOTENT_REPLAY",
  REPLACE_BLOCKED_BY_NON_DRAFT_PO: "REPLACE_BLOCKED_BY_NON_DRAFT_PO",
  // ★ R1-b3
  DELTA_BLOCKED_BY_APPROVED_PO: "DELTA_BLOCKED_BY_APPROVED_PO",
  DELTA_MISSING_BASED_ON_POS: "DELTA_MISSING_BASED_ON_POS",
} as const;

// ============================================================
// 입력 스키마 (위저드 → 배치 서비스)
// ============================================================
// 각 항목은 위저드 화면에서 사용자가 최종 확정한 1개 행.
// 미매핑/재고충당 항목은 호출 전에 걸러져 있어야 함.
export const batchPOItemSchema = z
  .object({
    supplierId: z.string().min(1),
    supplierItemId: z.string().min(1),
    itemType: z.nativeEnum(ItemType).default("MATERIAL"),
    materialMasterId: z.string().min(1).optional(),
    subsidiaryMasterId: z.string().min(1).optional(),
    locationId: z.string().min(1),
    productionLineId: z.string().min(1).nullable().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    // 시스템 추적 정보
    materialRequirementId: z.string().optional(),
    systemQuantity: z.number().nonnegative().optional(),
    adjustedQuantity: z.number().nonnegative().optional(),
    adjustmentReason: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.itemType === "MATERIAL" && !data.materialMasterId) {
      ctx.addIssue({
        code: "custom",
        path: ["materialMasterId"],
        message: "MATERIAL 품목은 자재 ID가 필요합니다",
      });
    }
    if (data.itemType === "SUBSIDIARY" && !data.subsidiaryMasterId) {
      ctx.addIssue({
        code: "custom",
        path: ["subsidiaryMasterId"],
        message: "SUBSIDIARY 품목은 부자재 ID가 필요합니다",
      });
    }
  });

export const createPurchaseOrdersBatchSchema = z.object({
  companyId: z.string().min(1),
  mealPlanGroupId: z.string().min(1).nullable().optional(),
  createdByUserId: z.string().optional(),
  orderDate: z.coerce.date(),
  deliveryDate: z.coerce.date().optional(),
  note: z.string().max(1000).optional(),
  // ★ R1-b1: 멱등성 키 + 모드 (옵션 — 미지정 시 멱등 가드 비활성, 항상 신규 생성)
  idempotencyKey: z
    .string()
    .min(8, "위저드 세션 키는 8자 이상이어야 합니다")
    .max(128)
    .optional(),
  countSource: z.nativeEnum(MealCountSource).default("ESTIMATED"),
  mode: z.nativeEnum(POBatchMode).default("NEW"),
  basedOnPOIds: z.array(z.string()).default([]),
  items: z.array(batchPOItemSchema).min(1, "발주 항목은 1개 이상이어야 합니다"),
});

export type BatchPOItem = z.infer<typeof batchPOItemSchema>;
export type CreatePurchaseOrdersBatchInput = z.infer<
  typeof createPurchaseOrdersBatchSchema
>;

// ============================================================
// 결과 타입
// ============================================================
export interface CreatePurchaseOrdersBatchResult {
  createdPurchaseOrders: Array<{
    id: string;
    orderNumber: string;
    supplierId: string;
    locationId: string;
    productionLineId: string | null;
    itemCount: number;
    totalAmount: number;
  }>;
  count: number;
  totalAmount: number;
  isIdempotentReplay: boolean;
  batchId: string | null;
  /** ★ R1-b3: DELTA 모드일 때만 채워짐 */
  adjustmentSummary?: {
    increased: number;
    decreased: number;
    added: number;
    priceChanged: number;
    unchanged: number;
    totalDeltaAmount: number;
    affectedPurchaseOrderIds: string[];
  };
}

// ============================================================
// 그룹 키 생성 (supplierId × locationId × productionLineId)
// ============================================================
function makeGroupKey(item: BatchPOItem): string {
  return `${item.supplierId}|${item.locationId}|${item.productionLineId ?? "_"}`;
}

// ============================================================
// 라인/공장 정합성 검증 (배치용)
// ============================================================
async function assertLocationsAndLines(
  tx: Prisma.TransactionClient,
  companyId: string,
  groups: Array<{
    locationId: string;
    productionLineId: string | null | undefined;
  }>,
) {
  const uniqueLocationIds = Array.from(
    new Set(groups.map((g) => g.locationId)),
  );
  const uniqueLineIds = Array.from(
    new Set(
      groups
        .map((g) => g.productionLineId)
        .filter((v): v is string => !!v),
    ),
  );

  // 1) Location 일괄 검증
  const locations = await tx.location.findMany({
    where: { id: { in: uniqueLocationIds }, companyId, deletedAt: null },
    select: { id: true },
  });
  const validLocationIds = new Set(locations.map((l) => l.id));
  for (const id of uniqueLocationIds) {
    if (!validLocationIds.has(id)) throw new Error("LOCATION_NOT_FOUND");
  }

  // 2) ProductionLine 일괄 검증 + 공장 매칭
  if (uniqueLineIds.length > 0) {
    const lines = await tx.productionLine.findMany({
      where: { id: { in: uniqueLineIds }, companyId, deletedAt: null },
      select: { id: true, locationId: true },
    });
    const lineMap = new Map(lines.map((l) => [l.id, l.locationId]));
    for (const id of uniqueLineIds) {
      if (!lineMap.has(id)) throw new Error("PRODUCTION_LINE_NOT_FOUND");
    }
    for (const g of groups) {
      if (g.productionLineId) {
        const lineLocationId = lineMap.get(g.productionLineId);
        if (lineLocationId !== g.locationId) {
          throw new Error("LINE_LOCATION_MISMATCH");
        }
      }
    }
  }
}

// ============================================================
// 공급업체/공급품목 일괄 검증
// ============================================================
async function assertSuppliersAndItems(
  tx: Prisma.TransactionClient,
  companyId: string,
  items: BatchPOItem[],
) {
  const supplierIds = Array.from(new Set(items.map((i) => i.supplierId)));
  const supplierItemIds = Array.from(new Set(items.map((i) => i.supplierItemId)));

  const suppliers = await tx.supplier.findMany({
    where: { id: { in: supplierIds }, companyId, deletedAt: null },
    select: { id: true },
  });
  const validSupplierIds = new Set(suppliers.map((s) => s.id));
  for (const id of supplierIds) {
    if (!validSupplierIds.has(id)) throw new Error("SUPPLIER_NOT_FOUND");
  }

  const supplierItems = await tx.supplierItem.findMany({
    where: { id: { in: supplierItemIds }, supplierId: { in: supplierIds } },
    select: { id: true, supplierId: true },
  });
  const itemSupplierMap = new Map(
    supplierItems.map((si) => [si.id, si.supplierId]),
  );
  for (const it of items) {
    const owner = itemSupplierMap.get(it.supplierItemId);
    if (!owner) throw new Error("SUPPLIER_ITEM_NOT_FOUND");
    // 행의 supplierId와 SupplierItem의 supplierId 정합성
    if (owner !== it.supplierId) throw new Error("SUPPLIER_ITEM_NOT_FOUND");
  }
}

// ============================================================
// 발주번호 채번 (트랜잭션 내 순차 — 시퀀스 충돌 방지)
// ============================================================
async function generateNextOrderNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  orderDate: Date,
  alreadyUsed: Set<string>,
): Promise<string> {
  const yyyy = orderDate.getFullYear();
  const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
  const dd = String(orderDate.getDate()).padStart(2, "0");
  const prefix = `PO-${yyyy}${mm}${dd}-`;

  const last = await tx.purchaseOrder.findFirst({
    where: { companyId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let nextSeq = 1;
  if (last) {
    const seq = parseInt(last.orderNumber.slice(prefix.length), 10);
    if (!Number.isNaN(seq)) nextSeq = seq + 1;
  }

  // alreadyUsed 안의 번호는 건너뜀 (같은 트랜잭션 내 채번된 번호)
  while (alreadyUsed.has(`${prefix}${String(nextSeq).padStart(3, "0")}`)) {
    nextSeq += 1;
  }

  const orderNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;
  alreadyUsed.add(orderNumber);
  return orderNumber;
}

// ============================================================
// 배치 PO 생성 (메인)
// ============================================================
/**
 * 위저드에서 확정된 항목 리스트를 받아 N개 PO를 원자적으로 생성한다.
 *
 * 그룹핑: supplierId × locationId × productionLineId (null은 별도 그룹)
 * 상태: 모든 PO는 DRAFT로 생성됨 (단가 적층은 SUBMITTED 전이 시점에 별도 처리)
 * PriceHistory: 이 단계에서는 적층하지 않음 (Step 4‑B′‑4 책임)
 *
 * @throws Error("EMPTY_ITEMS" | "LOCATION_NOT_FOUND" | "PRODUCTION_LINE_NOT_FOUND" |
 *               "LINE_LOCATION_MISMATCH" | "SUPPLIER_NOT_FOUND" | "SUPPLIER_ITEM_NOT_FOUND")
 */
export async function createPurchaseOrdersBatch(
  input: CreatePurchaseOrdersBatchInput,
): Promise<CreatePurchaseOrdersBatchResult> {
  if (input.items.length === 0) throw new Error("EMPTY_ITEMS");

  return prisma.$transaction(async (tx) => {
    // ★ R1-b1: 멱등성 키가 있으면 동일 키로 이미 생성된 batch 조회.
    // 더블클릭·재시도·동시 제출에 안전. 미지정 시 가드 비활성 (테스트/레거시 호환).
    if (input.idempotencyKey) {
      const existingBatch = await tx.purchaseOrderBatch.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: input.companyId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: {
          purchaseOrders: {
            select: {
              id: true,
              orderNumber: true,
              supplierId: true,
              locationId: true,
              productionLineId: true,
              totalAmount: true,
              _count: { select: { items: true } },
            },
          },
        },
      });

      if (existingBatch) {
        return {
          createdPurchaseOrders: existingBatch.purchaseOrders.map((po) => ({
            id: po.id,
            orderNumber: po.orderNumber,
            supplierId: po.supplierId,
            locationId: po.locationId,
            productionLineId: po.productionLineId,
            itemCount: po._count.items,
            totalAmount: po.totalAmount ?? 0,
          })),
          count: existingBatch.purchaseOrders.length,
          totalAmount: existingBatch.purchaseOrders.reduce(
            (s, po) => s + (po.totalAmount ?? 0),
            0,
          ),
          // ★ R1-b1: 멱등 replay 임을 호출자에게 알림
          isIdempotentReplay: true,
          batchId: existingBatch.id,
        };
      }
    }

    // ★ R1-b1: 신규 batch 행 생성 (idempotencyKey가 있을 때만)
    const batch = input.idempotencyKey
      ? await tx.purchaseOrderBatch.create({
          data: {
            companyId: input.companyId,
            idempotencyKey: input.idempotencyKey,
            mealPlanGroupId: input.mealPlanGroupId ?? null,
            countSource: input.countSource,
            mode: input.mode,
            basedOnPOIds: input.basedOnPOIds,
            createdByUserId: input.createdByUserId ?? "system",
          },
        })
      : null;

    // ★ R1-b3: 모드별 분기
    if (input.mode === "DELTA") {
      if (input.basedOnPOIds.length === 0) {
        throw new Error("DELTA_MISSING_BASED_ON_POS");
      }
      return await executeDeltaMode(tx, input, batch?.id ?? null);
    }
    // REPLACE 는 R1-b4 에서 본격 구현. R1-b3 시점에는 NEW 와 동일하게 fallback.

    // ── 이하 기존 그룹핑·검증·채번·생성 로직 ──
    // 1) 그룹핑
    const groups = new Map<string, BatchPOItem[]>();
    for (const item of input.items) {
      const key = makeGroupKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    // 2) 정합성 일괄 검증
    const groupHeaders = Array.from(groups.values()).map((arr) => ({
      locationId: arr[0].locationId,
      productionLineId: arr[0].productionLineId ?? null,
    }));
    await assertLocationsAndLines(tx, input.companyId, groupHeaders);
    await assertSuppliersAndItems(tx, input.companyId, input.items);

    // 3) 각 그룹을 PO로 변환 + 채번 + 생성
    const usedOrderNumbers = new Set<string>();
    const createdPurchaseOrders: CreatePurchaseOrdersBatchResult["createdPurchaseOrders"] =
      [];
    let grandTotal = 0;

    for (const [, items] of groups) {
      const first = items[0];
      const totalAmount = items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0,
      );
      grandTotal += totalAmount;

      const orderNumber = await generateNextOrderNumber(
        tx,
        input.companyId,
        input.orderDate,
        usedOrderNumbers,
      );

      const po = await tx.purchaseOrder.create({
        data: {
          companyId: input.companyId,
          supplierId: first.supplierId,
          locationId: first.locationId,
          productionLineId: first.productionLineId ?? null,
          batchId: batch?.id ?? null,              // ★ R1-b1 (idempotencyKey 없으면 null)
          orderNumber,
          status: "DRAFT",
          orderDate: input.orderDate,
          deliveryDate: input.deliveryDate,
          note: input.note,
          isManual: false, // 위저드 = 시스템 발주
          mealPlanGroupId: input.mealPlanGroupId ?? null,
          createdByUserId: input.createdByUserId,
          totalAmount,
          items: {
            create: items.map((it) => ({
              supplierItemId: it.supplierItemId,
              itemType: it.itemType,
              materialMasterId: it.materialMasterId ?? null,
              subsidiaryMasterId: it.subsidiaryMasterId ?? null,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.quantity * it.unitPrice,
              systemQuantity: it.systemQuantity,
              adjustedQuantity: it.adjustedQuantity,
              adjustmentReason: it.adjustmentReason,
              sourceType: "WIZARD_AUTO",
              materialRequirementId: it.materialRequirementId,
            })),
          },
        },
        select: {
          id: true,
          orderNumber: true,
          supplierId: true,
          locationId: true,
          productionLineId: true,
          totalAmount: true,
          _count: { select: { items: true } },
        },
      });

      createdPurchaseOrders.push({
        id: po.id,
        orderNumber: po.orderNumber,
        supplierId: po.supplierId,
        locationId: po.locationId,
        productionLineId: po.productionLineId,
        itemCount: po._count.items,
        totalAmount: po.totalAmount ?? 0,
      });
    }

    return {
      createdPurchaseOrders,
      count: createdPurchaseOrders.length,
      totalAmount: grandTotal,
      isIdempotentReplay: false,
      batchId: batch?.id ?? null,
    };
  });
}

// ============================================================
// ★ R1-b3: DELTA 모드 실행
// ============================================================
/**
 * basedOnPOIds 의 기존 PO(DRAFT/SUBMITTED) 들과 위저드 신규 산정값을 차분하여
 * 기존 item 갱신 / 신규 item 추가 / 신규 PO 생성을 트랜잭션 내 원자적으로 수행.
 * 모든 변경은 POAdjustmentLog 에 적층된다.
 *
 * @throws Error("DELTA_BLOCKED_BY_APPROVED_PO") APPROVED 이상 PO 가 basedOnPOIds 에 포함된 경우
 */
async function executeDeltaMode(
  tx: Prisma.TransactionClient,
  input: CreatePurchaseOrdersBatchInput,
  batchId: string | null,
): Promise<CreatePurchaseOrdersBatchResult> {
  // 1) basedOnPOIds 의 기존 PO + item 일괄 조회
  const existingPOs = await tx.purchaseOrder.findMany({
    where: {
      id: { in: input.basedOnPOIds },
      companyId: input.companyId,
    },
    select: {
      id: true,
      status: true,
      supplierId: true,
      locationId: true,
      productionLineId: true,
      orderDate: true,
      deliveryDate: true,
      items: {
        select: {
          id: true,
          materialMasterId: true,
          supplierItemId: true,
          quantity: true,
          unitPrice: true,
          systemQuantity: true,
        },
      },
    },
  });

  // 2) APPROVED 이상 PO 포함 시 차단
  const locked = existingPOs.filter(
    (po) => po.status !== "DRAFT" && po.status !== "SUBMITTED",
  );
  if (locked.length > 0) {
    throw new Error("DELTA_BLOCKED_BY_APPROVED_PO");
  }

  // 3) ExistingPOItemForDelta[] 평탄화 (MATERIAL 만 — SUBSIDIARY 는 위저드 대상 외)
  const existingItems: ExistingPOItemForDelta[] = [];
  for (const po of existingPOs) {
    for (const it of po.items) {
      if (!it.materialMasterId) continue;
      existingItems.push({
        purchaseOrderId: po.id,
        purchaseOrderStatus: po.status as "DRAFT" | "SUBMITTED",
        purchaseOrderItemId: it.id,
        materialMasterId: it.materialMasterId,
        locationId: po.locationId,
        productionLineId: po.productionLineId,
        supplierId: po.supplierId,
        supplierItemId: it.supplierItemId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        systemQuantity: it.systemQuantity,
      });
    }
  }

  // 4) 위저드 BatchPOItem → NewItemForDelta 변환 (MATERIAL 만)
  const newCandidates: NewItemForDelta[] = input.items
    .filter((it) => it.itemType === "MATERIAL" && !!it.materialMasterId)
    .map((it) => ({
      materialMasterId: it.materialMasterId!,
      locationId: it.locationId,
      productionLineId: it.productionLineId ?? null,
      supplierId: it.supplierId,
      supplierItemId: it.supplierItemId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      netRequiredG: it.systemQuantity ?? null,
    }));

  // 5) 차분 계산
  const plan: ComputeDeltaPlanResult = computeDeltaPlan({
    newCandidates,
    existingItems,
  });

  // 6) 정합성 일괄 검증 (신규 그룹 + addition 행 모두)
  const newGroupHeaders = plan.newGroups.map((g) => ({
    locationId: g.candidate.locationId,
    productionLineId: g.candidate.productionLineId,
  }));
  if (newGroupHeaders.length > 0) {
    await assertLocationsAndLines(tx, input.companyId, newGroupHeaders);
  }
  const allNewItemsForValidation: BatchPOItem[] = [
    ...plan.additions.map((a) => batchItemFromCandidate(a.candidate)),
    ...plan.newGroups.map((n) => batchItemFromCandidate(n.candidate)),
  ];
  if (allNewItemsForValidation.length > 0) {
    await assertSuppliersAndItems(tx, input.companyId, allNewItemsForValidation);
  }

  const affectedPOIds = new Set<string>();
  const createdPurchaseOrders: CreatePurchaseOrdersBatchResult["createdPurchaseOrders"] =
    [];
  const actorUserId = input.createdByUserId ?? "system";

  // 7) updates: 기존 item 의 quantity/unitPrice 갱신 + POAdjustmentLog 적층
  for (const u of plan.updates) {
    await tx.purchaseOrderItem.update({
      where: { id: u.purchaseOrderItemId },
      data: {
        quantity: u.afterQuantity,
        unitPrice: u.afterUnitPrice,
        totalPrice: u.afterQuantity * u.afterUnitPrice,
        systemQuantity: u.afterSystemQuantity,
        adjustedQuantity: u.afterQuantity,
        adjustmentReason: u.quantityReason ?? u.priceReason ?? null,
      },
    });

    if (u.quantityReason) {
      await tx.pOAdjustmentLog.create({
        data: {
          purchaseOrderId: u.purchaseOrderId,
          purchaseOrderItemId: u.purchaseOrderItemId,
          action: POAdjustmentAction.UPDATE_QUANTITY,
          fieldName: "quantity",
          beforeValue: JSON.stringify({
            quantity: u.beforeQuantity,
            systemQuantity: u.beforeSystemQuantity,
          }),
          afterValue: JSON.stringify({
            quantity: u.afterQuantity,
            systemQuantity: u.afterSystemQuantity,
          }),
          reason: u.quantityReason,
          sourceBatchId: batchId,
          actorUserId,
        },
      });
    }
    if (u.priceReason) {
      await tx.pOAdjustmentLog.create({
        data: {
          purchaseOrderId: u.purchaseOrderId,
          purchaseOrderItemId: u.purchaseOrderItemId,
          action: POAdjustmentAction.UPDATE_UNIT_PRICE,
          fieldName: "unitPrice",
          beforeValue: JSON.stringify({ unitPrice: u.beforeUnitPrice }),
          afterValue: JSON.stringify({ unitPrice: u.afterUnitPrice }),
          reason: u.priceReason,
          sourceBatchId: batchId,
          actorUserId,
        },
      });
    }
    affectedPOIds.add(u.purchaseOrderId);
  }

  // 8) additions: 기존 PO 에 새 item 추가 + POAdjustmentLog(ADD) 적층
  for (const a of plan.additions) {
    const created = await tx.purchaseOrderItem.create({
      data: {
        purchaseOrderId: a.purchaseOrderId,
        supplierItemId: a.candidate.supplierItemId,
        itemType: ItemType.MATERIAL,
        materialMasterId: a.candidate.materialMasterId,
        quantity: a.candidate.quantity,
        unitPrice: a.candidate.unitPrice,
        totalPrice: a.candidate.quantity * a.candidate.unitPrice,
        systemQuantity: a.candidate.netRequiredG ?? null,
        sourceType: "WIZARD_AUTO",
      },
      select: { id: true },
    });

    await tx.pOAdjustmentLog.create({
      data: {
        purchaseOrderId: a.purchaseOrderId,
        purchaseOrderItemId: created.id,
        action: POAdjustmentAction.ADD,
        fieldName: "item",
        beforeValue: null,
        afterValue: JSON.stringify({
          materialMasterId: a.candidate.materialMasterId,
          quantity: a.candidate.quantity,
          unitPrice: a.candidate.unitPrice,
        }),
        reason: "식단 수정으로 신규 자재 추가",
        sourceBatchId: batchId,
        actorUserId,
      },
    });
    affectedPOIds.add(a.purchaseOrderId);
  }

  // 9) 기존 PO 들의 totalAmount 재계산
  for (const poId of affectedPOIds) {
    const items = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: poId },
      select: { quantity: true, unitPrice: true },
    });
    const newTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { totalAmount: newTotal },
    });
  }

  // 10) newGroups: 매칭되는 기존 PO 가 없는 그룹 → 신규 PO 생성
  //     기존 NEW 모드 로직과 동일하게 그룹핑·채번·생성을 수행
  const usedOrderNumbers = new Set<string>();
  if (plan.newGroups.length > 0) {
    // 신규 그룹들을 (supplier × location × line) 기준 재그룹핑
    const newGroupsMap = new Map<string, NewItemForDelta[]>();
    for (const ng of plan.newGroups) {
      const key = `${ng.candidate.supplierId}|${ng.candidate.locationId}|${ng.candidate.productionLineId ?? "_"}`;
      if (!newGroupsMap.has(key)) newGroupsMap.set(key, []);
      newGroupsMap.get(key)!.push(ng.candidate);
    }

    for (const [, candidates] of newGroupsMap) {
      const first = candidates[0];
      const totalAmount = candidates.reduce(
        (s, c) => s + c.quantity * c.unitPrice,
        0,
      );

      const orderNumber = await generateNextOrderNumber(
        tx,
        input.companyId,
        input.orderDate,
        usedOrderNumbers,
      );

      const po = await tx.purchaseOrder.create({
        data: {
          companyId: input.companyId,
          supplierId: first.supplierId,
          locationId: first.locationId,
          productionLineId: first.productionLineId,
          batchId,
          orderNumber,
          status: "DRAFT",
          orderDate: input.orderDate,
          deliveryDate: input.deliveryDate,
          note: input.note,
          isManual: false,
          mealPlanGroupId: input.mealPlanGroupId ?? null,
          createdByUserId: input.createdByUserId,
          totalAmount,
          items: {
            create: candidates.map((c) => ({
              supplierItemId: c.supplierItemId,
              itemType: ItemType.MATERIAL,
              materialMasterId: c.materialMasterId,
              quantity: c.quantity,
              unitPrice: c.unitPrice,
              totalPrice: c.quantity * c.unitPrice,
              systemQuantity: c.netRequiredG ?? null,
              sourceType: "WIZARD_AUTO",
            })),
          },
        },
        select: {
          id: true,
          orderNumber: true,
          supplierId: true,
          locationId: true,
          productionLineId: true,
          totalAmount: true,
          _count: { select: { items: true } },
        },
      });

      createdPurchaseOrders.push({
        id: po.id,
        orderNumber: po.orderNumber,
        supplierId: po.supplierId,
        locationId: po.locationId,
        productionLineId: po.productionLineId,
        itemCount: po._count.items,
        totalAmount: po.totalAmount ?? 0,
      });
    }
  }

  // 11) 결과 집계 — 영향받은 기존 PO + 신규 생성된 PO 모두 포함
  const affectedPOSummaries = await tx.purchaseOrder.findMany({
    where: { id: { in: Array.from(affectedPOIds) } },
    select: {
      id: true,
      orderNumber: true,
      supplierId: true,
      locationId: true,
      productionLineId: true,
      totalAmount: true,
      _count: { select: { items: true } },
    },
  });

  const allPOs = [
    ...affectedPOSummaries.map((po) => ({
      id: po.id,
      orderNumber: po.orderNumber,
      supplierId: po.supplierId,
      locationId: po.locationId,
      productionLineId: po.productionLineId,
      itemCount: po._count.items,
      totalAmount: po.totalAmount ?? 0,
    })),
    ...createdPurchaseOrders,
  ];

  return {
    createdPurchaseOrders: allPOs,
    count: allPOs.length,
    totalAmount: allPOs.reduce((s, po) => s + po.totalAmount, 0),
    isIdempotentReplay: false,
    batchId,
    adjustmentSummary: {
      ...plan.summary,
      affectedPurchaseOrderIds: Array.from(affectedPOIds),
    },
  };
}

/** NewItemForDelta → BatchPOItem 어댑터 (검증 함수 재사용용) */
function batchItemFromCandidate(c: NewItemForDelta): BatchPOItem {
  return {
    supplierId: c.supplierId,
    supplierItemId: c.supplierItemId,
    itemType: ItemType.MATERIAL,
    materialMasterId: c.materialMasterId,
    locationId: c.locationId,
    productionLineId: c.productionLineId,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    systemQuantity: c.netRequiredG ?? undefined,
  };
}
