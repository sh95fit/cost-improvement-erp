import { prisma } from "@/lib/prisma";
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  MaterialListQuery,
} from "../schemas/material.schema";

// ── 자재 코드 자동 생성 (MAT-001, MAT-002, ...) ──
async function generateMaterialCode(companyId: string): Promise<string> {
  const lastMaterial = await prisma.materialMaster.findFirst({
    where: { companyId },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastMaterial) return "MAT-001";

  const match = lastMaterial.code.match(/^MAT-(\d+)$/);
  if (!match) return "MAT-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `MAT-${String(nextNumber).padStart(3, "0")}`;
}

// ── 자재 목록 조회 (페이지네이션 + 검색 + 필터) ──
export async function getMaterials(
  companyId: string,
  query: MaterialListQuery
) {
  const { page, limit, search, materialType, stockGrade, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(materialType && { materialType }),
    ...(stockGrade && { stockGrade }),
  };

  const [items, total] = await Promise.all([
    prisma.materialMaster.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.materialMaster.count({ where }),
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

// ── 자재 단건 조회 ──
export async function getMaterialById(companyId: string, id: string) {
  return prisma.materialMaster.findFirst({
    where: { id, companyId },
  });
}

// ── 자재 코드 중복 확인 ──
export async function getMaterialByCode(companyId: string, code: string) {
  return prisma.materialMaster.findFirst({
    where: { companyId, code },
  });
}

// ── 자재 생성 (코드 자동 채번) ──
export async function createMaterial(
    companyId: string,
    input: CreateMaterialInput
  ) {
    const code = await generateMaterialCode(companyId);
  
    return prisma.materialMaster.create({
      data: {
        ...input,
        companyId,
        code,
      },
    });
  }

// ── 자재 수정 ──
export async function updateMaterial(
  companyId: string,
  id: string,
  input: UpdateMaterialInput
) {
  return prisma.materialMaster.update({
    where: { id },
    data: input,
  });
}

// ── 자재 삭제 (soft-delete) ──
export async function deleteMaterial(companyId: string, id: string) {
  const material = await prisma.materialMaster.findFirst({
    where: { id, companyId },
  });

  if (!material) return null;

  return prisma.materialMaster.delete({
    where: { id },
  });
}
