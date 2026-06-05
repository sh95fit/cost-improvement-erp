// src/features/production-line/services/production-line.service.ts
import { prisma } from "@/lib/prisma";
import type {
  CreateProductionLineInput,
  UpdateProductionLineInput,
  ProductionLineListQuery,
} from "../schemas/production-line.schema";

const PRODUCTION_LINE_LIST_SELECT = {
  id: true,
  name: true,
  code: true,
  status: true,
  sortOrder: true,
  note: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: { id: true, code: true, name: true, type: true },
  },
} as const;

// ============================================================
// 코드 자동 채번 (PL-001, PL-002, ...)
// ============================================================

async function generateProductionLineCode(
  companyId: string
): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM production_lines
    WHERE company_id = ${companyId}
      AND code ~ '^PL-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "PL-001";

  const match = result[0].code.match(/^PL-(\d+)$/);
  if (!match) return "PL-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `PL-${String(nextNumber).padStart(3, "0")}`;
}

// ============================================================
// 위치 검증 (FACTORY 또는 HYBRID만 허용)
// ============================================================

async function assertValidLocation(
  companyId: string,
  locationId: string
): Promise<void> {
  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      companyId,
      deletedAt: null,
    },
    select: { id: true, type: true, isActive: true },
  });
  if (!location) throw new Error("LOCATION_NOT_FOUND");
  if (location.type === "WAREHOUSE") throw new Error("LOCATION_NOT_FACTORY");
  if (!location.isActive) throw new Error("LOCATION_INACTIVE");
}

// ============================================================
// ProductionLine CRUD
// ============================================================

export async function getProductionLines(
  companyId: string,
  query: ProductionLineListQuery
) {
  const { page, limit, search, sortBy, sortOrder, status, locationId } = query;

  const where = {
    companyId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(locationId ? { locationId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sortBy === "sortOrder"
      ? [{ sortOrder: sortOrder }, { name: "asc" as const }]
      : [{ [sortBy]: sortOrder }];

  const [items, total] = await Promise.all([
    prisma.productionLine.findMany({
      where,
      select: PRODUCTION_LINE_LIST_SELECT,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.productionLine.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getProductionLineById(companyId: string, id: string) {
  return prisma.productionLine.findFirst({
    where: { id, companyId, deletedAt: null },
    select: PRODUCTION_LINE_LIST_SELECT,
  });
}

export async function createProductionLine(
  companyId: string,
  input: CreateProductionLineInput
) {
  await assertValidLocation(companyId, input.locationId);
  const code = await generateProductionLineCode(companyId);
  return prisma.productionLine.create({
    data: {
      companyId,
      locationId: input.locationId,
      name: input.name,
      code,
      status: input.status,
      sortOrder: input.sortOrder,
      note: input.note ?? null,
    },
    select: PRODUCTION_LINE_LIST_SELECT,
  });
}

export async function updateProductionLine(
  companyId: string,
  id: string,
  input: UpdateProductionLineInput
) {
  const existing = await prisma.productionLine.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (input.locationId !== undefined) {
    await assertValidLocation(companyId, input.locationId);
  }

  return prisma.productionLine.update({
    where: { id },
    data: {
      ...(input.locationId !== undefined
        ? { locationId: input.locationId }
        : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    select: PRODUCTION_LINE_LIST_SELECT,
  });
}

// ============================================================
// 의존성 체크 + soft-delete
// ============================================================

export type ProductionLineDependencyCheck = {
  canDelete: boolean;
  reasons: string[];
  counts: {
    cookingPlans: number;
    mealPlanSlots: number;
  };
};

export async function checkProductionLineDependencies(
  companyId: string,
  id: string
): Promise<ProductionLineDependencyCheck> {
  const line = await prisma.productionLine.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!line) throw new Error("NOT_FOUND");

  const [cookingPlans, mealPlanSlots] = await Promise.all([
    prisma.cookingPlan.count({ where: { productionLineId: id } }),
    prisma.mealPlanSlot.count({
      where: { productionLineId: id, deletedAt: null },
    }),
  ]);

  const reasons: string[] = [];
  if (cookingPlans > 0)
    reasons.push(`이 라인의 작업지시서 ${cookingPlans}건이 있습니다`);
  if (mealPlanSlots > 0)
    reasons.push(
      `이 라인에 배정된 식단 슬롯 ${mealPlanSlots}건이 있습니다`
    );

  return {
    canDelete: reasons.length === 0,
    reasons,
    counts: { cookingPlans, mealPlanSlots },
  };
}

export async function deleteProductionLine(companyId: string, id: string) {
  const check = await checkProductionLineDependencies(companyId, id);
  if (!check.canDelete) throw new Error("DEPENDENCY_EXISTS");

  return prisma.productionLine.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ============================================================
// 위치 옵션 조회 (Form 드롭다운용)
// ============================================================

export async function getFactoryLocationOptions(companyId: string) {
  return prisma.location.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      type: { in: ["FACTORY", "HYBRID"] },
    },
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
