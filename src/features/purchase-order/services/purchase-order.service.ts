import { Prisma, POStatus } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import {
  canTransitionPOStatus,
  isPurchaseOrderLocked,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
  type TransitionPOStatusInput,
  type PurchaseOrderListQuery,
} from '../schemas/purchase-order.schema'

// ============================================================
// 발주번호 생성: PO-YYYYMMDD-XXX (회사별 일자별 시퀀스)
// ============================================================
export async function generatePurchaseOrderNumber(
  companyId: string,
  orderDate: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const yyyy = orderDate.getFullYear()
  const mm = String(orderDate.getMonth() + 1).padStart(2, '0')
  const dd = String(orderDate.getDate()).padStart(2, '0')
  const datePart = `${yyyy}${mm}${dd}`
  const prefix = `PO-${datePart}-`

  const last = await tx.purchaseOrder.findFirst({
    where: { companyId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })

  let nextSeq = 1
  if (last) {
    const seq = parseInt(last.orderNumber.slice(prefix.length), 10)
    if (!Number.isNaN(seq)) nextSeq = seq + 1
  }
  return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

// ============================================================
// 목록 조회
// ============================================================
export async function getPurchaseOrders(
  companyId: string,
  query: PurchaseOrderListQuery,
) {
  const { page, limit, search, status, supplierId, dateFrom, dateTo, sortBy, sortOrder } = query

  const where: Prisma.PurchaseOrderWhereInput = {
    companyId,
    ...(status && { status }),
    ...(supplierId && { supplierId }),
    ...(search && {
      OR: [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...((dateFrom || dateTo) && {
      orderDate: {
        ...(dateFrom && { gte: dateFrom }),
        ...(dateTo && { lte: dateTo }),
      },
    }),
  }

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        createdByUser: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// ============================================================
// 단건 조회 (모든 관계 포함)
// ============================================================
export async function getPurchaseOrderById(id: string, companyId: string) {
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
  })
}

// ============================================================
// 생성
// ============================================================
export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await generatePurchaseOrderNumber(
      input.companyId,
      input.orderDate,
      tx,
    )

    const totalAmount = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unitPrice,
      0,
    )

    return tx.purchaseOrder.create({
      data: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        orderNumber,
        status: 'DRAFT',
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
    })
  })
}

// ============================================================
// 수정 (DRAFT/SUBMITTED/APPROVED만 허용)
// items 제공 시 전체 교체 (간결성 우선)
// ============================================================
export async function updatePurchaseOrder(
  id: string,
  companyId: string,
  input: UpdatePurchaseOrderInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '발주서를 찾을 수 없습니다' })
    }
    if (isPurchaseOrderLocked(existing.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${existing.status} 상태의 발주서는 수정할 수 없습니다`,
      })
    }

    let totalAmount: number | undefined
    if (input.items) {
      totalAmount = input.items.reduce(
        (sum, it) => sum + it.quantity * it.unitPrice,
        0,
      )
      // 전체 교체 전략: 기존 items 삭제 후 재생성
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } })
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
    })
  })
}

// ============================================================
// 상태 전이
// ============================================================
export async function transitionPurchaseOrderStatus(
  id: string,
  companyId: string,
  input: TransitionPOStatusInput,
) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    })
    if (!po) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '발주서를 찾을 수 없습니다' })
    }
    if (!canTransitionPOStatus(po.status, input.toStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${po.status} → ${input.toStatus} 전이는 허용되지 않습니다`,
      })
    }

    const data: Prisma.PurchaseOrderUpdateInput = { status: input.toStatus }
    const now = new Date()

    // 전이별 timestamp/필드 기록
    if (po.status === 'DRAFT' && input.toStatus === 'SUBMITTED') {
      data.submittedAt = now
    } else if (po.status === 'SUBMITTED' && input.toStatus === 'DRAFT') {
      // 회수: submittedAt 초기화
      data.submittedAt = null
    } else if (po.status === 'SUBMITTED' && input.toStatus === 'APPROVED') {
      data.approvedAt = now
      if (input.actorUserId) {
        data.approvedByUser = { connect: { id: input.actorUserId } }
      }
    } else if (input.toStatus === 'CANCELLED') {
      data.cancelledAt = now
      data.cancelReason = input.cancelReason
      if (input.actorUserId) {
        data.cancelledByUser = { connect: { id: input.actorUserId } }
      }
    }
    // APPROVED → RECEIVED 는 ReceivingNote 생성 시 별도 호출 (Phase 3)

    return tx.purchaseOrder.update({
      where: { id },
      data,
      include: { items: true },
    })
  })
}

// ============================================================
// 삭제 (DRAFT만 허용)
// ============================================================
export async function deletePurchaseOrder(id: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    })
    if (!po) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '발주서를 찾을 수 없습니다' })
    }
    if (po.status !== 'DRAFT') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'DRAFT 상태의 발주서만 삭제할 수 있습니다. 그 외 상태는 CANCELLED 전이를 사용하세요',
      })
    }

    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } })
    return tx.purchaseOrder.delete({ where: { id } })
  })
}
