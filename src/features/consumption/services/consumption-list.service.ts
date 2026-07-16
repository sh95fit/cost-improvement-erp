import { prisma } from "@/lib/prisma";
import type { ConsumptionListQuery } from "../schemas/consumption-list.schema";
import type { Prisma } from "@prisma/client";

// ============================================================
// 공통 select 정의 — 리스트 화면에 필요한 필드 + 이름/코드 조인
// ============================================================
const CONSUMPTION_ITEM_LIST_SELECT = {
  id: true,
  itemType: true,
  consumedQty: true,
  unit: true,
  consumedDate: true,
  sourceType: true,
  disposition: true,
  status: true,
  note: true,
  createdAt: true,
  materialMaster: {
    select: { id: true, name: true, code: true },
  },
  subsidiaryMaster: {
    select: { id: true, name: true, code: true },
  },
  cookingPlan: {
    select: {
      id: true,
      productionLine: {
        select: {
          id: true,
          name: true,
          location: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  },
} as const;

// ============================================================
// UTC 자정 정규화 헬퍼 (@db.Date 매치)
// ============================================================
function normalizeToUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// ============================================================
// 사용 이력 목록 조회
// ============================================================
export async function listConsumptionItems(
  companyId: string,
  query: ConsumptionListQuery,
) {
  const {
    page,
    limit,
    startDate,
    endDate,
    locationId,
    itemType,
    sourceType,
    disposition,
  } = query;

  // 날짜 범위
  const consumedDateFilter: Prisma.DateTimeFilter | undefined =
    startDate || endDate
      ? {
          ...(startDate ? { gte: normalizeToUtcDate(startDate) } : {}),
          ...(endDate ? { lte: normalizeToUtcDate(endDate) } : {}),
        }
      : undefined;

  // ConsumptionItem 은 locationId 를 직접 갖지 않고
  // cookingPlan.productionLine.locationId 를 통해 파생
  const where: Prisma.ConsumptionItemWhereInput = {
    companyId,
    ...(consumedDateFilter ? { consumedDate: consumedDateFilter } : {}),
    ...(itemType ? { itemType } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(disposition ? { disposition } : {}),
    ...(locationId
      ? {
          cookingPlan: {
            productionLine: {
              locationId,
            },
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.consumptionItem.findMany({
      where,
      select: CONSUMPTION_ITEM_LIST_SELECT,
      orderBy: [{ consumedDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.consumptionItem.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export type ConsumptionListItem = Awaited<
  ReturnType<typeof listConsumptionItems>
>["items"][number];
