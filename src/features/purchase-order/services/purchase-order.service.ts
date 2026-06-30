import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  canTransitionPOStatus,
  isPurchaseOrderLocked,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
  type TransitionPOStatusInput,
  type PurchaseOrderListQuery,
} from "../schemas/purchase-order.schema";

import { stackPriceHistoryForPO } from "../lib/stack-price-history";
import { withTransaction } from "@/lib/auth/transaction";

// ── 도메인 에러 키 ──
export const PO_LOCATION_ERRORS = {
  LOCATION_NOT_FOUND: "LOCATION_NOT_FOUND",
  PRODUCTION_LINE_NOT_FOUND: "PRODUCTION_LINE_NOT_FOUND",
  LINE_LOCATION_MISMATCH: "LINE_LOCATION_MISMATCH",
} as const;

// ── 라인/공장 정합성 검증 헬퍼 ──
async function assertLocationAndLine(
  tx: Prisma.TransactionClient,
  companyId: string,
  locationId: string,
  productionLineId: string | null | undefined,
) {
  const location = await tx.location.findFirst({
    where: { id: locationId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!location) throw new Error("LOCATION_NOT_FOUND");

  if (productionLineId) {
    const line = await tx.productionLine.findFirst({
      where: { id: productionLineId, companyId, deletedAt: null },
      select: { locationId: true },
    });
    if (!line) throw new Error("PRODUCTION_LINE_NOT_FOUND");
    if (line.locationId !== locationId) throw new Error("LINE_LOCATION_MISMATCH");
  }
}

// ★ Phase 1.6 (D15-2): expectedReceiveDate 계산 헬퍼
// outbound_date + MAX(items.supplierItem.leadTimeDays) — PO 헤더 단위
// supplierItemIds 가 비어있거나 leadTimeDays 가 전부 0/NULL 인 경우 default 1 사용 (D15-5)
async function calculateExpectedReceiveDate(
  tx: Prisma.TransactionClient,
  outboundDate: Date | null | undefined,
  supplierItemIds: string[],
): Promise<Date | null> {
  if (!outboundDate) return null; // D15-4: outboundDate null 이면 expectedReceiveDate 도 null

  let maxLeadTimeDays = 1; // D15-5 default
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

  // DATE 연산 — 자정 기준 일수 가산
  const result = new Date(outboundDate);
  result.setDate(result.getDate() + maxLeadTimeDays);
  return result;
}


// ── 발주번호 자동 생성: PO-YYYYMMDD-XXX (회사+일자 시퀀스) ──
async function generatePurchaseOrderNumber(
  companyId: string,
  orderDate: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
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
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

// ── 발주 목록 조회 (페이지네이션 + 필터 + 정렬) ──
export async function getPurchaseOrders(
  companyId: string,
  query: PurchaseOrderListQuery,
) {
  const {
    page, limit, search, status, excludeCancelled,
    supplierId, dateFrom, dateTo, sortBy, sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status
      ? { status }
      // ★ FIX-PO-LIST-CANCELLED (D27): status 미지정 + excludeCancelled=true 면 CANCELLED 만 제외
      : excludeCancelled
        ? { status: { not: "CANCELLED" as const } }
        : {}),
    ...(supplierId && { supplierId }),
    ...(search && {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" as const } },
        { note: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...((dateFrom || dateTo) && {
      orderDate: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, code: true } },
        productionLine: { select: { id: true, name: true, code: true } },
        mealPlanGroup: { select: { id: true, planDate: true } },  
        _count: { select: { items: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── 발주 단건 조회 (모든 관계 포함) ──
// ★ Phase 1.6 (D15-3): items 각각에 itemExpectedReceiveDate (런타임 derived) 추가
export async function getPurchaseOrderById(companyId: string, id: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      createdByUser: { select: { id: true, name: true } },
      approvedByUser: { select: { id: true, name: true } },
      cancelledByUser: { select: { id: true, name: true } },
      mealPlanGroup: { select: { id: true, planDate: true } },
      location: { select: { id: true, name: true, code: true, type: true } },        // ★ Phase 1.5
      productionLine: { select: { id: true, name: true, code: true } },              // ★ Phase 1.5
      items: {
        include: {
          supplierItem: { include: { supplyUnit: true } },
          materialMaster: { select: { id: true, name: true, code: true } },
          subsidiaryMaster: { select: { id: true, name: true, code: true } },
        },
      },
      receivingNotes: {
        select: {
          id: true,
          receiveNumber: true,
          status: true,
          receivedDate: true,
        },
      },
    },
  });

  if (!po) return null;

  // ★ Phase 1.6 (D15-3): 품목별 입고일 런타임 derived
  //   itemExpectedReceiveDate = outboundDate + item.supplierItem.leadTimeDays
  //   outboundDate 가 null 이면 itemExpectedReceiveDate 도 null
  const itemsWithExpectedDate = po.items.map((item) => {
    let itemExpectedReceiveDate: Date | null = null;
    if (po.outboundDate) {
      const leadTimeDays = item.supplierItem?.leadTimeDays ?? 1;
      const d = new Date(po.outboundDate);
      d.setDate(d.getDate() + leadTimeDays);
      itemExpectedReceiveDate = d;
    }
    return { ...item, itemExpectedReceiveDate };
  });

  return { ...po, items: itemsWithExpectedDate };
}

// ── 발주 생성 ──
export async function createPurchaseOrder(
  companyId: string,
  input: CreatePurchaseOrderInput,
) {
  return prisma.$transaction(async (tx) => {
    // ★ Phase 1.5: location/productionLine 정합성 검증
    await assertLocationAndLine(tx, companyId, input.locationId, input.productionLineId);

    const orderNumber = await generatePurchaseOrderNumber(
      companyId,
      input.orderDate,
      tx,
    );

    const totalAmount = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unitPrice,
      0,
    );

    // ★ Phase 1.6 (D15-2): expectedReceiveDate 자동 산출
    const supplierItemIds = input.items.map((it) => it.supplierItemId);
    const expectedReceiveDate = await calculateExpectedReceiveDate(
      tx,
      input.outboundDate,
      supplierItemIds,
    );

    return tx.purchaseOrder.create({
      data: {
        companyId,
        supplierId: input.supplierId,
        locationId: input.locationId,                              // ★ Phase 1.5
        productionLineId: input.productionLineId ?? null,          // ★ Phase 1.5
        orderNumber,
        status: "DRAFT",
        orderDate: input.orderDate,
        outboundDate: input.outboundDate,                          // ★ Phase 1.6
        expectedReceiveDate,                                       // ★ Phase 1.6
        note: input.note,
        isManual: input.isManual,
        mealPlanGroupId: input.mealPlanGroupId,
        createdByUserId: input.createdByUserId,
        totalAmount,
        items: {
          create: input.items.map((it) => ({
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
            sourceType: it.sourceType,
            materialRequirementId: it.materialRequirementId,
          })),
        },
      },
      include: { items: true },
    });
  });
}

// ── 발주 수정 (DRAFT/SUBMITTED/APPROVED 허용, items 제공 시 전체 교체) ──
export async function updatePurchaseOrder(
  companyId: string,
  id: string,
  input: UpdatePurchaseOrderInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        status: true,
        locationId: true,                                          // ★ Phase 1.5
        outboundDate: true,                                        // ★ Phase 1.6 (재계산 필요시 사용)
      },
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (isPurchaseOrderLocked(existing.status)) {
      throw new Error("PO_LOCKED");
    }

    // ★ Phase 1.5: location/productionLine 변경 시 정합성 검증
    if (input.locationId || input.productionLineId !== undefined) {
      const effectiveLocationId = input.locationId ?? existing.locationId;
      await assertLocationAndLine(
        tx,
        companyId,
        effectiveLocationId,
        input.productionLineId,
      );
    }

    let totalAmount: number | undefined;
    if (input.items) {
      totalAmount = input.items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0,
      );
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    // ★ Phase 1.6 (D15-2): outboundDate 또는 items 가 변경된 경우 expectedReceiveDate 재계산
    let expectedReceiveDate: Date | null | undefined = undefined;
    const outboundDateChanged = input.outboundDate !== undefined;
    const itemsChanged = !!input.items;
    if (outboundDateChanged || itemsChanged) {
      const effectiveOutboundDate = outboundDateChanged
        ? input.outboundDate
        : existing.outboundDate;
      let supplierItemIds: string[];
      if (itemsChanged) {
        supplierItemIds = input.items!.map((it) => it.supplierItemId);
      } else {
        const currentItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: id },
          select: { supplierItemId: true },
        });
        supplierItemIds = currentItems.map((it) => it.supplierItemId);
      }
      expectedReceiveDate = await calculateExpectedReceiveDate(
        tx,
        effectiveOutboundDate,
        supplierItemIds,
      );
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(input.supplierId && { supplierId: input.supplierId }),
        ...(input.locationId && { locationId: input.locationId }),                       // ★ Phase 1.5
        ...(input.productionLineId !== undefined && { productionLineId: input.productionLineId }),  // ★ Phase 1.5
        ...(input.orderDate && { orderDate: input.orderDate }),
        ...(input.outboundDate !== undefined && { outboundDate: input.outboundDate }),   // ★ Phase 1.6
        ...(expectedReceiveDate !== undefined && { expectedReceiveDate }),               // ★ Phase 1.6
        ...(input.note !== undefined && { note: input.note }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(input.items && {
          items: {
            create: input.items.map((it) => ({
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
              sourceType: it.sourceType,
              materialRequirementId: it.materialRequirementId,
            })),
          },
        }),
      },
      include: { items: true },
    });
  });
}

// ── 발주 상태 전이 ──
export async function transitionPurchaseOrderStatus(
  companyId: string,
  id: string,
  input: TransitionPOStatusInput,
  existingTx?: Prisma.TransactionClient,
) {
  return withTransaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!po) throw new Error("NOT_FOUND");
    if (!canTransitionPOStatus(po.status, input.toStatus)) {
      throw new Error("INVALID_TRANSITION");
    }

    const data: Prisma.PurchaseOrderUpdateInput = { status: input.toStatus };
    const now = new Date();

    if (po.status === "DRAFT" && input.toStatus === "SUBMITTED") {
      data.submittedAt = now;
      // ★ Phase 4-B'-4: PriceHistory 적층 + currentPrice 갱신
      await stackPriceHistoryForPO(tx, id, now);
    } else if (po.status === "SUBMITTED" && input.toStatus === "DRAFT") {
      data.submittedAt = null;
      // ★ 되돌리기 시 PriceHistory는 그대로 유지 (정책)
    } else if (po.status === "SUBMITTED" && input.toStatus === "APPROVED") {
      data.approvedAt = now;
      if (input.actorUserId) {
        data.approvedByUser = { connect: { id: input.actorUserId } };
      }
    } else if (input.toStatus === "CANCELLED") {
      data.cancelledAt = now;
      data.cancelReason = input.cancelReason;
      if (input.actorUserId) {
        data.cancelledByUser = { connect: { id: input.actorUserId } };
      }
    }
    // SUBMITTED → RECEIVED 는 D30 ReceivingNoteService.confirm 단일 트랜잭션 안에서
    // existingTx 를 주입하여 호출됨 (P5 재정정 2026-06-30).

    return tx.purchaseOrder.update({
      where: { id },
      data,
      include: { items: true },
    });
  }, { existingTx });
}

// ── 발주 삭제 (DRAFT만 허용) ──
export async function deletePurchaseOrder(companyId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!po) throw new Error("NOT_FOUND");
    if (po.status !== "DRAFT") throw new Error("PO_NOT_DRAFT");

    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    return tx.purchaseOrder.delete({ where: { id } });
  });
}
