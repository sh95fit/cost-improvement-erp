import { prisma } from "@/lib/prisma";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierListQuery,
} from "../schemas/supplier.schema";

// ── 공급업체 코드 자동 생성 (SUP-001, SUP-002, ...) ──
// soft-delete extension을 우회하여 삭제된 레코드 포함 최대 코드 조회
// DB unique constraint는 deletedAt과 무관하므로 전체 행 기준 채번 필수
async function generateSupplierCode(companyId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM suppliers
    WHERE company_id = ${companyId}
      AND code ~ '^SUP-[0-9]+$'
    ORDER BY code DESC
    LIMIT 1
  `;

  if (result.length === 0) return "SUP-001";

  const match = result[0].code.match(/^SUP-(\d+)$/);
  if (!match) return "SUP-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `SUP-${String(nextNumber).padStart(3, "0")}`;
}

// ── 목록 조회 (페이지네이션 + 검색 + 유형 필터) ──
export async function getSuppliers(
  companyId: string,
  query: SupplierListQuery
) {
  const { page, limit, search, supplierType, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    deletedAt: null,
    ...(supplierType && { supplierType }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
        { contactName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      include: {
        _count: { select: { supplierItems: true } },
      },
    }),
    prisma.supplier.count({ where }),
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
export async function getSupplierById(companyId: string, id: string) {
  return prisma.supplier.findFirst({
    where: { id, companyId, deletedAt: null },
  });
}

// ── 생성 (코드 자동 채번) ──
export async function createSupplier(
  companyId: string,
  input: CreateSupplierInput
) {
  const code = await generateSupplierCode(companyId);

  return prisma.supplier.create({
    data: {
      ...input,
      companyId,
      code,
    },
  });
}

// ── 수정 ──
export async function updateSupplier(
  companyId: string,
  id: string,
  input: UpdateSupplierInput
) {
  return prisma.supplier.update({
    where: { id },
    data: input,
  });
}

// ── 삭제 (soft-delete) ──
export async function deleteSupplier(companyId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId, deletedAt: null },
  });

  if (!supplier) return null;

  return prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
