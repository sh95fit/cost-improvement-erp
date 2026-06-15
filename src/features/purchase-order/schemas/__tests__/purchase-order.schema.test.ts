import { describe, it, expect } from 'vitest'
import {
  createPurchaseOrderSchema,
  purchaseOrderItemInputSchema,
  transitionPurchaseOrderStatusSchema,
  purchaseOrderListQuerySchema,
  canTransitionPOStatus,
  isPurchaseOrderEditable,
  isPurchaseOrderLocked,
  getNextAllowedStatuses,
} from '../purchase-order.schema'

describe('purchaseOrderItemInputSchema', () => {
  const baseItem = {
    supplierItemId: 'si_1',
    itemType: 'MATERIAL' as const,
    materialMasterId: 'mm_1',
    quantity: 10,
    unitPrice: 1000,
  }

  it('MATERIAL 정상 입력 → PASS', () => {
    expect(purchaseOrderItemInputSchema.safeParse(baseItem).success).toBe(true)
  })

  it('SUBSIDIARY 정상 입력 → PASS', () => {
    const item = {
      ...baseItem,
      itemType: 'SUBSIDIARY' as const,
      materialMasterId: undefined,
      subsidiaryMasterId: 'sm_1',
    }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(true)
  })

  it('MATERIAL인데 materialMasterId 없음 → FAIL', () => {
    const item = { ...baseItem, materialMasterId: undefined }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(false)
  })

  it('SUBSIDIARY인데 subsidiaryMasterId 없음 → FAIL', () => {
    const item = {
      ...baseItem,
      itemType: 'SUBSIDIARY' as const,
      materialMasterId: undefined,
    }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(false)
  })

  it('MATERIAL인데 subsidiaryMasterId 함께 지정 → FAIL', () => {
    const item = { ...baseItem, subsidiaryMasterId: 'sm_1' }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(false)
  })

  it('quantity 0 → FAIL', () => {
    const item = { ...baseItem, quantity: 0 }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(false)
  })

  it('quantity 음수 → FAIL', () => {
    const item = { ...baseItem, quantity: -1 }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(false)
  })

  it('unitPrice 음수 → FAIL', () => {
    const item = { ...baseItem, unitPrice: -100 }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(false)
  })

  it('unitPrice 0 → PASS (무상 입고 케이스)', () => {
    const item = { ...baseItem, unitPrice: 0 }
    expect(purchaseOrderItemInputSchema.safeParse(item).success).toBe(true)
  })
})

describe('createPurchaseOrderSchema', () => {
  const baseInput = {
    companyId: 'c_1',
    supplierId: 'sup_1',
    orderDate: '2026-06-15',
    items: [
      {
        supplierItemId: 'si_1',
        itemType: 'MATERIAL' as const,
        materialMasterId: 'mm_1',
        quantity: 10,
        unitPrice: 1000,
      },
    ],
  }

  it('최소 필드 정상 입력 → PASS', () => {
    expect(createPurchaseOrderSchema.safeParse(baseInput).success).toBe(true)
  })

  it('items 0개 → FAIL', () => {
    const input = { ...baseInput, items: [] }
    expect(createPurchaseOrderSchema.safeParse(input).success).toBe(false)
  })

  it('supplierId 빈 문자열 → FAIL', () => {
    const input = { ...baseInput, supplierId: '' }
    expect(createPurchaseOrderSchema.safeParse(input).success).toBe(false)
  })

  it('orderDate 문자열 자동 변환 → PASS', () => {
    const result = createPurchaseOrderSchema.safeParse(baseInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orderDate).toBeInstanceOf(Date)
    }
  })
})

describe('transitionPurchaseOrderStatusSchema', () => {
  it('CANCELLED + cancelReason 있음 → PASS', () => {
    expect(
      transitionPurchaseOrderStatusSchema.safeParse({
        toStatus: 'CANCELLED',
        cancelReason: '공급업체 사정으로 취소',
      }).success,
    ).toBe(true)
  })

  it('CANCELLED + cancelReason 없음 → FAIL', () => {
    expect(
      transitionPurchaseOrderStatusSchema.safeParse({
        toStatus: 'CANCELLED',
      }).success,
    ).toBe(false)
  })

  it('CANCELLED + cancelReason 공백만 → FAIL', () => {
    expect(
      transitionPurchaseOrderStatusSchema.safeParse({
        toStatus: 'CANCELLED',
        cancelReason: '   ',
      }).success,
    ).toBe(false)
  })

  it('APPROVED 전이는 cancelReason 불필요 → PASS', () => {
    expect(
      transitionPurchaseOrderStatusSchema.safeParse({
        toStatus: 'APPROVED',
      }).success,
    ).toBe(true)
  })
})

describe('purchaseOrderListQuerySchema', () => {
  it('빈 입력 → 기본값 적용', () => {
    const result = purchaseOrderListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
      expect(result.data.sortBy).toBe('orderDate')
      expect(result.data.sortOrder).toBe('desc')
    }
  })

  it('limit 100 초과 → FAIL', () => {
    expect(
      purchaseOrderListQuerySchema.safeParse({ limit: 101 }).success,
    ).toBe(false)
  })

  it('잘못된 sortBy → FAIL', () => {
    expect(
      purchaseOrderListQuerySchema.safeParse({ sortBy: 'invalid' }).success,
    ).toBe(false)
  })
})

describe('상태 전이 헬퍼', () => {
  it('canTransitionPOStatus 매트릭스', () => {
    expect(canTransitionPOStatus('DRAFT', 'SUBMITTED')).toBe(true)
    expect(canTransitionPOStatus('DRAFT', 'CANCELLED')).toBe(true)
    expect(canTransitionPOStatus('DRAFT', 'APPROVED')).toBe(false)
    expect(canTransitionPOStatus('SUBMITTED', 'DRAFT')).toBe(true)
    expect(canTransitionPOStatus('SUBMITTED', 'APPROVED')).toBe(true)
    expect(canTransitionPOStatus('APPROVED', 'RECEIVED')).toBe(true)
    expect(canTransitionPOStatus('APPROVED', 'DRAFT')).toBe(false)
    expect(canTransitionPOStatus('RECEIVED', 'APPROVED')).toBe(false)
    expect(canTransitionPOStatus('CANCELLED', 'DRAFT')).toBe(false)
  })

  it('isPurchaseOrderEditable', () => {
    expect(isPurchaseOrderEditable('DRAFT')).toBe(true)
    expect(isPurchaseOrderEditable('SUBMITTED')).toBe(true)
    expect(isPurchaseOrderEditable('APPROVED')).toBe(true)
    expect(isPurchaseOrderEditable('RECEIVED')).toBe(false)
    expect(isPurchaseOrderEditable('CANCELLED')).toBe(false)
  })

  it('isPurchaseOrderLocked', () => {
    expect(isPurchaseOrderLocked('RECEIVED')).toBe(true)
    expect(isPurchaseOrderLocked('CANCELLED')).toBe(true)
    expect(isPurchaseOrderLocked('DRAFT')).toBe(false)
    expect(isPurchaseOrderLocked('APPROVED')).toBe(false)
  })

  it('getNextAllowedStatuses', () => {
    expect(getNextAllowedStatuses('RECEIVED')).toEqual([])
    expect(getNextAllowedStatuses('CANCELLED')).toEqual([])
    expect(getNextAllowedStatuses('DRAFT')).toContain('SUBMITTED')
  })
})
