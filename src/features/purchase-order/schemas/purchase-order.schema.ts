import { z } from 'zod'
import { POStatus, ItemType } from '@prisma/client'

// ============================================================
// 운영 라벨 (UI 매핑)
// PROGRESS.md Sprint 3 Phase 1 결정사항 (옵션 A 채택)
// ============================================================
export const PO_STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: '작성중',
  SUBMITTED: '발주등록',
  APPROVED: '발주확정',
  RECEIVED: '입고완료',
  CANCELLED: '취소',
}

export const PO_STATUS_BADGE_COLOR: Record<POStatus, string> = {
  DRAFT: 'gray',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  RECEIVED: 'emerald',
  CANCELLED: 'red',
}

// ============================================================
// 상태 전이 매트릭스
// ============================================================
// 키: from → 값: 허용되는 to 집합
// 정책:
//   - SUBMITTED → DRAFT: 공급업체 통보 전 회수 가능
//   - APPROVED → DRAFT: 비허용 (확정 이후 회수는 CANCELLED 처리)
//   - RECEIVED, CANCELLED: 잠금 (전이 불가)
export const PO_STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
}

// ============================================================
// PurchaseOrderItem 입력 스키마
// ============================================================
export const purchaseOrderItemInputSchema = z
  .object({
    supplierItemId: z.string().min(1, '공급업체 품목을 선택하세요'),
    itemType: z.nativeEnum(ItemType).default('MATERIAL'),
    materialMasterId: z.string().min(1).optional(),
    subsidiaryMasterId: z.string().min(1).optional(),
    quantity: z.number().positive('수량은 0보다 커야 합니다'),
    unitPrice: z.number().nonnegative('단가는 0 이상이어야 합니다'),
    systemQuantity: z.number().nonnegative().optional(),
    adjustedQuantity: z.number().nonnegative().optional(),
    adjustmentReason: z.string().max(500).optional(),
    sourceType: z.string().max(50).optional(),
    materialRequirementId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.itemType === 'MATERIAL' && !data.materialMasterId) {
      ctx.addIssue({
        code: 'custom',
        path: ['materialMasterId'],
        message: 'MATERIAL 품목은 자재 ID가 필요합니다',
      })
    }
    if (data.itemType === 'SUBSIDIARY' && !data.subsidiaryMasterId) {
      ctx.addIssue({
        code: 'custom',
        path: ['subsidiaryMasterId'],
        message: 'SUBSIDIARY 품목은 부자재 ID가 필요합니다',
      })
    }
    if (data.itemType === 'MATERIAL' && data.subsidiaryMasterId) {
      ctx.addIssue({
        code: 'custom',
        path: ['subsidiaryMasterId'],
        message: 'MATERIAL 품목에 부자재 ID를 함께 지정할 수 없습니다',
      })
    }
    if (data.itemType === 'SUBSIDIARY' && data.materialMasterId) {
      ctx.addIssue({
        code: 'custom',
        path: ['materialMasterId'],
        message: 'SUBSIDIARY 품목에 자재 ID를 함께 지정할 수 없습니다',
      })
    }
  })

// ============================================================
// PurchaseOrder 생성 스키마
// ============================================================
export const createPurchaseOrderSchema = z.object({
  companyId: z.string().min(1),
  supplierId: z.string().min(1, '공급업체를 선택하세요'),
  locationId: z.string().min(1, '공장/창고를 선택하세요'),              // ★ 추가
  productionLineId: z.string().min(1).nullable().optional(),            // ★ 추가
  orderDate: z.coerce.date(),
  deliveryDate: z.coerce.date().optional(),
  note: z.string().max(1000).optional(),
  isManual: z.boolean().default(false),
  mealPlanGroupId: z.string().optional(),
  createdByUserId: z.string().optional(),
  items: z
    .array(purchaseOrderItemInputSchema)
    .min(1, '발주 품목을 1개 이상 추가하세요'),
})

// ============================================================
// PurchaseOrder 수정 스키마
// ============================================================
// 본 스키마는 DRAFT/SUBMITTED/APPROVED 상태에서의 수정에 사용.
// APPROVED 상태에서 수정 시 사유 기록 강제는 서비스 레이어에서 처리
// (스키마 레벨에서는 모든 필드를 optional로 두고, 서비스에서 status별 가드 적용)
export const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),                             // ★ 추가
  productionLineId: z.string().min(1).nullable().optional(),            // ★ 추가
  orderDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      purchaseOrderItemInputSchema.and(
        z.object({ id: z.string().optional() }),
      ),
    )
    .optional(),
})

// ============================================================
// 상태 전이 입력 스키마
// ============================================================
export const transitionPurchaseOrderStatusSchema = z
  .object({
    toStatus: z.nativeEnum(POStatus),
    actorUserId: z.string().optional(),
    cancelReason: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.toStatus === 'CANCELLED' && !data.cancelReason?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['cancelReason'],
        message: 'CANCELLED 전이 시 취소 사유는 필수입니다',
      })
    }
  })

// ============================================================
// 목록 쿼리 스키마
// ============================================================
export const purchaseOrderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(POStatus).optional(),
  supplierId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z
    .enum(['orderDate', 'orderNumber', 'createdAt', 'totalAmount'])
    .default('orderDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================================
// 타입 Export
// ============================================================
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemInputSchema>
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
export type TransitionPOStatusInput = z.infer<typeof transitionPurchaseOrderStatusSchema>
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>

// ============================================================
// 헬퍼 함수
// ============================================================
export function canTransitionPOStatus(from: POStatus, to: POStatus): boolean {
  return PO_STATUS_TRANSITIONS[from].includes(to)
}

export function isPurchaseOrderEditable(status: POStatus): boolean {
  return (
    status === 'DRAFT' || status === 'SUBMITTED' || status === 'APPROVED'
  )
}

export function isPurchaseOrderLocked(status: POStatus): boolean {
  return status === 'RECEIVED' || status === 'CANCELLED'
}

export function getNextAllowedStatuses(from: POStatus): POStatus[] {
  return PO_STATUS_TRANSITIONS[from]
}