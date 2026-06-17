import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateSupplierItemInput,
  UpdateSupplierItemInput,
} from "../schemas/supplier.schema";

// ── 도메인 에러 키 (S-Fix) ──
export const SUPPLIER_ITEM_ERRORS = {
  NOT_FOUND: "NOT_FOUND",
  HAS_USAGE_HISTORY: "HAS_USAGE_HISTORY",
  IS_DEFAULT_SUPPLIER_ITEM: "IS_DEFAULT_SUPPLIER_ITEM",
  IN_USE_BY_ACTIVE_MEAL_PLAN: "IN_USE_BY_ACTIVE_MEAL_PLAN",
} as const;

// ── 의존성 카운트 결과 타입 ──
export interface SupplierItemDependencies {
  defaultForMaterial: { id: string; name: string; code: string } | null;
  defaultForSubsidiary: { id: string; name: string; code: string } | null;
  totalPurchaseOrderItems: number;
  activePurchaseOrderItems: number;
  totalMealPlanSlots: number;
  activeMealPlanSlots: number;
  priceHistoryCount: number;
  canHardDelete: boolean;
  canDeactivate: boolean;
  blockingReasonForDelete?: string;
  blockingReasonForDeactivate?: string;
}

// ── 의존성 조회 (사전 확인용) ──
export async function getSupplierItemDependencies(
  id: string
): Promise<SupplierItemDependencies | null> {
  const item = await prisma.supplierItem.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!item) return null;

  const [
    defaultMaterial,
    defaultSubsidiary,
    totalPOItems,
    activePOItems,
    totalMealPlanSlots,
    activeMealPlanSlots,
    priceHistoryCount,
  ] = await Promise.all([
    prisma.materialMaster.findFirst({
      where: { defaultSupplierItemId: id, deletedAt: null },
      select: { id: true, name: true, code: true },
    }),
    prisma.subsidiaryMaster.findFirst({
      where: { defaultSupplierItemId: id, deletedAt: null },
      select: { id: true, name: true, code: true },
    }),
    prisma.purchaseOrderItem.count({ where: { supplierItemId: id } }),
    prisma.purchaseOrderItem.count({
      where: {
        supplierItemId: id,
        purchaseOrder: {
          status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] },
        },
      },
    }),
    prisma.mealPlanSlot.count({ where: { supplierItemId: id } }),
    prisma.mealPlanSlot.count({
      where: {
        supplierItemId: id,
        mealPlan: {
          mealPlanGroup: {
            status: { in: ["CONFIRMED", "IN_PROGRESS"] },
          },
        },
      },
    }),
    prisma.supplierItemPriceHistory.count({ where: { supplierItemId: id } }),
  ]);

  // hard-delete 가능 여부: 모든 외부 참조 0건
  const hasUsageHistory = totalPOItems > 0 || totalMealPlanSlots > 0;
  const isDefaultMapped = !!defaultMaterial || !!defaultSubsidiary;
  const canHardDelete = !hasUsageHistory && !isDefaultMapped;
  const blockingReasonForDelete = canHardDelete
    ? undefined
    : hasUsageHistory
      ? `발주·식단 사용 이력이 있어 삭제할 수 없습니다 (PO ${totalPOItems}건 / 식단 ${totalMealPlanSlots}건). '비활성화'를 사용해주세요.`
      : `기본 공급처로 지정되어 있어 삭제할 수 없습니다. 먼저 기본 공급처 매핑을 해제해주세요.`;

  // 비활성화 가능 여부: 활성 MealPlan 사용 안 함
  const canDeactivate = activeMealPlanSlots === 0;
  const blockingReasonForDeactivate = canDeactivate
    ? undefined
    : `진행 중인 식단 ${activeMealPlanSlots}건에 사용 중입니다. 식단을 먼저 변경해주세요.`;

  return {
    defaultForMaterial: defaultMaterial,
    defaultForSubsidiary: defaultSubsidiary,
    totalPurchaseOrderItems: totalPOItems,
    activePurchaseOrderItems: activePOItems,
    totalMealPlanSlots,
    activeMealPlanSlots,
    priceHistoryCount,
    canHardDelete,
    canDeactivate,
    blockingReasonForDelete,
    blockingReasonForDeactivate,
  };
}

// ── 공급 품목 목록 조회 (업체별 — 비활성 포함, soft-delete 제외) ──
export async function getSupplierItems(supplierId: string) {
  return prisma.supplierItem.findMany({
    where: { supplierId, deletedAt: null },  // ★ S-Fix
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
      supplyUnit: { select: { id: true, code: true, name: true, unitCategory: true } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],  // 활성 우선
  });
}

// ── 단건 조회 (관리 화면 — 비활성 포함, soft-delete 제외) ──
export async function getSupplierItemById(id: string) {
  return prisma.supplierItem.findFirst({
    where: { id, deletedAt: null },  // ★ S-Fix
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
      supplyUnit: { select: { id: true, code: true, name: true, unitCategory: true } },
    },
  });
}

// ── 중복 확인 (deletedAt 제외, isActive 무관) ──
export async function findDuplicateSupplierItem(
  supplierId: string,
  itemType: string,
  productName: string,
  materialMasterId?: string,
  subsidiaryMasterId?: string
) {
  return prisma.supplierItem.findFirst({
    where: {
      supplierId,
      itemType: itemType as "MATERIAL" | "SUBSIDIARY",
      productName,
      deletedAt: null,  // ★ S-Fix
      ...(itemType === "MATERIAL" && { materialMasterId }),
      ...(itemType === "SUBSIDIARY" && { subsidiaryMasterId }),
    },
  });
}

// ── 자재별 공급 품목 조회 (위저드/자동완성 — 활성만) ──
export async function getSupplierItemsByMaterialId(materialMasterId: string) {
  return prisma.supplierItem.findMany({
    where: {
      materialMasterId,
      itemType: "MATERIAL",
      deletedAt: null,
      isActive: true,                       // ★ S-Fix: 활성만
      supplier: { deletedAt: null },
    },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      supplyUnit: { select: { id: true, code: true, name: true, unitCategory: true } },
    },
    orderBy: { currentPrice: "asc" },
  });
}

// ── 부자재별 공급 품목 조회 (위저드/자동완성 — 활성만) ──
export async function getSupplierItemsBySubsidiaryId(subsidiaryMasterId: string) {
  return prisma.supplierItem.findMany({
    where: {
      subsidiaryMasterId,
      itemType: "SUBSIDIARY",
      deletedAt: null,
      isActive: true,                       // ★ S-Fix
      supplier: { deletedAt: null },
    },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      supplyUnit: { select: { id: true, code: true, name: true, unitCategory: true } },
    },
    orderBy: { currentPrice: "asc" },
  });
}

// ── 생성 (기존 그대로) ──
export async function createSupplierItem(
  supplierId: string,
  input: CreateSupplierItemInput
) {
  return withTransaction(async (tx) => {
    const item = await tx.supplierItem.create({
      data: {
        supplierId,
        itemType: input.itemType,
        materialMasterId: input.materialMasterId ?? null,
        subsidiaryMasterId: input.subsidiaryMasterId ?? null,
        productName: input.productName,
        spec: input.spec ?? null,
        supplyUnitId: input.supplyUnitId,
        supplyUnitQty: input.supplyUnitQty,
        currentPrice: input.currentPrice,
        leadTimeDays: input.leadTimeDays ?? 0,
      },
    });
    await tx.supplierItemPriceHistory.create({
      data: {
        supplierItemId: item.id,
        price: input.currentPrice,
        effectiveFrom: new Date(),
      },
    });
    return item;
  });
}

// ── 수정 (기존 그대로) ──
export async function updateSupplierItem(
  id: string,
  input: UpdateSupplierItemInput
) {
  return withTransaction(async (tx) => {
    const existing = await tx.supplierItem.findUniqueOrThrow({ where: { id } });
    const item = await tx.supplierItem.update({ where: { id }, data: input });
    if (input.currentPrice != null && input.currentPrice !== existing.currentPrice) {
      await tx.supplierItemPriceHistory.create({
        data: {
          supplierItemId: id,
          price: input.currentPrice,
          effectiveFrom: new Date(),
        },
      });
    }
    return item;
  });
}

// ── 활성/비활성 토글 (S-Fix 신규) ──
export async function setSupplierItemActive(id: string, isActive: boolean) {
  return withTransaction(async (tx) => {
    const existing = await tx.supplierItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return null;

    // 비활성화 시 활성 식단 사용 여부 차단
    if (!isActive) {
      const activeMealPlanSlots = await tx.mealPlanSlot.count({
        where: {
          supplierItemId: id,
          mealPlan: {
            mealPlanGroup: {
              status: { in: ["CONFIRMED", "IN_PROGRESS"] },
            },
          },
        },
      });
      if (activeMealPlanSlots > 0) {
        throw new Error(SUPPLIER_ITEM_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);
      }
      // 기본 공급처 자동 해제
      await tx.materialMaster.updateMany({
        where: { defaultSupplierItemId: id },
        data: { defaultSupplierItemId: null },
      });
      await tx.subsidiaryMaster.updateMany({
        where: { defaultSupplierItemId: id },
        data: { defaultSupplierItemId: null },
      });
    }

    return tx.supplierItem.update({
      where: { id },
      data: { isActive },
    });
  });
}

// ── 삭제 (의존성 0건일 때만 hard-delete) ──
export async function deleteSupplierItem(id: string) {
  return withTransaction(async (tx) => {
    const item = await tx.supplierItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) return null;

    const [poCount, mealPlanCount, defaultMaterial, defaultSubsidiary] =
      await Promise.all([
        tx.purchaseOrderItem.count({ where: { supplierItemId: id } }),
        tx.mealPlanSlot.count({ where: { supplierItemId: id } }),
        tx.materialMaster.findFirst({
          where: { defaultSupplierItemId: id },
          select: { id: true },
        }),
        tx.subsidiaryMaster.findFirst({
          where: { defaultSupplierItemId: id },
          select: { id: true },
        }),
      ]);

    if (poCount > 0 || mealPlanCount > 0) {
      throw new Error(SUPPLIER_ITEM_ERRORS.HAS_USAGE_HISTORY);
    }
    if (defaultMaterial || defaultSubsidiary) {
      throw new Error(SUPPLIER_ITEM_ERRORS.IS_DEFAULT_SUPPLIER_ITEM);
    }

    // 부속 PriceHistory 정리 후 본체 hard-delete
    await tx.supplierItemPriceHistory.deleteMany({
      where: { supplierItemId: id },
    });
    return tx.supplierItem.delete({ where: { id } });
  });
}

// ── 가격 이력 조회 (기존 그대로) ──
export async function getPriceHistory(supplierItemId: string) {
  return prisma.supplierItemPriceHistory.findMany({
    where: { supplierItemId },
    orderBy: { effectiveFrom: "desc" },
    take: 20,
  });
}