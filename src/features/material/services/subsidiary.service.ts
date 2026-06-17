import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateSubsidiaryInput,
  UpdateSubsidiaryInput,
  SubsidiaryListQuery,
} from "../schemas/material.schema";
import type { SubsidiaryType } from "@prisma/client";

// ── 도메인 에러 키 ──
export const SUBSIDIARY_ERRORS = {
  DUPLICATE_SUBSIDIARY_NAME: "DUPLICATE_SUBSIDIARY_NAME",
  NOT_FOUND: "NOT_FOUND",
  HAS_USAGE_HISTORY: "HAS_USAGE_HISTORY",                   // ★ M-Fix-R1 (D14-8)
  IN_USE_BY_ACTIVE_MEAL_PLAN: "IN_USE_BY_ACTIVE_MEAL_PLAN", // ★ M-Fix-R1 (D14-10)
} as const;

export interface SubsidiaryDependencies {
  activeSupplierItems: number;
  totalSupplierItems: number;
  mealPlanAccessories: number;
  mealPlanSlots: number;
  activeMealPlanSlots: number;
  containerSlots: number;
  mealTemplateContainers: number;
  mealTemplateAccessories: number;
  recipeBomSlots: number;
  totalPurchaseOrderItems: number;
  activePurchaseOrderItems: number;
  canHardDelete: boolean;
  canDeactivate: boolean;
  blockingReasonForDelete?: string;
  blockingReasonForDeactivate?: string;
}

// ── 부자재명 중복 검사 (살아있는 행만) ──
async function assertSubsidiaryNameAvailable(
  companyId: string,
  name: string,
  excludeId?: string
): Promise<void> {
  const existing = await prisma.subsidiaryMaster.findFirst({
    where: {
      companyId,
      name,
      deletedAt: null,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(SUBSIDIARY_ERRORS.DUPLICATE_SUBSIDIARY_NAME);
  }
}

// ── 부자재 코드 자동 생성 ──
async function generateSubsidiaryCode(companyId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM subsidiary_masters
    WHERE company_id = ${companyId}
      AND code ~ '^SUB-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "SUB-001";

  const match = result[0].code.match(/^SUB-(\d+)$/);
  if (!match) return "SUB-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `SUB-${String(nextNumber).padStart(3, "0")}`;
}

// ── 부자재 목록 조회 ──
export async function getSubsidiaries(
  companyId: string,
  query: SubsidiaryListQuery
) {
  const { page, limit, search, subsidiaryType, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    deletedAt: null,
    ...(subsidiaryType && { subsidiaryType }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.subsidiaryMaster.findMany({
      where,
      include: {
        defaultSupplierItem: {
          include: {
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { [sortBy]: sortOrder }],  // ★ M-Fix-R1
      skip,
      take: limit,
    }),
    prisma.subsidiaryMaster.count({ where }),
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

// ── 유형별 부자재 옵션 조회 ──
export async function getSubsidiariesByType(
  companyId: string,
  subsidiaryType: SubsidiaryType
) {
  return prisma.subsidiaryMaster.findMany({
    where: { companyId, deletedAt: null, subsidiaryType, isActive: true },  // ★ 활성만
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

// ── 부자재 단건 조회 ──
export async function getSubsidiaryById(companyId: string, id: string) {
  return prisma.subsidiaryMaster.findFirst({
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

// ── 부자재 코드 중복 확인 ──
export async function getSubsidiaryByCode(companyId: string, code: string) {
  return prisma.subsidiaryMaster.findFirst({
    where: { companyId, code, deletedAt: null },
  });
}

// ── 부자재 생성 ──
export async function createSubsidiary(
  companyId: string,
  input: CreateSubsidiaryInput
) {
  await assertSubsidiaryNameAvailable(companyId, input.name);  // ★ M-Fix

  const code = await generateSubsidiaryCode(companyId);

  return prisma.subsidiaryMaster.create({
    data: {
      ...input,
      companyId,
      code,
    },
  });
}

// ── 부자재 수정 ──
export async function updateSubsidiary(
  companyId: string,
  id: string,
  input: UpdateSubsidiaryInput
) {
  if (input.name) {
    await assertSubsidiaryNameAvailable(companyId, input.name, id);  // ★ M-Fix
  }
  return prisma.subsidiaryMaster.update({
    where: { id },
    data: input,
  });
}

// ── 의존성 조회 (D14-9) ──
export async function getSubsidiaryDependencies(
  companyId: string,
  id: string
): Promise<SubsidiaryDependencies | null> {
  const subsidiary = await prisma.subsidiaryMaster.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!subsidiary) return null;

  const [
    activeSupplierItems,
    totalSupplierItems,
    mealPlanAccessories,
    mealPlanSlots,
    activeMealPlanSlots,
    containerSlots,
    mealTemplateContainers,
    mealTemplateAccessories,
    recipeBomSlots,
    totalPOItems,
    activePOItems,
  ] = await Promise.all([
    prisma.supplierItem.count({
      where: { subsidiaryMasterId: id, deletedAt: null, isActive: true },
    }),
    prisma.supplierItem.count({
      where: { subsidiaryMasterId: id, deletedAt: null },
    }),
    prisma.mealPlanAccessory.count({ where: { subsidiaryMasterId: id } }),
    prisma.mealPlanSlot.count({ where: { subsidiaryMasterId: id } }),
    prisma.mealPlanSlot.count({
      where: {
        subsidiaryMasterId: id,
        mealPlan: {
          mealPlanGroup: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
        },
      },
    }),
    prisma.containerSlot.count({ where: { subsidiaryMasterId: id } }),
    prisma.mealTemplateContainer.count({ where: { subsidiaryMasterId: id } }),
    prisma.mealTemplateAccessory.count({ where: { subsidiaryMasterId: id } }),
    prisma.recipeBOMSlot.count({ where: { subsidiaryMasterId: id } }),
    prisma.purchaseOrderItem.count({ where: { subsidiaryMasterId: id } }),
    prisma.purchaseOrderItem.count({
      where: {
        subsidiaryMasterId: id,
        purchaseOrder: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
      },
    }),
  ]);

  const hasAnyUsage =
    totalSupplierItems > 0 ||
    mealPlanAccessories > 0 ||
    mealPlanSlots > 0 ||
    containerSlots > 0 ||
    mealTemplateContainers > 0 ||
    mealTemplateAccessories > 0 ||
    recipeBomSlots > 0 ||
    totalPOItems > 0;

  const canHardDelete = !hasAnyUsage;
  const blockingReasonForDelete = canHardDelete
    ? undefined
    : `사용 이력이 있어 삭제할 수 없습니다 (공급품목 ${totalSupplierItems} · 식단 ${mealPlanSlots + mealPlanAccessories} · 용기/템플릿 ${containerSlots + mealTemplateContainers + mealTemplateAccessories} · 레시피 ${recipeBomSlots} · PO ${totalPOItems}). '비활성화'를 사용해주세요.`;

  const canDeactivate = activeMealPlanSlots === 0 && activePOItems === 0;
  const blockingReasonForDeactivate = canDeactivate
    ? undefined
    : `진행 중인 식단 ${activeMealPlanSlots}건 / 진행 중인 발주 ${activePOItems}건에 사용 중입니다.`;

  return {
    activeSupplierItems,
    totalSupplierItems,
    mealPlanAccessories,
    mealPlanSlots,
    activeMealPlanSlots,
    containerSlots,
    mealTemplateContainers,
    mealTemplateAccessories,
    recipeBomSlots,
    totalPurchaseOrderItems: totalPOItems,
    activePurchaseOrderItems: activePOItems,
    canHardDelete,
    canDeactivate,
    blockingReasonForDelete,
    blockingReasonForDeactivate,
  };
}

// ── 활성/비활성 토글 (D14-10) ──
export async function setSubsidiaryActive(
  companyId: string,
  id: string,
  isActive: boolean
) {
  return withTransaction(async (tx) => {
    const existing = await tx.subsidiaryMaster.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) return null;

    if (!isActive) {
      const [activeSlots, activePOs] = await Promise.all([
        tx.mealPlanSlot.count({
          where: {
            subsidiaryMasterId: id,
            mealPlan: {
              mealPlanGroup: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
            },
          },
        }),
        tx.purchaseOrderItem.count({
          where: {
            subsidiaryMasterId: id,
            purchaseOrder: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
          },
        }),
      ]);
      if (activeSlots > 0 || activePOs > 0) {
        throw new Error(SUBSIDIARY_ERRORS.IN_USE_BY_ACTIVE_MEAL_PLAN);
      }
      await tx.supplierItem.updateMany({
        where: { subsidiaryMasterId: id, deletedAt: null, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.subsidiaryMaster.update({
      where: { id },
      data: { isActive },
    });
  });
}

// ── 부자재 삭제 (의존성 0건일 때만 soft-delete) ──
export async function deleteSubsidiary(companyId: string, id: string) {
  return withTransaction(async (tx) => {
    const subsidiary = await tx.subsidiaryMaster.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!subsidiary) return null;

    const [si, mpa, mps, cs, mtc, mta, rbs, po] = await Promise.all([
      tx.supplierItem.count({ where: { subsidiaryMasterId: id, deletedAt: null } }),
      tx.mealPlanAccessory.count({ where: { subsidiaryMasterId: id } }),
      tx.mealPlanSlot.count({ where: { subsidiaryMasterId: id } }),
      tx.containerSlot.count({ where: { subsidiaryMasterId: id } }),
      tx.mealTemplateContainer.count({ where: { subsidiaryMasterId: id } }),
      tx.mealTemplateAccessory.count({ where: { subsidiaryMasterId: id } }),
      tx.recipeBOMSlot.count({ where: { subsidiaryMasterId: id } }),
      tx.purchaseOrderItem.count({ where: { subsidiaryMasterId: id } }),
    ]);

    if (si + mpa + mps + cs + mtc + mta + rbs + po > 0) {
      throw new Error(SUBSIDIARY_ERRORS.HAS_USAGE_HISTORY);
    }

    return tx.subsidiaryMaster.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  });
}

// ── 기본 공급 품목 설정 ──
export async function setDefaultSupplierItem(
  companyId: string,
  subsidiaryId: string,
  supplierItemId: string | null
) {
  const subsidiary = await prisma.subsidiaryMaster.findFirst({
    where: { id: subsidiaryId, companyId, deletedAt: null },
  });
  if (!subsidiary) throw new Error(SUBSIDIARY_ERRORS.NOT_FOUND);

  return prisma.subsidiaryMaster.update({
    where: { id: subsidiaryId },
    data: { defaultSupplierItemId: supplierItemId },
  });
}
