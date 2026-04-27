import { prisma } from "@/lib/prisma";
import { withTransaction } from "@/lib/auth/transaction";
import type {
  CreateSupplierItemInput,
  UpdateSupplierItemInput,
} from "../schemas/supplier.schema";

// ── 공급 품목 목록 조회 (업체별) ──
export async function getSupplierItems(supplierId: string) {
  return prisma.supplierItem.findMany({
    where: { supplierId },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── 공급 품목 단건 조회 ──
export async function getSupplierItemById(id: string) {
  return prisma.supplierItem.findFirst({
    where: { id },
    include: {
      materialMaster: { select: { id: true, name: true, code: true, unit: true } },
      subsidiaryMaster: { select: { id: true, name: true, code: true, unit: true } },
    },
  });
}

// ── 공급 품목 중복 확인 (같은 업체 + 같은 자재/부자재 + 같은 제품명) ──
export async function findDuplicateSupplierItem(
  supplierId: string,
  itemType: string,
  productName: string,
  materialMasterId?: string,
  subsidiaryMasterId?: string
) {
  return prisma.supplierItem.findFirst({
    where: {
      supplierId,
      itemType: itemType as "MATERIAL" | "SUBSIDIARY",
      productName,
      ...(itemType === "MATERIAL" && { materialMasterId }),
      ...(itemType === "SUBSIDIARY" && { subsidiaryMasterId }),
    },
  });
}

// ── 공급 품목 생성 + 초기 단가 이력 기록 ──
export async function createSupplierItem(
  supplierId: string,
  input: CreateSupplierItemInput
) {
  return withTransaction(async (tx) => {
    const item = await tx.supplierItem.create({
      data: {
        supplierId,
        itemType: input.itemType,
        materialMasterId: input.materialMasterId ?? null,
        subsidiaryMasterId: input.subsidiaryMasterId ?? null,
        productName: input.productName,
        spec: input.spec ?? null,
        supplyUnit: input.supplyUnit,
        supplyUnitQty: input.supplyUnitQty,
        currentPrice: input.currentPrice,
        leadTimeDays: input.leadTimeDays ?? 0,
      },
    });

    await tx.supplierItemPriceHistory.create({
      data: {
        supplierItemId: item.id,
        price: input.currentPrice,
        effectiveFrom: new Date(),
      },
    });

    return item;
  });
}

// ── 공급 품목 수정 + 단가 변경 시 이력 기록 ──
export async function updateSupplierItem(
  id: string,
  input: UpdateSupplierItemInput
) {
  return withTransaction(async (tx) => {
    const existing = await tx.supplierItem.findUniqueOrThrow({
      where: { id },
    });

    const item = await tx.supplierItem.update({
      where: { id },
      data: input,
    });

    // 단가가 변경된 경우에만 이력 기록
    if (input.currentPrice != null && input.currentPrice !== existing.currentPrice) {
      await tx.supplierItemPriceHistory.create({
        data: {
          supplierItemId: id,
          price: input.currentPrice,
          effectiveFrom: new Date(),
        },
      });
    }

    return item;
  });
}

// ── 공급 품목 삭제 ──
export async function deleteSupplierItem(id: string) {
  const item = await prisma.supplierItem.findFirst({
    where: { id },
  });

  if (!item) return null;

  return prisma.supplierItem.delete({
    where: { id },
  });
}

// ── 단가 이력 조회 ──
export async function getPriceHistory(supplierItemId: string) {
  return prisma.supplierItemPriceHistory.findMany({
    where: { supplierItemId },
    orderBy: { effectiveFrom: "desc" },
    take: 20,
  });
}
