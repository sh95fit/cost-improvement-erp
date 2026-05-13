// src/features/container/services/container.service.ts
import { prisma } from "@/lib/prisma";
import type {
  CreateContainerSlotInput,
  UpdateContainerSlotInput,
} from "../schemas/container.schema";

// ── 슬롯 인덱스 자동 채번 (1부터 시작, 기존 최대+1) ──
async function getNextSlotIndex(subsidiaryMasterId: string): Promise<number> {
  const last = await prisma.containerSlot.findFirst({
    where: { subsidiaryMasterId },
    orderBy: { slotIndex: "desc" },
    select: { slotIndex: true },
  });
  return (last?.slotIndex ?? 0) + 1;
}

// ════════════════════════════════════════
// 의존성 체크
// ════════════════════════════════════════

export type DependencyInfo = {
  hasDependency: boolean;
  details: string[];
};

/**
 * 용기(SubsidiaryMaster) 삭제 전 의존성 확인
 * - MealTemplateContainer에서 참조 중인지
 * - RecipeBOMSlot에서 참조 중인지
 * - ContainerSlot이 존재하는지
 */
export async function checkContainerDependency(
  subsidiaryMasterId: string
): Promise<DependencyInfo> {
  const details: string[] = [];

  // 1. MealTemplateContainer 참조 확인
  const mealTemplateContainerCount = await prisma.mealTemplateContainer.count({
    where: { subsidiaryMasterId },
  });
  if (mealTemplateContainerCount > 0) {
    details.push(`식단 템플릿 ${mealTemplateContainerCount}건에서 사용 중`);
  }

  // 2. RecipeBOMSlot 참조 확인
  const recipeBomSlotCount = await prisma.recipeBOMSlot.count({
    where: { subsidiaryMasterId },
  });
  if (recipeBomSlotCount > 0) {
    details.push(`레시피 BOM 슬롯 ${recipeBomSlotCount}건에서 사용 중`);
  }

  // 3. ContainerSlot 존재 확인
  const slotCount = await prisma.containerSlot.count({
    where: { subsidiaryMasterId },
  });
  if (slotCount > 0) {
    details.push(`컨테이너 슬롯 ${slotCount}건이 등록되어 있음`);
  }

  return {
    hasDependency: details.length > 0,
    details,
  };
}

/**
 * ContainerSlot 삭제 전 의존성 확인
 * - RecipeBOMSlot에서 동일 subsidiaryMasterId + slotIndex 참조 중인지
 */
export async function checkContainerSlotDependency(
  slotId: string
): Promise<DependencyInfo> {
  const details: string[] = [];

  const slot = await prisma.containerSlot.findUnique({
    where: { id: slotId },
    select: { subsidiaryMasterId: true, slotIndex: true },
  });

  if (!slot) {
    return { hasDependency: false, details: [] };
  }

  const recipeBomSlotCount = await prisma.recipeBOMSlot.count({
    where: {
      subsidiaryMasterId: slot.subsidiaryMasterId,
      slotIndex: slot.slotIndex,
    },
  });
  if (recipeBomSlotCount > 0) {
    details.push(`레시피 BOM 슬롯 ${recipeBomSlotCount}건에서 사용 중`);
  }

  return {
    hasDependency: details.length > 0,
    details,
  };
}

// ════════════════════════════════════════
// 용기(SubsidiaryMaster type=CONTAINER) 조회
// ════════════════════════════════════════

/**
 * CONTAINER 타입 부자재 목록 조회 (containers 페이지용)
 */
export async function getContainerSubsidiaries(
  companyId: string,
  query: { page: number; limit: number; search?: string; sortBy: string; sortOrder: string }
) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const where = {
    companyId,
    subsidiaryType: "CONTAINER" as const,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.subsidiaryMaster.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        containerSlots: {
          select: { id: true, slotIndex: true, label: true, volumeMl: true },
          orderBy: { slotIndex: "asc" },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subsidiaryMaster.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      slots: item.containerSlots, // UI 호환 alias
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * 용기 단건 조회 (슬롯 포함)
 */
export async function getContainerSubsidiaryById(companyId: string, id: string) {
  const sub = await prisma.subsidiaryMaster.findFirst({
    where: { id, companyId, subsidiaryType: "CONTAINER", deletedAt: null },
    include: {
      containerSlots: { orderBy: { slotIndex: "asc" } },
    },
  });
  if (!sub) throw new Error("NOT_FOUND");
  return {
    ...sub,
    slots: sub.containerSlots, // UI 호환 alias
  };
}

// ════════════════════════════════════════
// ContainerSlot CRUD
// ════════════════════════════════════════

export async function getSlotsBySubsidiaryId(subsidiaryMasterId: string) {
  return prisma.containerSlot.findMany({
    where: { subsidiaryMasterId },
    orderBy: { slotIndex: "asc" },
  });
}

export async function addContainerSlot(
  subsidiaryMasterId: string,
  input: CreateContainerSlotInput
) {
  const nextIndex = await getNextSlotIndex(subsidiaryMasterId);
  return prisma.containerSlot.create({
    data: {
      subsidiaryMasterId,
      slotIndex: nextIndex,
      label: input.label,
      volumeMl: input.volumeMl ?? null,
    },
  });
}

export async function updateContainerSlot(
  id: string,
  input: UpdateContainerSlotInput
) {
  return prisma.containerSlot.update({
    where: { id },
    data: input,
  });
}

export async function deleteContainerSlot(id: string) {
  const dependency = await checkContainerSlotDependency(id);
  if (dependency.hasDependency) {
    throw new Error(`DEPENDENCY:${dependency.details.join(", ")}`);
  }
  return prisma.containerSlot.delete({ where: { id } });
}
