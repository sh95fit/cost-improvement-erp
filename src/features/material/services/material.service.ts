import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  MaterialListQuery,
} from "../schemas/material.schema";

// ── 도메인 에러 키 ──
export const MATERIAL_ERRORS = {
  DUPLICATE_MATERIAL_NAME: "DUPLICATE_MATERIAL_NAME",
  NOT_FOUND: "NOT_FOUND",
  HAS_USAGE_HISTORY: "HAS_USAGE_HISTORY",                  // ★ M-Fix-R1 (D14-8)
  IN_USE_BY_ACTIVE_MEAL_PLAN: "IN_USE_BY_ACTIVE_MEAL_PLAN", // ★ M-Fix-R1 (D14-10)
} as const;

// ── 의존성 카운트 결과 타입 ──
export interface MaterialDependencies {
  activeSupplierItems: number;
  totalSupplierItems: number;
  materialRequirements: number;
  recipeIngredients: number;
  recipeBomSlotItems: number;
  bomItems: number;
  totalPurchaseOrderItems: number;
  activePurchaseOrderItems: number;
  totalMealPlanSlots: number;
  activeMealPlanSlots: number;
  canHardDelete: boolean;
  canDeactivate: boolean;
  blockingReasonForDelete?: string;
  blockingReasonForDeactivate?: string;
}

// ── 자재명 중복 검사 (살아있는 행만) ──
async function assertMaterialNameAvailable(
  companyId: string,
  name: string,
  excludeId?: string
): Promise<void> {
  const existing = await prisma.materialMaster.findFirst({
    where: {
      companyId,
      name,
      deletedAt: null,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(MATERIAL_ERRORS.DUPLICATE_MATERIAL_NAME);
  }
}

// ── 자재 코드 자동 생성 (MAT-001, MAT-002, ...) ──
async function generateMaterialCode(companyId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM material_masters
    WHERE company_id = ${companyId}
      AND code ~ '^MAT-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "MAT-001";

  const match = result[0].code.match(/^MAT-(\d+)$/);
  if (!match) return "MAT-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `MAT-${String(nextNumber).padStart(3, "0")}`;
}

// ── 자재 목록 조회 (페이지네이션 + 검색 + 필터) ──
export async function getMaterials(
  companyId: string,
  query: MaterialListQuery
) {
  const { page, limit, search, materialType, stockGrade, isActive, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(materialType && { materialType }),
    ...(stockGrade && { stockGrade }),
    ...(isActive !== undefined && { isActive }),   // ★ M-Fix-R1
  };

  const [items, total] = await Promise.all([
    prisma.materialMaster.findMany({
      where,
      include: {
        defaultSupplierItem: {
          include: {
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { [sortBy]: sortOrder }],   // ★ M-Fix-R1: 활성 우선
      skip,
      take: limit,
    }),
    prisma.materialMaster.count({ where }),
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

// ── 자재 단건 조회 ──
export async function getMaterialById(companyId: string, id: string) {
  return prisma.materialMaster.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      defaultSupplierItem: {
        include: {
          supplier: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

// ── 자재 코드 중복 확인 ──
export async function getMaterialByCode(companyId: string, code: string) {
  return prisma.materialMaster.findFirst({
    where: { companyId, code, deletedAt: null },
  });
}

// ── 자재 생성 (코드 자동 채번) ──
export async function createMaterial(
  companyId: string,
  input: CreateMaterialInput
) {
  await assertMaterialNameAvailable(companyId, input.name);

  const code = await generateMaterialCode(companyId);
  return prisma.materialMaster.create({
    data: {
      ...input,
      companyId,
      code,
    },
  });
}

// ── 자재 수정 ──
export async function updateMaterial(
  companyId: string,
  id: string,
  input: UpdateMaterialInput
) {
  if (input.name) {
    await assertMaterialNameAvailable(companyId, input.name, id);
  }
  return prisma.materialMaster.update({
    where: { id },
    data: input,
  });
}

// ── 의존성 조회 (D14-9) ──
export async function getMaterialDependencies(
  companyId: string,
  id: string
): Promise<MaterialDependencies | null> {
  const material = await prisma.materialMaster.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!material) return null;

  const [
    activeSupplierItems,
    totalSupplierItems,
    materialRequirements,
    recipeIngredients,
    recipeBomSlotItems,
    bomItems,
    totalPOItems,
    activePOItems,
    totalMealPlanSlots,
    activeMealPlanSlots,
  ] = await Promise.all([
    prisma.supplierItem.count({
      where: { materialMasterId: id, deletedAt: null, isActive: true },
    }),
    prisma.supplierItem.count({
      where: { materialMasterId: id, deletedAt: null },
    }),
    prisma.materialRequirement.count({
      where: { materialMasterId: id, deletedAt: null },
    }),
    prisma.recipeIngredient.count({ where: { materialMasterId: id } }),
    prisma.recipeBOMSlotItem.count({ where: { materialMasterId: id } }),
    prisma.bOMItem.count({ where: { materialMasterId: id } }),
    prisma.purchaseOrderItem.count({ where: { materialMasterId: id } }),
    prisma.purchaseOrderItem.count({
      where: {
        materialMasterId: id,
        purchaseOrder: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
      },
    }),
    prisma.mealPlanSlot.count({
      where: { supplierItem: { materialMasterId: id } },
    }),
    prisma.mealPlanSlot.count({
      where: {
        supplierItem: { materialMasterId: id },
        mealPlan: {
          mealPlanGroup: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
        },
      },
    }),
  ]);

  const hasAnyUsage =
    totalSupplierItems > 0 ||
    materialRequirements > 0 ||
    recipeIngredients > 0 ||
    recipeBomSlotItems > 0 ||
    bomItems > 0 ||
    totalPOItems > 0;

  const canHardDelete = !hasAnyUsage;
  const blockingReasonForDelete = canHardDelete
    ? undefined
    : `사용 이력이 있어 삭제할 수 없습니다 (공급품목 ${totalSupplierItems} · MR ${materialRequirements} · 레시피 ${recipeIngredients + recipeBomSlotItems} · BOM ${bomItems} · PO ${totalPOItems}). '비활성화'를 사용해주세요.`;

  const canDeactivate = activeMealPlanSlots === 0 && activePOItems === 0;
  const blockingReasonForDeactivate = canDeactivate
    ? undefined
    : `진행 중인 식단 ${activeMealPlanSlots}건 / 진행 중인 발주 ${activePOItems}건에 사용 중입니다.`;

  return {
    activeSupplierItems,
    totalSupplierItems,
    materialRequirements,
    recipeIngredients,
    recipeBomSlotItems,
    bomItems,
    totalPurchaseOrderItems: totalPOItems,
    activePurchaseOrderItems: activePOItems,
    totalMealPlanSlots,
    activeMealPlanSlots,
    canHardDelete,
    canDeactivate,
    blockingReasonForDelete,
    blockingReasonForDeactivate,
  };
}

// ── 활성/비활성 토글 (D14-10) ──
export async function setMaterialActive(
  companyId: string,
  id: string,
  isActive: boolean
) {
  return withTransaction(async (tx) => {
    const existing = await tx.materialMaster.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) return null;

    if (!isActive) {
      const [activeSlots, activePOs] = await Promise.all([
        tx.mealPlanSlot.count({
          where: {
            supplierItem: { materialMasterId: id },
            mealPlan: {
              mealPlanGroup: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
            },
          },
        }),
        tx.purchaseOrderItem.count({
          where: {
            materialMasterId: id,
            purchaseOrder: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
          },
        }),
      ]);
      if (activeSlots > 0 || activePOs > 0) {
        throw new Error(MATERIAL_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);
      }
      // 산하 SupplierItem 자동 비활성화 (재활성화는 수동)
      await tx.supplierItem.updateMany({
        where: { materialMasterId: id, deletedAt: null, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.materialMaster.update({
      where: { id },
      data: { isActive },
    });
  });
}

// ── 자재 삭제 (의존성 0건일 때만 soft-delete, 아니면 HAS_USAGE_HISTORY) ──
export async function deleteMaterial(companyId: string, id: string) {
  return withTransaction(async (tx) => {
    const material = await tx.materialMaster.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!material) return null;

    const [si, mr, ri, rbsi, bi, po] = await Promise.all([
      tx.supplierItem.count({ where: { materialMasterId: id, deletedAt: null } }),
      tx.materialRequirement.count({ where: { materialMasterId: id, deletedAt: null } }),
      tx.recipeIngredient.count({ where: { materialMasterId: id } }),
      tx.recipeBOMSlotItem.count({ where: { materialMasterId: id } }),
      tx.bOMItem.count({ where: { materialMasterId: id } }),
      tx.purchaseOrderItem.count({ where: { materialMasterId: id } }),
    ]);

    if (si + mr + ri + rbsi + bi + po > 0) {
      throw new Error(MATERIAL_ERRORS.HAS_USAGE_HISTORY);
    }

    return tx.materialMaster.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  });
}

// ── 기본 공급 품목 설정 ──
export async function setDefaultSupplierItem(
  companyId: string,
  materialId: string,
  supplierItemId: string | null
) {
  const material = await prisma.materialMaster.findFirst({
    where: { id: materialId, companyId, deletedAt: null },
  });
  if (!material) throw new Error(MATERIAL_ERRORS.NOT_FOUND);

  return prisma.materialMaster.update({
    where: { id: materialId },
    data: { defaultSupplierItemId: supplierItemId },
  });
}