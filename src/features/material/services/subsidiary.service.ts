import { prisma } from "@/lib/prisma";
import type {
  CreateSubsidiaryInput,
  UpdateSubsidiaryInput,
  MaterialListQuery,
} from "../schemas/material.schema";

// ── 부자재 코드 자동 생성 (SUB-001, SUB-002, ...) ──
async function generateSubsidiaryCode(companyId: string): Promise<string> {
  const lastSubsidiary = await prisma.subsidiaryMaster.findFirst({
    where: { companyId },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastSubsidiary) return "SUB-001";

  const match = lastSubsidiary.code.match(/^SUB-(\d+)$/);
  if (!match) return "SUB-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `SUB-${String(nextNumber).padStart(3, "0")}`;
}

// ── 부자재 목록 조회 (페이지네이션 + 검색) ──
export async function getSubsidiaries(
  companyId: string,
  query: MaterialListQuery
) {
  const { page, limit, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.subsidiaryMaster.findMany({
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
    prisma.subsidiaryMaster.count({ where }),
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

// ── 부자재 단건 조회 ──
export async function getSubsidiaryById(companyId: string, id: string) {
  return prisma.subsidiaryMaster.findFirst({
    where: { id, companyId },
    include: {
      defaultSupplierItem: {
        select: {
          id: true,
          productName: true,
          currentPrice: true,
          supplyUnit: true,
          supplyUnitQty: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ── 부자재 코드 중복 확인 ──
export async function getSubsidiaryByCode(companyId: string, code: string) {
  return prisma.subsidiaryMaster.findFirst({
    where: { companyId, code },
  });
}

// ── 부자재 생성 (코드 자동 채번) ──
export async function createSubsidiary(
  companyId: string,
  input: CreateSubsidiaryInput
) {
  const code = await generateSubsidiaryCode(companyId);

  return prisma.subsidiaryMaster.create({
    data: {
      ...input,
      companyId,
      code,
    },
  });
}

// ── 부자재 수정 ──
export async function updateSubsidiary(
  companyId: string,
  id: string,
  input: UpdateSubsidiaryInput
) {
  return prisma.subsidiaryMaster.update({
    where: { id },
    data: input,
  });
}

// ── 부자재 삭제 (soft-delete) ──
export async function deleteSubsidiary(companyId: string, id: string) {
  const subsidiary = await prisma.subsidiaryMaster.findFirst({
    where: { id, companyId },
  });

  if (!subsidiary) return null;

  return prisma.subsidiaryMaster.delete({
    where: { id },
  });
}

// ── 기본 공급 품목 설정 ──
export async function setDefaultSupplierItem(
  companyId: string,
  subsidiaryId: string,
  supplierItemId: string | null
) {
  return prisma.subsidiaryMaster.update({
    where: { id: subsidiaryId },
    data: { defaultSupplierItemId: supplierItemId },
  });
}

