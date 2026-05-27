// src/features/lineup/services/lineup.service.ts
import { prisma } from "@/lib/prisma";
import type {
  CreateLineupInput,
  UpdateLineupInput,
  LineupListQuery,
  SyncLineupLocationsInput,
} from "../schemas/lineup.schema";

// ============================================================
// 공통 select 정의
// ============================================================

const LINEUP_LIST_SELECT = {
  id: true,
  name: true,
  code: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      locationMaps: true,
      // 활성 매핑만 카운트되도록 별도 쿼리는 필요 시 추가
    },
  },
} as const;

// ============================================================
// 코드 자동 채번 (LINE-001, LINE-002, ...)
// soft-delete extension 우회 위해 raw query 사용
// (suppliers의 generateSupplierCode 패턴 준수)
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

/**
 * 회사 소속 라인업 목록 조회 (페이지네이션 + 검색)
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
      select: LINEUP_LIST_SELECT,
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
 * 라인업 단건 조회 (locationMaps + templateMaps 포함)
 */
export async function getLineupById(companyId: string, id: string) {
  return prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      locationMaps: {
        include: {
          location: { select: { id: true, name: true, code: true } },
        },
      },
      templateMaps: {
        where: { deletedAt: null },
        include: {
          mealTemplate: { select: { id: true, name: true } },
        },
        orderBy: { slotType: "asc" },
      },
    },
  });
}

/**
 * 라인업 생성 (코드 자동 채번)
 */
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
    },
  });
}

/**
 * 라인업 수정
 */
export async function updateLineup(
  companyId: string,
  id: string,
  input: UpdateLineupInput
) {
  // companyId 일치 확인 (보안)
  const existing = await prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.lineup.update({
    where: { id },
    data: input,
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
    shippingOrders: number;
  };
};

/**
 * 라인업이 다른 활성 데이터에서 참조되는지 확인
 *  - 활성 MealPlan / MealCount / ShippingOrder가 있으면 삭제 불가
 *  - LineupLocationMap, LineupMealTemplateMap은 cascade로 함께 정리되므로 무관
 */
export async function checkLineupDependencies(
  companyId: string,
  id: string
): Promise<LineupDependencyCheck> {
  const lineup = await prisma.lineup.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!lineup) throw new Error("NOT_FOUND");

  const [mealPlans, mealCounts, shippingOrders] = await Promise.all([
    prisma.mealPlan.count({
      where: { lineupId: id, deletedAt: null },
    }),
    prisma.mealCount.count({
      where: { lineupId: id, deletedAt: null },
    }),
    prisma.shippingOrder.count({
      where: { lineupId: id },
    }),
  ]);

  const reasons: string[] = [];
  if (mealPlans > 0) reasons.push(`식단 ${mealPlans}건이 이 라인업을 사용 중입니다`);
  if (mealCounts > 0) reasons.push(`식수 ${mealCounts}건이 이 라인업을 사용 중입니다`);
  if (shippingOrders > 0)
    reasons.push(`출고 ${shippingOrders}건이 이 라인업을 사용 중입니다`);

  return {
    canDelete: reasons.length === 0,
    reasons,
    counts: { mealPlans, mealCounts, shippingOrders },
  };
}

/**
 * 라인업 삭제 (soft-delete)
 *  - 의존성이 있으면 DEPENDENCY_EXISTS 에러
 *  - 트랜잭션으로 lineup + locationMaps + templateMaps 동시 처리
 *    · locationMaps: hard delete (감사 가치 낮음, FK 정리 목적)
 *    · templateMaps: soft delete (정책 일관성)
 */
export async function deleteLineup(companyId: string, id: string) {
  const check = await checkLineupDependencies(companyId, id);
  if (!check.canDelete) throw new Error("DEPENDENCY_EXISTS");

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // locationMaps hard delete
    await tx.lineupLocationMap.deleteMany({
      where: { lineupId: id },
    });

    // templateMaps soft delete
    await tx.lineupMealTemplateMap.updateMany({
      where: { lineupId: id, deletedAt: null },
      data: { deletedAt: now },
    });

    return tx.lineup.update({
      where: { id },
      data: { deletedAt: now },
    });
  });
}

// ============================================================
// LineupLocationMap — 일괄 동기화
// ============================================================

/**
 * 라인업에 매핑된 배송지를 입력 배열과 동일하게 만든다.
 *  - 빠진 매핑은 hard delete
 *  - 새 매핑은 create
 *  - 기존 매핑은 그대로 유지
 *  - locationIds는 모두 같은 companyId 소속이어야 함 (검증)
 */
export async function syncLineupLocations(
  companyId: string,
  lineupId: string,
  input: SyncLineupLocationsInput
) {
  // 1) 라인업 소속 확인
  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!lineup) throw new Error("NOT_FOUND");

  // 2) location 소속 검증 (중복 제거)
  const uniqueLocationIds = Array.from(new Set(input.locationIds));
  if (uniqueLocationIds.length > 0) {
    const validLocations = await prisma.location.findMany({
      where: {
        id: { in: uniqueLocationIds },
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (validLocations.length !== uniqueLocationIds.length) {
      throw new Error("INVALID_LOCATION");
    }
  }

  // 3) 트랜잭션: 현재 매핑 조회 → diff → 적용
  return prisma.$transaction(async (tx) => {
    const existing = await tx.lineupLocationMap.findMany({
      where: { lineupId },
      select: { id: true, locationId: true },
    });
    const existingSet = new Set(existing.map((m) => m.locationId));
    const desiredSet = new Set(uniqueLocationIds);

    const toRemove = existing
      .filter((m) => !desiredSet.has(m.locationId))
      .map((m) => m.id);
    const toAdd = uniqueLocationIds.filter((id) => !existingSet.has(id));

    if (toRemove.length > 0) {
      await tx.lineupLocationMap.deleteMany({
        where: { id: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.lineupLocationMap.createMany({
        data: toAdd.map((locationId) => ({ lineupId, locationId })),
      });
    }

    return tx.lineupLocationMap.findMany({
      where: { lineupId },
      include: {
        location: { select: { id: true, name: true, code: true } },
      },
    });
  });
}

/**
 * 라인업의 현재 배송지 매핑 조회
 */
export async function getLineupLocations(companyId: string, lineupId: string) {
  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!lineup) throw new Error("NOT_FOUND");

  return prisma.lineupLocationMap.findMany({
    where: { lineupId },
    include: {
      location: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
