import { prisma } from "@/lib/prisma";
import type {
  CreateSemiProductInput,
  UpdateSemiProductInput,
  SemiProductListQuery,
} from "../schemas/recipe.schema";

// ── 반제품 코드 자동 생성 (SP-001, SP-002, ...) ──
async function generateSemiProductCode(companyId: string): Promise<string> {
  const last = await prisma.semiProduct.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!last) return "SP-001";

  const match = last.code.match(/^SP-(\d+)$/);
  if (!match) return "SP-001";

  const nextNumber = parseInt(match[1], 10) + 1;
  return `SP-${String(nextNumber).padStart(3, "0")}`;
}

// ── 반제품 목록 조회 ──
export async function getSemiProducts(
  companyId: string,
  query: SemiProductListQuery
) {
  const { page, limit, search, sortBy, sortOrder } = query;
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
  };

  const [items, total] = await Promise.all([
    prisma.semiProduct.findMany({
      where,
      include: {
        boms: {
          where: { status: "ACTIVE", deletedAt: null }, 
          select: { id: true, version: true, status: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.semiProduct.count({ where }),
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

// ── 반제품 단건 조회 ──
export async function getSemiProductById(companyId: string, id: string) {
  return prisma.semiProduct.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      boms: {
        where: { deletedAt: null },  
        include: {
          items: {
            include: {
              materialMaster: { select: { id: true, name: true, code: true, unit: true } },
              subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { version: "desc" },
      },
    },
  });
}

// ── 반제품 코드 중복 확인 ──
export async function getSemiProductByCode(companyId: string, code: string) {
  return prisma.semiProduct.findFirst({
    where: { companyId, code, deletedAt: null },
  });
}

// ── 반제품 생성 ──
export async function createSemiProduct(
  companyId: string,
  input: CreateSemiProductInput
) {
  const code = await generateSemiProductCode(companyId);

  return prisma.semiProduct.create({
    data: {
      ...input,
      companyId,
      code,
    },
  });
}

// ── 반제품 수정 ──
export async function updateSemiProduct(
  companyId: string,
  id: string,
  input: UpdateSemiProductInput
) {
  return prisma.semiProduct.update({
    where: { id },
    data: input,
  });
}

// ── 반제품 삭제 (soft-delete) ──
export async function deleteSemiProduct(companyId: string, id: string) {
  const semiProduct = await prisma.semiProduct.findFirst({
    where: { id, companyId, deletedAt: null },
  });

  if (!semiProduct) return null;

  return prisma.semiProduct.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
