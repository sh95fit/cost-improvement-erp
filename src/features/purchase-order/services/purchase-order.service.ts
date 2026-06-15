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
  const { page, limit, search, status, supplierId, dateFrom, dateTo, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status && { status }),
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
export async function getPurchaseOrderById(companyId: string, id: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      createdByUser: { select: { id: true, name: true } },
      approvedByUser: { select: { id: true, name: true } },
      cancelledByUser: { select: { id: true, name: true } },
      mealPlanGroup: { select: { id: true, planDate: true } },
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
}

// ── 발주 생성 ──
export async function createPurchaseOrder(
  companyId: string,
  input: CreatePurchaseOrderInput,
) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await generatePurchaseOrderNumber(
      companyId,
      input.orderDate,
      tx,
    );

    const totalAmount = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unitPrice,
      0,
    );

    return tx.purchaseOrder.create({
      data: {
        companyId,
        supplierId: input.supplierId,
        orderNumber,
        status: "DRAFT",
        orderDate: input.orderDate,
        deliveryDate: input.deliveryDate,
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
      select: { id: true, status: true },
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (isPurchaseOrderLocked(existing.status)) {
      throw new Error("PO_LOCKED");
    }

    let totalAmount: number | undefined;
    if (input.items) {
      totalAmount = input.items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0,
      );
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(input.supplierId && { supplierId: input.supplierId }),
        ...(input.orderDate && { orderDate: input.orderDate }),
        ...(input.deliveryDate !== undefined && { deliveryDate: input.deliveryDate }),
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
) {
  return prisma.$transaction(async (tx) => {
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
    } else if (po.status === "SUBMITTED" && input.toStatus === "DRAFT") {
      data.submittedAt = null;
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
    // APPROVED → RECEIVED 는 ReceivingNote 생성 시 별도 호출 (Phase 3)

    return tx.purchaseOrder.update({
      where: { id },
      data,
      include: { items: true },
    });
  });
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
