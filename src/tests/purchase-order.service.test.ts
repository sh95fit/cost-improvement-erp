import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import { Prisma, type PrismaClient } from '@prisma/client'

// 다른 service 테스트 컨벤션과 동일하게 모킹
vi.mock('@/lib/prisma', () => {
  const { mockDeep } = require('vitest-mock-extended')
  return { prisma: mockDeep<PrismaClient>() }
})

import { prisma } from '@/lib/prisma'
import {
  generatePurchaseOrderNumber,
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  transitionPurchaseOrderStatus,
  deletePurchaseOrder,
} from '@/features/purchase-order/services/purchase-order.service'

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>

// $transaction이 콜백을 받으면 tx 인자로 prismaMock 자체를 넘김
beforeEach(() => {
  mockReset(prismaMock)
  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(prismaMock)
    return Promise.all(arg)
  })
})

describe('generatePurchaseOrderNumber', () => {
  it('동일 날짜 발주가 없으면 001을 반환', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    const no = await generatePurchaseOrderNumber('c1', new Date('2026-06-15'))
    expect(no).toBe('PO-20260615-001')
  })

  it('마지막 번호 005가 있으면 006을 반환', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({
      orderNumber: 'PO-20260615-005',
    } as any)
    const no = await generatePurchaseOrderNumber('c1', new Date('2026-06-15'))
    expect(no).toBe('PO-20260615-006')
  })

  it('회사ID + prefix로 조회 조건이 구성됨', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    await generatePurchaseOrderNumber('c1', new Date('2026-06-15'))
    expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'c1', orderNumber: { startsWith: 'PO-20260615-' } },
        orderBy: { orderNumber: 'desc' },
      }),
    )
  })
})

describe('getPurchaseOrders', () => {
  it('페이지네이션 + 필터 + 정렬 조건이 정확히 전달됨', async () => {
    prismaMock.purchaseOrder.findMany.mockResolvedValueOnce([] as any)
    prismaMock.purchaseOrder.count.mockResolvedValueOnce(0)

    await getPurchaseOrders('c1', {
      page: 2,
      limit: 20,
      status: 'DRAFT',
      supplierId: 's1',
      sortBy: 'orderDate',
      sortOrder: 'desc',
    } as any)

    expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'c1',
          status: 'DRAFT',
          supplierId: 's1',
        }),
        skip: 20,
        take: 20,
        orderBy: { orderDate: 'desc' },
      }),
    )
  })

  it('search가 orderNumber/note에 OR로 적용됨', async () => {
    prismaMock.purchaseOrder.findMany.mockResolvedValueOnce([] as any)
    prismaMock.purchaseOrder.count.mockResolvedValueOnce(0)

    await getPurchaseOrders('c1', {
      page: 1,
      limit: 10,
      search: 'PO-2026',
      sortBy: 'orderDate',
      sortOrder: 'desc',
    } as any)

    const call = prismaMock.purchaseOrder.findMany.mock.calls[0][0] as any
    expect(call.where.OR).toEqual([
      { orderNumber: { contains: 'PO-2026', mode: 'insensitive' } },
      { note: { contains: 'PO-2026', mode: 'insensitive' } },
    ])
  })

  it('totalPages = ceil(total/limit)', async () => {
    prismaMock.purchaseOrder.findMany.mockResolvedValueOnce([] as any)
    prismaMock.purchaseOrder.count.mockResolvedValueOnce(45)
    const r = await getPurchaseOrders('c1', {
      page: 1, limit: 20, sortBy: 'orderDate', sortOrder: 'desc',
    } as any)
    expect(r.totalPages).toBe(3)
  })
})

describe('getPurchaseOrderById', () => {
  it('id + companyId 조건으로 조회', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    await getPurchaseOrderById('po1', 'c1')
    expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'po1', companyId: 'c1' } }),
    )
  })
})

describe('createPurchaseOrder', () => {
  it('totalAmount 및 각 item totalPrice 자동 계산', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    prismaMock.purchaseOrder.create.mockResolvedValueOnce({ id: 'po1' } as any)

    await createPurchaseOrder({
      companyId: 'c1',
      supplierId: 's1',
      orderDate: new Date('2026-06-15'),
      isManual: true,
      items: [
        { supplierItemId: 'si1', itemType: 'MATERIAL', materialMasterId: 'm1', quantity: 10, unitPrice: 100 },
        { supplierItemId: 'si2', itemType: 'MATERIAL', materialMasterId: 'm2', quantity: 5, unitPrice: 200 },
      ],
    } as any)

    const call = prismaMock.purchaseOrder.create.mock.calls[0][0] as any
    expect(call.data.totalAmount).toBe(2000) // 1000 + 1000
    expect(call.data.orderNumber).toBe('PO-20260615-001')
    expect(call.data.items.create[0].totalPrice).toBe(1000)
    expect(call.data.items.create[1].totalPrice).toBe(1000)
  })

  it('status는 DRAFT로 시작', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    prismaMock.purchaseOrder.create.mockResolvedValueOnce({ id: 'po1' } as any)
    await createPurchaseOrder({
      companyId: 'c1', supplierId: 's1', orderDate: new Date('2026-06-15'),
      isManual: true,
      items: [{ supplierItemId: 'si1', itemType: 'MATERIAL', materialMasterId: 'm1', quantity: 1, unitPrice: 1 }],
    } as any)
    const call = prismaMock.purchaseOrder.create.mock.calls[0][0] as any
    expect(call.data.status).toBe('DRAFT')
  })
})

describe('updatePurchaseOrder', () => {
  it('RECEIVED 상태는 수정 거부', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'RECEIVED' } as any)
    await expect(
      updatePurchaseOrder('po1', 'c1', { note: 'edit' } as any),
    ).rejects.toThrow(/수정할 수 없습니다/)
  })

  it('CANCELLED 상태는 수정 거부', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'CANCELLED' } as any)
    await expect(
      updatePurchaseOrder('po1', 'c1', { note: 'edit' } as any),
    ).rejects.toThrow()
  })

  it('items 제공 시 기존 items 삭제 후 재생성, totalAmount 재계산', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'DRAFT' } as any)
    prismaMock.purchaseOrderItem.deleteMany.mockResolvedValueOnce({ count: 2 } as any)
    prismaMock.purchaseOrder.update.mockResolvedValueOnce({ id: 'po1' } as any)

    await updatePurchaseOrder('po1', 'c1', {
      items: [
        { supplierItemId: 'si1', itemType: 'MATERIAL', materialMasterId: 'm1', quantity: 3, unitPrice: 500 },
      ],
    } as any)

    expect(prismaMock.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
      where: { purchaseOrderId: 'po1' },
    })
    const updateCall = prismaMock.purchaseOrder.update.mock.calls[0][0] as any
    expect(updateCall.data.totalAmount).toBe(1500)
  })

  it('PO 없으면 NOT_FOUND', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    await expect(
      updatePurchaseOrder('po1', 'c1', { note: 'x' } as any),
    ).rejects.toThrow(/찾을 수 없습니다/)
  })
})

describe('transitionPurchaseOrderStatus', () => {
  it('DRAFT → SUBMITTED 시 submittedAt 기록', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'DRAFT' } as any)
    prismaMock.purchaseOrder.update.mockResolvedValueOnce({ id: 'po1' } as any)

    await transitionPurchaseOrderStatus('po1', 'c1', { toStatus: 'SUBMITTED' } as any)
    const call = prismaMock.purchaseOrder.update.mock.calls[0][0] as any
    expect(call.data.status).toBe('SUBMITTED')
    expect(call.data.submittedAt).toBeInstanceOf(Date)
  })

  it('SUBMITTED → APPROVED 시 approvedAt + approvedByUser 연결', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'SUBMITTED' } as any)
    prismaMock.purchaseOrder.update.mockResolvedValueOnce({ id: 'po1' } as any)

    await transitionPurchaseOrderStatus('po1', 'c1', {
      toStatus: 'APPROVED', actorUserId: 'u1',
    } as any)
    const call = prismaMock.purchaseOrder.update.mock.calls[0][0] as any
    expect(call.data.approvedAt).toBeInstanceOf(Date)
    expect(call.data.approvedByUser).toEqual({ connect: { id: 'u1' } })
  })

  it('SUBMITTED → DRAFT 회수 시 submittedAt 초기화', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'SUBMITTED' } as any)
    prismaMock.purchaseOrder.update.mockResolvedValueOnce({ id: 'po1' } as any)
    await transitionPurchaseOrderStatus('po1', 'c1', { toStatus: 'DRAFT' } as any)
    const call = prismaMock.purchaseOrder.update.mock.calls[0][0] as any
    expect(call.data.submittedAt).toBeNull()
  })

  it('* → CANCELLED 시 cancelledAt + reason + 유저 기록', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'APPROVED' } as any)
    prismaMock.purchaseOrder.update.mockResolvedValueOnce({ id: 'po1' } as any)

    await transitionPurchaseOrderStatus('po1', 'c1', {
      toStatus: 'CANCELLED', cancelReason: '공급업체 결품', actorUserId: 'u9',
    } as any)
    const call = prismaMock.purchaseOrder.update.mock.calls[0][0] as any
    expect(call.data.cancelledAt).toBeInstanceOf(Date)
    expect(call.data.cancelReason).toBe('공급업체 결품')
    expect(call.data.cancelledByUser).toEqual({ connect: { id: 'u9' } })
  })

  it('RECEIVED 상태에서 어떤 전이도 거부', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'RECEIVED' } as any)
    await expect(
      transitionPurchaseOrderStatus('po1', 'c1', { toStatus: 'CANCELLED', cancelReason: 'x' } as any),
    ).rejects.toThrow(/허용되지 않습니다/)
  })

  it('DRAFT → APPROVED 는 거부 (SUBMITTED 거치지 않음)', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'DRAFT' } as any)
    await expect(
      transitionPurchaseOrderStatus('po1', 'c1', { toStatus: 'APPROVED' } as any),
    ).rejects.toThrow()
  })

  it('PO 없으면 NOT_FOUND', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    await expect(
      transitionPurchaseOrderStatus('po1', 'c1', { toStatus: 'SUBMITTED' } as any),
    ).rejects.toThrow(/찾을 수 없습니다/)
  })
})

describe('deletePurchaseOrder', () => {
  it('DRAFT 외 상태는 삭제 거부', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'SUBMITTED' } as any)
    await expect(deletePurchaseOrder('po1', 'c1')).rejects.toThrow(/DRAFT/)
  })

  it('DRAFT 상태는 items 삭제 후 PO 삭제', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', status: 'DRAFT' } as any)
    prismaMock.purchaseOrderItem.deleteMany.mockResolvedValueOnce({ count: 3 } as any)
    prismaMock.purchaseOrder.delete.mockResolvedValueOnce({ id: 'po1' } as any)

    await deletePurchaseOrder('po1', 'c1')

    expect(prismaMock.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
      where: { purchaseOrderId: 'po1' },
    })
    expect(prismaMock.purchaseOrder.delete).toHaveBeenCalledWith({
      where: { id: 'po1' },
    })
  })

  it('PO 없으면 NOT_FOUND', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce(null)
    await expect(deletePurchaseOrder('po1', 'c1')).rejects.toThrow(/찾을 수 없습니다/)
  })
})
