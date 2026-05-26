// src/features/lineup/services/lineup.service.ts
import { prisma } from "@/lib/prisma";
import type { LineupListQuery } from "../schemas/lineup.schema";

const LINEUP_SELECT = {
  id: true,
  name: true,
  code: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { locationMaps: true } },
} as const;

/**
 * 회사 소속 라인업 목록 조회 (페이지네이션)
 */
export async function getLineups(companyId: string, query: LineupListQuery) {
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
    prisma.lineup.findMany({
      where,
      select: LINEUP_SELECT,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lineup.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * 라인업 단건 조회 (locationMaps 포함)
 */
export async function getLineupById(companyId: string, id: string) {
  const lineup = await prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      locationMaps: {
        include: {
          location: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!lineup) throw new Error("NOT_FOUND");
  return lineup;
}
