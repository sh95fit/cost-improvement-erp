// src/features/container/services/container.service.ts — 전체 코드
import { prisma } from "@/lib/prisma";
import type {
  ContainerGroupListQuery,
  CreateContainerGroupInput,
  UpdateContainerGroupInput,
  CreateContainerSlotInput,
  UpdateContainerSlotInput,
  CreateContainerAccessoryInput,
  UpdateContainerAccessoryInput,
} from "../schemas/container.schema";

// ── 코드 자동 생성 ──
async function generateContainerGroupCode(companyId: string): Promise<string> {
  const last = await prisma.containerGroup.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  if (!last) return "CTG-001";
  const match = last.code.match(/^CTG-(\d+)$/);
  if (!match) return "CTG-001";
  const next = parseInt(match[1], 10) + 1;
  return `CTG-${String(next).padStart(3, "0")}`;
}

// ── 슬롯 인덱스 자동 채번 (1부터 시작, 기존 최대+1) ──
async function getNextSlotIndex(containerGroupId: string): Promise<number> {
  const last = await prisma.containerSlot.findFirst({
    where: { containerGroupId },
    orderBy: { slotIndex: "desc" },
    select: { slotIndex: true },
  });
  return (last?.slotIndex ?? 0) + 1;
}

// ════════════════════════════════════════
// 의존성 체크 (신규)
// ════════════════════════════════════════

export type DependencyInfo = {
  hasDependency: boolean;
  details: string[];
};

/**
 * ContainerGroup 삭제 전 의존성 확인
 * - MealTemplate에서 참조 중인지
 * - RecipeBOMSlot에서 참조 중인지
 */
export async function checkContainerGroupDependency(
  containerGroupId: string
): Promise<DependencyInfo> {
  const details: string[] = [];

  // 1. MealTemplate 참조 확인
  const mealTemplateCount = await prisma.mealTemplate.count({
    where: { containerGroupId },
  });
  if (mealTemplateCount > 0) {
    details.push(`식단 템플릿 ${mealTemplateCount}건에서 사용 중`);
  }

  // 2. RecipeBOMSlot 참조 확인
  const recipeBomSlotCount = await prisma.recipeBOMSlot.count({
    where: { containerGroupId },
  });
  if (recipeBomSlotCount > 0) {
    details.push(`레시피 BOM 슬롯 ${recipeBomSlotCount}건에서 사용 중`);
  }

  return {
    hasDependency: details.length > 0,
    details,
  };
}

/**
 * ContainerSlot 삭제 전 의존성 확인
 * - RecipeBOMSlot에서 동일 containerGroupId + slotIndex 참조 중인지
 */
export async function checkContainerSlotDependency(
  slotId: string
): Promise<DependencyInfo> {
  const details: string[] = [];

  // 슬롯 정보 조회
  const slot = await prisma.containerSlot.findUnique({
    where: { id: slotId },
    select: { containerGroupId: true, slotIndex: true },
  });

  if (!slot) {
    return { hasDependency: false, details: [] };
  }

  // RecipeBOMSlot에서 동일 containerGroupId + slotIndex 참조 확인
  const recipeBomSlotCount = await prisma.recipeBOMSlot.count({
    where: {
      containerGroupId: slot.containerGroupId,
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
// ContainerGroup
// ════════════════════════════════════════

export async function getContainerGroups(
  companyId: string,
  query: ContainerGroupListQuery
) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const where = {
    companyId,
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
    prisma.containerGroup.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        slots: {
          select: { id: true, slotIndex: true, label: true, volumeMl: true },
          orderBy: { slotIndex: "asc" },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.containerGroup.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getContainerGroupById(companyId: string, id: string) {
  const group = await prisma.containerGroup.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      slots: { orderBy: { slotIndex: "asc" } },
    },
  });
  if (!group) throw new Error("NOT_FOUND");
  return group;
}

export async function createContainerGroup(
  companyId: string,
  input: CreateContainerGroupInput
) {
  const code = await generateContainerGroupCode(companyId);
  return prisma.containerGroup.create({
    data: { ...input, companyId, code },
    include: {
      slots: { orderBy: { slotIndex: "asc" } },
    },
  });
}

export async function updateContainerGroup(
  companyId: string,
  id: string,
  input: UpdateContainerGroupInput
) {
  const group = await prisma.containerGroup.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!group) throw new Error("NOT_FOUND");
  return prisma.containerGroup.update({
    where: { id },
    data: input,
  });
}

export async function deleteContainerGroup(companyId: string, id: string) {
  const group = await prisma.containerGroup.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!group) throw new Error("NOT_FOUND");

  // ★ 의존성 체크 추가
  const dependency = await checkContainerGroupDependency(id);
  if (dependency.hasDependency) {
    throw new Error(`DEPENDENCY:${dependency.details.join(", ")}`);
  }

  return prisma.containerGroup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ════════════════════════════════════════
// ContainerSlot
// ════════════════════════════════════════

export async function addContainerSlot(
  containerGroupId: string,
  input: CreateContainerSlotInput
) {
  const nextIndex = await getNextSlotIndex(containerGroupId);
  return prisma.containerSlot.create({
    data: {
      containerGroupId,
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
  // ★ 의존성 체크 추가
  const dependency = await checkContainerSlotDependency(id);
  if (dependency.hasDependency) {
    throw new Error(`DEPENDENCY:${dependency.details.join(", ")}`);
  }

  return prisma.containerSlot.delete({ where: { id } });
}

// ════════════════════════════════════════
// ContainerAccessory (DB 무결성 유지용, UI에서는 미노출)
// ════════════════════════════════════════

export async function addContainerAccessory(
  containerGroupId: string,
  input: CreateContainerAccessoryInput
) {
  return prisma.containerAccessory.create({
    data: { ...input, containerGroupId },
  });
}

export async function updateContainerAccessory(
  id: string,
  input: UpdateContainerAccessoryInput
) {
  return prisma.containerAccessory.update({
    where: { id },
    data: input,
  });
}

export async function deleteContainerAccessory(id: string) {
  return prisma.containerAccessory.delete({ where: { id } });
}
