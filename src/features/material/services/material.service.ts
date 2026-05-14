import { prisma } from "@/lib/prisma";
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  MaterialListQuery,
} from "../schemas/material.schema";

// ── 자재 코드 자동 생성 (MAT-001, MAT-002, ...) ──
async function generateMaterialCode(companyId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM material_masters
    WHERE company_id = ${companyId}
      AND code ~ '^MAT-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "MAT-001";

  const match = result[0].code.match(/^MAT-(\d+)$/);
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
    deletedAt: null,
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
      include: {
        defaultSupplierItem: {
          include: {
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
      },
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
    where: { id, companyId, deletedAt: null },
    include: {
      defaultSupplierItem: {
        include: {
          supplier: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

// ── 자재 코드 중복 확인 ──
export async function getMaterialByCode(companyId: string, code: string) {
  return prisma.materialMaster.findFirst({
    where: { companyId, code, deletedAt: null },
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
    where: { id, companyId, deletedAt: null },
  });

  if (!material) return null;

  return prisma.materialMaster.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ── 기본 공급 품목 설정 ──
export async function setDefaultSupplierItem(
  companyId: string,
  materialId: string,
  supplierItemId: string | null
) {
  // 자재 존재 확인
  const material = await prisma.materialMaster.findFirst({
    where: { id: materialId, companyId, deletedAt: null },
  });
  if (!material) throw new Error("NOT_FOUND");

  return prisma.materialMaster.update({
    where: { id: materialId },
    data: { defaultSupplierItemId: supplierItemId },
  });
}
