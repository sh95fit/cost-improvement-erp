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

// ─────────────────────────────────────
// ★ D19: 기본 공급업체 품목 갱신 헬퍼
// ─────────────────────────────────────
function collectDefaultSupplierUpdates(
  items: Array<{
    materialMasterId?: string;
    supplierItemId: string;
    setAsDefault?: boolean;
  }>,
): Array<{ materialMasterId: string; supplierItemId: string }> {
  const map = new Map<string, string>();
  for (const it of items) {
    if (!it.setAsDefault) continue;
    if (!it.materialMasterId) continue;
    // 같은 자재가 여러 행이면 가장 마지막 행의 supplierItem 으로 결정
    map.set(it.materialMasterId, it.supplierItemId);
  }
  return Array.from(map.entries()).map(([materialMasterId, supplierItemId]) => ({
    materialMasterId,
    supplierItemId,
  }));
}

async function applyDefaultSupplierUpdates(
  tx: Prisma.TransactionClient,
  items: Array<{
    materialMasterId?: string;
    supplierItemId: string;
    setAsDefault?: boolean;
  }>,
): Promise<void> {
  const updates = collectDefaultSupplierUpdates(items);
  if (updates.length === 0) return;

  // ★ D26 (D-DEFAULT-SUPPLIER-SOFT-DELETE-GUARD):
  //    soft-deleted 자재에는 default 갱신하지 않는다.
  //    build-po-items-from-mr.ts 가 deletedAt:null 필터를 적용하므로
  //    정상 흐름에선 도달 불가하지만, 외부 호출/테스트/레거시 데이터에서
  //    soft-deleted 자재가 흘러들어와도 안전하게 무시되도록 보장.
  //    update → updateMany: where 조건 미일치 시 0행 갱신으로 조용히 패스.
  await Promise.all(
    updates.map((u) =>
      tx.materialMaster.updateMany({
        where: { id: u.materialMasterId, deletedAt: null },
        data: { defaultSupplierItemId: u.supplierItemId },
      }),
    ),
  );
}

// ── 도메인 에러 키 ──
export const PO_BATCH_ERRORS = {
  EMPTY_ITEMS: "EMPTY_ITEMS",
  LOCATION_NOT_FOUND: "LOCATION_NOT_FOUND",
  PRODUCTION_LINE_NOT_FOUND: "PRODUCTION_LINE_NOT_FOUND",
  LINE_LOCATION_MISMATCH: "LINE_LOCATION_MISMATCH",
  SUPPLIER_NOT_FOUND: "SUPPLIER_NOT_FOUND",
  SUPPLIER_ITEM_NOT_FOUND: "SUPPLIER_ITEM_NOT_FOUND",
  IDEMPOTENT_REPLAY: "IDEMPOTENT_REPLAY",
  REPLACE_BLOCKED_BY_LOCKED_PO: "REPLACE_BLOCKED_BY_LOCKED_PO",
  REPLACE_MISSING_BASED_ON_POS: "REPLACE_MISSING_BASED_ON_POS",
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
    // ★ D19: 자재의 기본 공급업체 품목으로 (재)지정 동의 플래그
    setAsDefault: z.boolean().optional().default(false),
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
  // ★ Phase 1.6 (D15-1): deliveryDate → outboundDate
  outboundDate: z.coerce.date().optional(),
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
  /** ★ D19: MaterialMaster.defaultSupplierItemId 변경 행 — Action 레이어 감사 로그용 */
  defaultSupplierUpdates?: Array<{
    materialMasterId: string;
    supplierItemId: string;
  }>;
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
// ★ Phase 1.6 (D15-2): expectedReceiveDate 계산 헬퍼 (배치용)
// ============================================================
// PO 1건(=그룹) 의 items 의 supplierItem.leadTimeDays MAX 를 outboundDate 에 더해 산출.
// outboundDate null 이면 null (D15-4). leadTimeDays 가 전부 0/NULL 이면 default 1 (D15-5).
async function calculateExpectedReceiveDateForBatch(
  tx: Prisma.TransactionClient,
  outboundDate: Date | null | undefined,
  supplierItemIds: string[],
): Promise<Date | null> {
  if (!outboundDate) return null;

  let maxLeadTimeDays = 1;
  if (supplierItemIds.length > 0) {
    const items = await tx.supplierItem.findMany({
      where: { id: { in: supplierItemIds } },
      select: { leadTimeDays: true },
    });
    const maxFromItems = items.reduce(
      (max, it) => Math.max(max, it.leadTimeDays ?? 0),
      0,
    );
    if (maxFromItems > 0) maxLeadTimeDays = maxFromItems;
  }

  const result = new Date(outboundDate);
  result.setDate(result.getDate() + maxLeadTimeDays);
  return result;
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

    // ★ R1-b3 / R1-b4: 모드별 분기
    if (input.mode === "DELTA") {
      if (input.basedOnPOIds.length === 0) {
        throw new Error("DELTA_MISSING_BASED_ON_POS");
      }
      return await executeDeltaMode(tx, input, batch?.id ?? null);
    }
    if (input.mode === "REPLACE") {
      if (input.basedOnPOIds.length === 0) {
        throw new Error("REPLACE_MISSING_BASED_ON_POS");
      }
      return await executeReplaceMode(tx, input, batch?.id ?? null);
    }
    // NEW: 이하 기존 그룹핑·검증·채번·생성 로직 (변경 없음)

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

      // ★ Phase 1.6 (D15-2): 이 PO 의 expectedReceiveDate 계산
      const groupSupplierItemIds = items.map((it) => it.supplierItemId);
      const expectedReceiveDate = await calculateExpectedReceiveDateForBatch(
        tx,
        input.outboundDate,
        groupSupplierItemIds,
      );

      const po = await tx.purchaseOrder.create({
        data: {
          companyId: input.companyId,
          supplierId: first.supplierId,
          locationId: first.locationId,
          productionLineId: first.productionLineId ?? null,
          batchId: batch?.id ?? null,              // ★ R1-b1
          orderNumber,
          status: "DRAFT",
          orderDate: input.orderDate,
          outboundDate: input.outboundDate,        // ★ Phase 1.6
          expectedReceiveDate,                     // ★ Phase 1.6
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

    // ★ D19 (D-DEFAULT-SUPPLIER): setAsDefault=true 행에 대해 MaterialMaster.defaultSupplierItemId 갱신
    await applyDefaultSupplierUpdates(tx, input.items);

    return {
      createdPurchaseOrders,
      count: createdPurchaseOrders.length,
      totalAmount: grandTotal,
      isIdempotentReplay: false,
      batchId: batch?.id ?? null,
      defaultSupplierUpdates: collectDefaultSupplierUpdates(input.items),
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
      outboundDate: true,           // ★ Phase 1.6 (D15-1)
      expectedReceiveDate: true,    // ★ Phase 1.6 (D15-2)
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

  // ★ Phase 1.6 (D15-2): 기존 PO 의 outboundDate 재사용용 Map
  //    (9번 단계 expectedReceiveDate 재계산 시 추가 DB 조회 회피)
  const existingPOOutboundDateMap = new Map<string, Date | null>();
  for (const po of existingPOs) {
    existingPOOutboundDateMap.set(po.id, po.outboundDate);
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

  // 9) 기존 PO 들의 totalAmount + expectedReceiveDate 재계산
  for (const poId of affectedPOIds) {
    const items = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: poId },
      select: { quantity: true, unitPrice: true, supplierItemId: true },
    });
    const newTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

    // ★ Phase 1.6 (D15-2): items 변경에 따라 expectedReceiveDate 재계산
    //    기존 PO 의 outboundDate 를 그대로 사용 (DELTA 는 outboundDate 변경 안 함)
    //    Step 1 에서 미리 만들어 둔 Map 을 재사용하여 추가 DB 조회 회피
    const outboundDate = existingPOOutboundDateMap.get(poId) ?? null;
    const newExpectedReceiveDate = await calculateExpectedReceiveDateForBatch(
      tx,
      outboundDate,
      items.map((it) => it.supplierItemId),
    );

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        totalAmount: newTotal,
        expectedReceiveDate: newExpectedReceiveDate, // ★ Phase 1.6
      },
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

      // ★ Phase 1.6 (D15-2): newGroup PO 의 expectedReceiveDate 계산
      const newGroupSupplierItemIds = candidates.map((c) => c.supplierItemId);
      const expectedReceiveDate = await calculateExpectedReceiveDateForBatch(
        tx,
        input.outboundDate,
        newGroupSupplierItemIds,
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
          outboundDate: input.outboundDate,        // ★ Phase 1.6
          expectedReceiveDate,                     // ★ Phase 1.6
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

  // ★ D19
  await applyDefaultSupplierUpdates(tx, input.items);

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
    defaultSupplierUpdates: collectDefaultSupplierUpdates(input.items),
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
    setAsDefault: false, // ★ D19: DELTA 신규 추가 행은 wizard 경유가 아니므로 false 고정
  };
}

// ============================================================
// ★ R1-b4: REPLACE 모드 실행
// ============================================================
/**
 * basedOnPOIds 의 기존 DRAFT/SUBMITTED PO 들을 모두 CANCELLED 로 전이시키고,
 * 위저드 신규 산정값으로 새 PO 들을 생성한다.
 *
 * 정책 (PROGRESS.md D11 / R1-b 결정):
 * - DRAFT 또는 SUBMITTED 만 허용. APPROVED 이상 1건이라도 포함되면 차단.
 * - 취소된 PO 의 items 는 그대로 유지 (감사 추적용). status 만 CANCELLED.
 * - SUBMITTED PO 의 SupplierItemPriceHistory / SupplierItem.currentPrice 는 보존
 *   (stack-price-history 함수를 호출하지 않으면 자동으로 보존됨 — 별도 작업 불필요).
 * - 새 PO 들은 DRAFT 로 생성. 단가 적층은 추후 사용자가 SUBMITTED 전이 시킬 때 처리.
 * - 신규 생성은 NEW 모드와 동일한 그룹핑·채번·검증 로직 재사용.
 *
 * @throws Error("REPLACE_BLOCKED_BY_LOCKED_PO") DRAFT/SUBMITTED 외 상태 PO 포함 시
 */
async function executeReplaceMode(
  tx: Prisma.TransactionClient,
  input: CreatePurchaseOrdersBatchInput,
  batchId: string | null,
): Promise<CreatePurchaseOrdersBatchResult> {
  // 1) 기존 PO 조회 + 잠금 상태 차단
  const existingPOs = await tx.purchaseOrder.findMany({
    where: {
      id: { in: input.basedOnPOIds },
      companyId: input.companyId,
    },
    select: { id: true, status: true, orderNumber: true },
  });

  const locked = existingPOs.filter(
    (po) => po.status !== "DRAFT" && po.status !== "SUBMITTED",
  );
  if (locked.length > 0) {
    throw new Error("REPLACE_BLOCKED_BY_LOCKED_PO");
  }

  const actorUserId = input.createdByUserId ?? "system";
  const now = new Date();
  const cancelReason = batchId
    ? `REGENERATED_FROM_WIZARD_REPLACE: ${batchId}`
    : "REGENERATED_FROM_WIZARD_REPLACE";

  // 2) 기존 DRAFT/SUBMITTED PO 들을 CANCELLED 로 전이
  //    SUBMITTED PO 의 PriceHistory / currentPrice 는 별도 작업 없이 자동 보존.
  const cancelledPOIds: string[] = [];
  const cancelledOrderNumbers: string[] = [];
  for (const po of existingPOs) {
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledByUserId: actorUserId,
        cancelReason,
      },
    });
    cancelledPOIds.push(po.id);
    cancelledOrderNumbers.push(po.orderNumber);

    // 감사 적층 — POAdjustmentAction enum 에 CANCEL 이 없으므로 REMOVE + fieldName="po_status"
    // 컨벤션으로 표현. 추후 enum 정리 시 일괄 마이그레이션 후보.
    await tx.pOAdjustmentLog.create({
      data: {
        purchaseOrderId: po.id,
        purchaseOrderItemId: null,
        action: POAdjustmentAction.REMOVE,
        fieldName: "po_status",
        beforeValue: JSON.stringify({ status: po.status }),
        afterValue: JSON.stringify({ status: "CANCELLED" }),
        reason: cancelReason,
        sourceBatchId: batchId,
        actorUserId,
      },
    });
  }

  // 3) NEW 모드와 동일한 그룹핑·검증·채번·생성
  const groups = new Map<string, BatchPOItem[]>();
  for (const item of input.items) {
    const key = makeGroupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const groupHeaders = Array.from(groups.values()).map((arr) => ({
    locationId: arr[0].locationId,
    productionLineId: arr[0].productionLineId ?? null,
  }));
  await assertLocationsAndLines(tx, input.companyId, groupHeaders);
  await assertSuppliersAndItems(tx, input.companyId, input.items);

  const usedOrderNumbers = new Set<string>();
  const createdPurchaseOrders: CreatePurchaseOrdersBatchResult["createdPurchaseOrders"] =
    [];
  let grandTotal = 0;

  // 새 PO 의 note 에 취소된 원본 PO 번호 기록 (PROGRESS.md 합의)
  const replaceNoteSuffix =
    cancelledOrderNumbers.length > 0
      ? `\n[REPLACE] 취소된 원본 PO: ${cancelledOrderNumbers.join(", ")}`
      : "";

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

    const noteForThisPO =
      (input.note ?? "").trim() + replaceNoteSuffix;

    // ★ Phase 1.6 (D15-2): REPLACE 신규 PO 의 expectedReceiveDate 계산
    const groupSupplierItemIds = items.map((it) => it.supplierItemId);
    const expectedReceiveDate = await calculateExpectedReceiveDateForBatch(
      tx,
      input.outboundDate,
      groupSupplierItemIds,
    );

    const po = await tx.purchaseOrder.create({
      data: {
        companyId: input.companyId,
        supplierId: first.supplierId,
        locationId: first.locationId,
        productionLineId: first.productionLineId ?? null,
        batchId,
        orderNumber,
        status: "DRAFT",
        orderDate: input.orderDate,
        outboundDate: input.outboundDate,        // ★ Phase 1.6
        expectedReceiveDate,                     // ★ Phase 1.6
        note: noteForThisPO || null,
        isManual: false,
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

  // ★ D19
  await applyDefaultSupplierUpdates(tx, input.items);

  return {
    createdPurchaseOrders,
    count: createdPurchaseOrders.length,
    totalAmount: grandTotal,
    isIdempotentReplay: false,
    batchId,
    adjustmentSummary: {
      increased: 0,
      decreased: 0,
      added: createdPurchaseOrders.length,
      priceChanged: 0,
      unchanged: 0,
      totalDeltaAmount: grandTotal,
      affectedPurchaseOrderIds: cancelledPOIds,
    },
    defaultSupplierUpdates: collectDefaultSupplierUpdates(input.items),
  };
}