// src/features/location/services/location.service.ts
import { prisma } from "@/lib/prisma";
import type {
  CreateLocationInput,
  UpdateLocationInput,
  LocationListQuery,
  LocationOptionsQuery,
  LocationOption,
} from "../schemas/location.schema";

// ============================================================
// 공통 select 정의
// ============================================================

const LOCATION_LIST_SELECT = {
  id: true,
  name: true,
  code: true,
  type: true,
  address: true,
  note: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================================
// 코드 자동 채번 (LOC-001, LOC-002, ...)
// ============================================================

async function generateLocationCode(companyId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM locations
    WHERE company_id = ${companyId}
      AND code ~ '^LOC-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "LOC-001";

  const match = result[0].code.match(/^LOC-(\d+)$/);
  if (!match) return "LOC-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `LOC-${String(nextNumber).padStart(3, "0")}`;
}

// ============================================================
// Location CRUD
// ============================================================

export async function getLocations(
  companyId: string,
  query: LocationListQuery
) {
  const { page, limit, search, sortBy, sortOrder, isActive, type } = query;

  const where = {
    companyId,
    deletedAt: null,
    ...(isActive !== undefined ? { isActive } : {}),
    ...(type ? { type } : {}),
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
    prisma.location.findMany({
      where,
      select: LOCATION_LIST_SELECT,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.location.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getLocationById(companyId: string, id: string) {
  return prisma.location.findFirst({
    where: { id, companyId, deletedAt: null },
  });
}

// ============================================================
// ☑ Sprint 4 Phase S4-1-c: 옵션(드롭다운) 조회
// ============================================================
export async function getLocationOptions(
  companyId: string,
  query: LocationOptionsQuery = { includeInactive: false }
): Promise<LocationOption[]> {
  const { types, includeInactive } = query;

  const items = await prisma.location.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
      ...(types && types.length > 0 ? { type: { in: types } } : {}),
    },
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return items;
}

export async function createLocation(
  companyId: string,
  input: CreateLocationInput
) {
  const code = await generateLocationCode(companyId);
  return prisma.location.create({
    data: {
      companyId,
      name: input.name,
      code,
      type: input.type,
      address: input.address ?? null,
      note: input.note ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
}

export async function updateLocation(
  companyId: string,
  id: string,
  input: UpdateLocationInput
) {
  const existing = await prisma.location.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.location.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

// ============================================================
// 위치 삭제 (soft) — 의존성 체크 포함
// ============================================================

export type LocationDependencyCheck = {
  canDelete: boolean;
  reasons: string[];
  counts: {
    productionLines: number;
    inventoryLots: number;
    inventoryTransactions: number;
    stockTakes: number;
    transfersFrom: number;
    transfersTo: number;
    shippingOrders: number;
  };
};

export async function checkLocationDependencies(
  companyId: string,
  id: string
): Promise<LocationDependencyCheck> {
  const location = await prisma.location.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!location) throw new Error("NOT_FOUND");

  const [
    productionLines,
    inventoryLots,
    inventoryTransactions,
    stockTakes,
    transfersFrom,
    transfersTo,
    shippingOrders,
  ] = await Promise.all([
    prisma.productionLine.count({
      where: { locationId: id, deletedAt: null },
    }),
    prisma.inventoryLot.count({ where: { locationId: id } }),
    prisma.inventoryTransaction.count({ where: { locationId: id } }),
    prisma.stockTake.count({ where: { locationId: id } }),
    prisma.inventoryTransfer.count({ where: { fromLocationId: id } }),
    prisma.inventoryTransfer.count({ where: { toLocationId: id } }),
    prisma.shippingOrder.count({ where: { locationId: id } }),
  ]);

  const reasons: string[] = [];
  if (productionLines > 0)
    reasons.push(`이 위치에 등록된 생산라인 ${productionLines}건이 있습니다`);
  if (inventoryLots > 0)
    reasons.push(`이 위치의 재고 로트 ${inventoryLots}건이 있습니다`);
  if (inventoryTransactions > 0)
    reasons.push(`이 위치의 재고 이력 ${inventoryTransactions}건이 있습니다`);
  if (stockTakes > 0)
    reasons.push(`이 위치의 재고 실사 ${stockTakes}건이 있습니다`);
  if (transfersFrom + transfersTo > 0)
    reasons.push(
      `이 위치가 포함된 재고 이동 ${transfersFrom + transfersTo}건이 있습니다`
    );
  if (shippingOrders > 0)
    reasons.push(`이 위치의 출고 ${shippingOrders}건이 있습니다`);

  return {
    canDelete: reasons.length === 0,
    reasons,
    counts: {
      productionLines,
      inventoryLots,
      inventoryTransactions,
      stockTakes,
      transfersFrom,
      transfersTo,
      shippingOrders,
    },
  };
}

/**
 * 위치 삭제 (soft-delete)
 */
export async function deleteLocation(companyId: string, id: string) {
  const check = await checkLocationDependencies(companyId, id);
  if (!check.canDelete) throw new Error("DEPENDENCY_EXISTS");

  return prisma.location.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
