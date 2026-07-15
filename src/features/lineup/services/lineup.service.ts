// src/features/lineup/services/lineup.service.ts
import { prisma } from "@/lib/prisma";
import type {
  CreateLineupInput,
  UpdateLineupInput,
  LineupListQuery,
  // SyncLineupLocationsInput,  // ⚠️ 주석 처리
} from "../schemas/lineup.schema";

// ============================================================
// 공통 select 정의
// ============================================================

const LINEUP_LIST_SELECT = {
  id: true,
  name: true,
  code: true,
  isActive: true,
  sortOrder: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================================
// 코드 자동 채번 (LINE-001, LINE-002, ...)
// ============================================================

async function generateLineupCode(companyId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM lineups
    WHERE company_id = ${companyId}
      AND code ~ '^LINE-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "LINE-001";

  const match = result[0].code.match(/^LINE-(\d+)$/);
  if (!match) return "LINE-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `LINE-${String(nextNumber).padStart(3, "0")}`;
}

// ============================================================
// Lineup CRUD
// ============================================================

export async function getLineups(companyId: string, query: LineupListQuery) {
  const { page, limit, search, sortBy, sortOrder, isActive } = query;

  const where = {
    companyId,
    deletedAt: null,
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // sortBy=sortOrder일 때 name asc를 보조 정렬로 사용해 결정적 정렬 보장
  const orderBy =
    sortBy === "sortOrder"
      ? [{ sortOrder: sortOrder }, { name: "asc" as const }]
      : [{ [sortBy]: sortOrder }];

  const [items, total] = await Promise.all([
    prisma.lineup.findMany({
      where,
      select: LINEUP_LIST_SELECT,
      orderBy,
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

export async function getLineupById(companyId: string, id: string) {
  return prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
  });
}

export async function createLineup(
  companyId: string,
  input: CreateLineupInput
) {
  const code = await generateLineupCode(companyId);
  return prisma.lineup.create({
    data: {
      companyId,
      name: input.name,
      code,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      description: input.description ?? null,
    },
  });
}

export async function updateLineup(
  companyId: string,
  id: string,
  input: UpdateLineupInput
) {
  const existing = await prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.lineup.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
  });
}

// ============================================================
// 라인업 삭제 (soft) — 의존성 체크 포함
// ============================================================

export type LineupDependencyCheck = {
  canDelete: boolean;
  reasons: string[];
  counts: {
    mealPlans: number;
    mealCounts: number;
  };
};

export async function checkLineupDependencies(
  companyId: string,
  id: string
): Promise<LineupDependencyCheck> {
  const lineup = await prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!lineup) throw new Error("NOT_FOUND");

  const [mealPlans, mealCounts] = await Promise.all([
    prisma.mealPlan.count({
      where: { lineupId: id, deletedAt: null },
    }),
    prisma.mealCount.count({
      where: { lineupId: id, deletedAt: null },
    }),
  ]);

  const reasons: string[] = [];
  if (mealPlans > 0)
    reasons.push(`식단 ${mealPlans}건이 이 라인업을 사용 중입니다`);
  if (mealCounts > 0)
    reasons.push(`식수 ${mealCounts}건이 이 라인업을 사용 중입니다`);

  return {
    canDelete: reasons.length === 0,
    reasons,
    counts: { mealPlans, mealCounts },
  };
}

/**
 * 라인업 삭제 (soft-delete)
 *  - locationMaps 처리는 LineupLocationMap 배제로 제거
 *  - templateMaps만 soft delete
 */
export async function deleteLineup(companyId: string, id: string) {
  const check = await checkLineupDependencies(companyId, id);
  if (!check.canDelete) throw new Error("DEPENDENCY_EXISTS");

  return prisma.lineup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ============================================================
// LineupLocationMap 관련 함수 — 현재 비즈니스 모델상 쓰임이 명확하지 않아 배제
// 향후 명확한 쓰임이 정의되면 주석 해제하여 복원.
// ============================================================

// export async function syncLineupLocations(
//   companyId: string,
//   lineupId: string,
//   input: SyncLineupLocationsInput
// ) {
//   const lineup = await prisma.lineup.findFirst({
//     where: { id: lineupId, companyId, deletedAt: null },
//     select: { id: true },
//   });
//   if (!lineup) throw new Error("NOT_FOUND");
//
//   const uniqueLocationIds = Array.from(new Set(input.locationIds));
//   if (uniqueLocationIds.length > 0) {
//     const validLocations = await prisma.location.findMany({
//       where: {
//         id: { in: uniqueLocationIds },
//         companyId,
//         deletedAt: null,
//       },
//       select: { id: true },
//     });
//     if (validLocations.length !== uniqueLocationIds.length) {
//       throw new Error("INVALID_LOCATION");
//     }
//   }
//
//   return prisma.$transaction(async (tx) => {
//     const existing = await tx.lineupLocationMap.findMany({
//       where: { lineupId },
//       select: { id: true, locationId: true },
//     });
//     const existingSet = new Set(existing.map((m) => m.locationId));
//     const desiredSet = new Set(uniqueLocationIds);
//
//     const toRemove = existing
//       .filter((m) => !desiredSet.has(m.locationId))
//       .map((m) => m.id);
//     const toAdd = uniqueLocationIds.filter((id) => !existingSet.has(id));
//
//     if (toRemove.length > 0) {
//       await tx.lineupLocationMap.deleteMany({
//         where: { id: { in: toRemove } },
//       });
//     }
//     if (toAdd.length > 0) {
//       await tx.lineupLocationMap.createMany({
//         data: toAdd.map((locationId) => ({ lineupId, locationId })),
//       });
//     }
//
//     return tx.lineupLocationMap.findMany({
//       where: { lineupId },
//       include: {
//         location: { select: { id: true, name: true, code: true } },
//       },
//     });
//   });
// }

// export async function getLineupLocations(companyId: string, lineupId: string) {
//   const lineup = await prisma.lineup.findFirst({
//     where: { id: lineupId, companyId, deletedAt: null },
//     select: { id: true },
//   });
//   if (!lineup) throw new Error("NOT_FOUND");
//
//   return prisma.lineupLocationMap.findMany({
//     where: { lineupId },
//     include: {
//       location: { select: { id: true, name: true, code: true } },
//     },
//     orderBy: { createdAt: "asc" },
//   });
// }
