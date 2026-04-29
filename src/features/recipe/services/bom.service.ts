import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateBOMInput,
  UpdateBOMStatusInput,
  CreateBOMItemInput,
  UpdateBOMItemInput,
} from "../schemas/recipe.schema";

// ── BOM 목록 조회 (반제품별) ──
export async function getBOMsBySemiProduct(
  companyId: string,
  semiProductId: string
) {
  return prisma.bOM.findMany({
    where: {
      companyId,
      semiProductId,
      deletedAt: null,
    },
    include: {
      items: {
        include: {
          materialMaster: { select: { id: true, name: true, code: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { version: "desc" },
  });
}

// ── BOM 단건 조회 ──
export async function getBOMById(companyId: string, id: string) {
  return prisma.bOM.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      semiProduct: { select: { id: true, name: true, code: true, unit: true } },
      items: {
        include: {
          materialMaster: { select: { id: true, name: true, code: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ── BOM 다음 버전 번호 조회 ──
export async function getNextBOMVersion(
  companyId: string,
  semiProductId: string
): Promise<number> {
  const latest = await prisma.bOM.findFirst({
    where: {
      companyId,
      semiProductId,
      deletedAt: null,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

// ── BOM 생성 ──
export async function createBOM(companyId: string, input: CreateBOMInput) {
  return prisma.bOM.create({
    data: {
      companyId,
      semiProductId: input.semiProductId,
      version: input.version,
      status: input.status,
      baseQuantity: input.baseQuantity,
      baseUnit: input.baseUnit,
    },
  });
}

// ── BOM 상태 변경 (ACTIVE 중복 방지 포함) ──
export async function updateBOMStatus(
  companyId: string,
  id: string,
  input: UpdateBOMStatusInput
) {
  const bom = await prisma.bOM.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!bom) throw new Error("NOT_FOUND");

  if (input.status === "ACTIVE") {
    return withTransaction(async (tx) => {
      // 같은 반제품의 기존 ACTIVE BOM을 ARCHIVED로 전환
      await tx.bOM.updateMany({
        where: {
          companyId,
          semiProductId: bom.semiProductId,
          status: "ACTIVE",
          deletedAt: null,
          id: { not: id },
        },
        data: { status: "ARCHIVED" },
      });

      return tx.bOM.update({
        where: { id },
        data: { status: input.status },
      });
    });
  }

  return prisma.bOM.update({
    where: { id },
    data: { status: input.status },
  });
}

// ── BOM 삭제 (soft-delete) ──
export async function deleteBOM(companyId: string, id: string) {
  const bom = await prisma.bOM.findFirst({
    where: { id, companyId, deletedAt: null },
  });

  if (!bom) return null;

  return prisma.bOM.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ════════════════════════════════════════
// BOMItem
// ════════════════════════════════════════

// ── BOMItem 추가 ──
export async function addBOMItem(bomId: string, input: CreateBOMItemInput) {
  return prisma.bOMItem.create({
    data: {
      ...input,
      bomId,
    },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

// ── BOMItem 수정 ──
export async function updateBOMItem(id: string, input: UpdateBOMItemInput) {
  return prisma.bOMItem.update({
    where: { id },
    data: input,
  });
}

// ── BOMItem 삭제 ──
export async function deleteBOMItem(id: string) {
  return prisma.bOMItem.delete({
    where: { id },
  });
}

// ── BOMItem 일괄 저장 (기존 아이템 전체 교체) ──
export async function replaceBOMItems(
  bomId: string,
  items: CreateBOMItemInput[]
) {
  return withTransaction(async (tx) => {
    await tx.bOMItem.deleteMany({ where: { bomId } });
    if (items.length > 0) {
      await tx.bOMItem.createMany({
        data: items.map((item, index) => ({
          ...item,
          bomId,
          sortOrder: item.sortOrder ?? index,
        })),
      });
    }
    return tx.bOMItem.findMany({
      where: { bomId },
      include: {
        materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
  });
}
