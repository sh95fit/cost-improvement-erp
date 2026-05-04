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
        accessories: {
          select: { id: true, name: true, description: true },
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
      accessories: true,
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
      accessories: true,
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
  return prisma.containerSlot.create({
    data: { ...input, containerGroupId },
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
  return prisma.containerSlot.delete({ where: { id } });
}

// ════════════════════════════════════════
// ContainerAccessory
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
