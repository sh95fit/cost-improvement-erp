import { prisma } from "@/lib/prisma";
import type {
  CreateUnitConversionInput,
  UpdateUnitConversionInput,
  UnitConversionListQuery,
} from "../schemas/unit-conversion.schema";

// ── 목록 조회 (회사 소속 자재 기준 필터) ──
export async function getUnitConversions(
  companyId: string,
  query: UnitConversionListQuery
) {
  const { page, limit, search, materialId } = query;
  const skip = (page - 1) * limit;

  const where = {
    fromMaterial: { companyId },
    ...(materialId && {
      OR: [
        { fromMaterialId: materialId },
        { toMaterialId: materialId },
      ],
    }),
    ...(search && {
      OR: [
        { fromUnit: { contains: search, mode: "insensitive" as const } },
        { toUnit: { contains: search, mode: "insensitive" as const } },
        { fromMaterial: { name: { contains: search, mode: "insensitive" as const } } },
        { toMaterial: { name: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.unitConversion.findMany({
      where,
      include: {
        fromMaterial: { select: { id: true, name: true, code: true, unit: true } },
        toMaterial: { select: { id: true, name: true, code: true, unit: true } },
      },
      orderBy: { createdAt: "desc" },
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
      fromMaterial: { select: { id: true, name: true, code: true, unit: true } },
      toMaterial: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

// ── 중복 확인 (같은 자재 + 같은 단위 조합) ──
export async function findDuplicateConversion(
  fromMaterialId: string,
  toMaterialId: string,
  fromUnit: string,
  toUnit: string
) {
  return prisma.unitConversion.findFirst({
    where: {
      fromMaterialId,
      toMaterialId,
      fromUnit,
      toUnit,
    },
  });
}

// ── 생성 ──
export async function createUnitConversion(input: CreateUnitConversionInput) {
  return prisma.unitConversion.create({
    data: {
      fromMaterialId: input.fromMaterialId,
      toMaterialId: input.toMaterialId,
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

  return prisma.unitConversion.delete({
    where: { id },
  });
}
