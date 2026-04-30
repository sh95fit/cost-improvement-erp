import { prisma } from "@/lib/prisma";

export async function getContainerGroups(
  companyId: string,
  query: { page: number; limit: number; search?: string; sortBy: string; sortOrder: string }
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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
