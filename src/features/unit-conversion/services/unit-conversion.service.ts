import { prisma } from "@/lib/prisma";
import type {
  CreateUnitConversionInput,
  UpdateUnitConversionInput,
  UnitConversionListQuery,
} from "../schemas/unit-conversion.schema";

// ── 목록 조회 ──
export async function getUnitConversions(
  companyId: string,
  query: UnitConversionListQuery
) {
  const { page, limit, search, materialId, subsidiaryId, scope } = query;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { companyId };

  // 스코프 필터
  if (scope === "global") {
    where.materialMasterId = null;
    where.subsidiaryMasterId = null;
  } else if (scope === "material") {
    where.materialMasterId = { not: null };
    where.subsidiaryMasterId = null;
  } else if (scope === "subsidiary") {
    where.subsidiaryMasterId = { not: null };
    where.materialMasterId = null;
  }

  // 특정 자재/부자재 필터
  if (materialId) {
    where.materialMasterId = materialId;
    where.subsidiaryMasterId = null;
  }
  if (subsidiaryId) {
    where.subsidiaryMasterId = subsidiaryId;
    where.materialMasterId = null;
  }

  // 검색
  if (search) {
    where.OR = [
      { fromUnit: { contains: search, mode: "insensitive" } },
      { toUnit: { contains: search, mode: "insensitive" } },
      { materialMaster: { name: { contains: search, mode: "insensitive" } } },
      { subsidiaryMaster: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.unitConversion.findMany({
      where,
      include: {
        materialMaster: { select: { id: true, name: true, code: true, unit: true } },
        subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
      },
      orderBy: [
        { materialMasterId: { sort: "asc", nulls: "first" } },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.unitConversion.count({ where }),
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

// ── 단건 조회 ──
export async function getUnitConversionById(id: string) {
  return prisma.unitConversion.findFirst({
    where: { id },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

// ── 중복 확인 ──
export async function findDuplicateConversion(
  companyId: string,
  materialMasterId: string | null,
  subsidiaryMasterId: string | null,
  fromUnit: string,
  toUnit: string
) {
  return prisma.unitConversion.findFirst({
    where: {
      companyId,
      materialMasterId,
      subsidiaryMasterId,
      fromUnit,
      toUnit,
    },
  });
}

// ── 생성 ──
export async function createUnitConversion(
  companyId: string,
  input: CreateUnitConversionInput
) {
  return prisma.unitConversion.create({
    data: {
      companyId,
      materialMasterId: input.materialMasterId,
      subsidiaryMasterId: input.subsidiaryMasterId,
      fromUnit: input.fromUnit,
      toUnit: input.toUnit,
      factor: input.factor,
      unitCategory: input.unitCategory,
    },
  });
}

// ── 수정 ──
export async function updateUnitConversion(
  id: string,
  input: UpdateUnitConversionInput
) {
  return prisma.unitConversion.update({
    where: { id },
    data: input,
  });
}

// ── 삭제 ──
export async function deleteUnitConversion(id: string) {
  const conversion = await prisma.unitConversion.findFirst({
    where: { id },
  });
  if (!conversion) return null;
  return prisma.unitConversion.delete({ where: { id } });
}
