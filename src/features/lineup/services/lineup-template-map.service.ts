// src/features/lineup/services/lineup-template-map.service.ts
import { prisma } from "@/lib/prisma";
import { MealSlotType } from "@prisma/client";
import type {
  UpsertLineupTemplateMapInput,
  BulkUpsertLineupTemplateMapsInput,
} from "../schemas/lineup.schema";

// ============================================================
// 공통 헬퍼
// ============================================================

/**
 * 라인업이 회사 소속인지 검증
 */
async function assertLineupInCompany(companyId: string, lineupId: string) {
  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!lineup) throw new Error("NOT_FOUND");
}

/**
 * MealTemplate이 회사 소속인지 검증
 */
async function assertTemplateInCompany(
  companyId: string,
  mealTemplateId: string
) {
  const template = await prisma.mealTemplate.findFirst({
    where: { id: mealTemplateId, companyId },
    select: { id: true },
  });
  if (!template) throw new Error("INVALID_TEMPLATE");
}

// ============================================================
// 조회
// ============================================================

/**
 * 특정 라인업의 활성 매핑 전체 조회 (슬롯타입 오름차순)
 */
export async function getLineupTemplateMaps(
  companyId: string,
  lineupId: string
) {
  await assertLineupInCompany(companyId, lineupId);

  return prisma.lineupMealTemplateMap.findMany({
    where: { lineupId, deletedAt: null },
    include: {
      mealTemplate: { select: { id: true, name: true } },
    },
    orderBy: { slotType: "asc" },
  });
}

/**
 * (lineupId, slotType) 활성 매핑 1건 조회
 *  - 자동 식단 생성 시 사용 (MealPlan 자동 생성 로직에서 호출 예정)
 */
export async function getDefaultTemplateForSlot(
  companyId: string,
  lineupId: string,
  slotType: MealSlotType
) {
  await assertLineupInCompany(companyId, lineupId);

  return prisma.lineupMealTemplateMap.findFirst({
    where: { lineupId, slotType, deletedAt: null },
    include: {
      mealTemplate: { select: { id: true, name: true } },
    },
  });
}

// ============================================================
// 단건 업서트
// ============================================================

/**
 * (lineupId, slotType) 매핑 업서트
 *  - 활성 행이 있으면 update
 *  - soft-deleted 행이 있으면 deletedAt = null로 복원 + update
 *  - 둘 다 없으면 create
 *  - partial unique index 덕분에 활성 + soft-deleted가 동시 존재 가능하나,
 *    이 함수는 항상 활성 1건만 보장하도록 동작
 */
export async function upsertLineupTemplateMap(
  companyId: string,
  lineupId: string,
  input: UpsertLineupTemplateMapInput
) {
  await assertLineupInCompany(companyId, lineupId);
  await assertTemplateInCompany(companyId, input.mealTemplateId);

  return prisma.$transaction(async (tx) => {
    // 1) 활성 행 조회
    const active = await tx.lineupMealTemplateMap.findFirst({
      where: {
        lineupId,
        slotType: input.slotType,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (active) {
      return tx.lineupMealTemplateMap.update({
        where: { id: active.id },
        data: { mealTemplateId: input.mealTemplateId },
        include: { mealTemplate: { select: { id: true, name: true } } },
      });
    }

    // 2) soft-deleted 행 조회 → 복원
    const deleted = await tx.lineupMealTemplateMap.findFirst({
      where: {
        lineupId,
        slotType: input.slotType,
        deletedAt: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (deleted) {
      return tx.lineupMealTemplateMap.update({
        where: { id: deleted.id },
        data: {
          mealTemplateId: input.mealTemplateId,
          deletedAt: null,
        },
        include: { mealTemplate: { select: { id: true, name: true } } },
      });
    }

    // 3) 신규 생성
    return tx.lineupMealTemplateMap.create({
      data: {
        lineupId,
        slotType: input.slotType,
        mealTemplateId: input.mealTemplateId,
      },
      include: { mealTemplate: { select: { id: true, name: true } } },
    });
  });
}

// ============================================================
// 일괄 업서트
// ============================================================

/**
 * 여러 (slotType, mealTemplateId) 매핑을 한 번에 처리
 *  - 입력 배열 내 동일 slotType 중복은 후자가 우선
 *  - 입력에 포함되지 않은 슬롯타입은 건드리지 않음 (삭제하려면 deleteByMapId 호출)
 *  - 트랜잭션 1회로 전체 처리
 */
export async function bulkUpsertLineupTemplateMaps(
  companyId: string,
  lineupId: string,
  input: BulkUpsertLineupTemplateMapsInput
) {
  await assertLineupInCompany(companyId, lineupId);

  // 1) 입력 정규화: 동일 slotType은 마지막 값만 유지
  const dedupMap = new Map<MealSlotType, string>();
  for (const item of input.items) {
    dedupMap.set(item.slotType, item.mealTemplateId);
  }
  const items = Array.from(dedupMap.entries()).map(([slotType, mealTemplateId]) => ({
    slotType,
    mealTemplateId,
  }));

  if (items.length === 0) return [];

  // 2) 모든 templateId 회사 소속 확인 (배치)
  const templateIds = Array.from(new Set(items.map((i) => i.mealTemplateId)));
  const validTemplates = await prisma.mealTemplate.findMany({
    where: { id: { in: templateIds }, companyId },
    select: { id: true },
  });
  if (validTemplates.length !== templateIds.length) {
    throw new Error("INVALID_TEMPLATE");
  }

  // 3) 트랜잭션: 슬롯타입별 활성/soft-deleted 조회 후 처리
  return prisma.$transaction(async (tx) => {
    const slotTypes = items.map((i) => i.slotType);

    const existingRows = await tx.lineupMealTemplateMap.findMany({
      where: { lineupId, slotType: { in: slotTypes } },
      orderBy: [{ slotType: "asc" }, { deletedAt: "asc" }],
    });

    // slotType별로 활성 행 / 가장 최근 soft-deleted 행 매핑
    const activeBySlot = new Map<MealSlotType, string>();
    const deletedBySlot = new Map<MealSlotType, string>();
    for (const row of existingRows) {
      if (row.deletedAt === null) {
        activeBySlot.set(row.slotType, row.id);
      } else if (!deletedBySlot.has(row.slotType)) {
        // findMany가 deletedAt asc로 정렬되어 첫 번째가 가장 오래된 것이지만,
        // 복원은 어느 행이든 무관하므로 단순히 첫 행 사용
        deletedBySlot.set(row.slotType, row.id);
      }
    }

    const results: Awaited<
      ReturnType<typeof tx.lineupMealTemplateMap.update>
    >[] = [];

    for (const item of items) {
      const activeId = activeBySlot.get(item.slotType);
      if (activeId) {
        const updated = await tx.lineupMealTemplateMap.update({
          where: { id: activeId },
          data: { mealTemplateId: item.mealTemplateId },
        });
        results.push(updated);
        continue;
      }
      const deletedId = deletedBySlot.get(item.slotType);
      if (deletedId) {
        const restored = await tx.lineupMealTemplateMap.update({
          where: { id: deletedId },
          data: {
            mealTemplateId: item.mealTemplateId,
            deletedAt: null,
          },
        });
        results.push(restored);
        continue;
      }
      const created = await tx.lineupMealTemplateMap.create({
        data: {
          lineupId,
          slotType: item.slotType,
          mealTemplateId: item.mealTemplateId,
        },
      });
      results.push(created);
    }

    return results;
  });
}

// ============================================================
// 삭제 (soft)
// ============================================================

/**
 * 매핑 id로 soft delete
 */
export async function deleteLineupTemplateMap(
  companyId: string,
  mapId: string
) {
  const map = await prisma.lineupMealTemplateMap.findFirst({
    where: { id: mapId, deletedAt: null },
    include: { lineup: { select: { companyId: true } } },
  });
  if (!map) throw new Error("NOT_FOUND");
  if (map.lineup.companyId !== companyId) throw new Error("FORBIDDEN");

  return prisma.lineupMealTemplateMap.update({
    where: { id: mapId },
    data: { deletedAt: new Date() },
  });
}

/**
 * (lineupId, slotType) 조합으로 soft delete
 *  - 매핑 id를 모르는 UI(체크박스 토글)에서 사용
 */
export async function deleteLineupTemplateMapBySlot(
  companyId: string,
  lineupId: string,
  slotType: MealSlotType
) {
  await assertLineupInCompany(companyId, lineupId);

  const active = await prisma.lineupMealTemplateMap.findFirst({
    where: { lineupId, slotType, deletedAt: null },
    select: { id: true },
  });
  if (!active) throw new Error("NOT_FOUND");

  return prisma.lineupMealTemplateMap.update({
    where: { id: active.id },
    data: { deletedAt: new Date() },
  });
}
