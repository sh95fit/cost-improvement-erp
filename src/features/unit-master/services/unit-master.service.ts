import { prisma } from "@/lib/prisma";
import type {
  CreateUnitMasterInput,
  UpdateUnitMasterInput,
  UnitMasterListQuery,
} from "../schemas/unit-master.schema";
import type { ItemType } from "@prisma/client";

// ── 목록 조회 ──
export async function getUnitMasters(
  companyId: string,
  query: UnitMasterListQuery
) {
  const { page, limit, itemType, unitCategory } = query;
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    itemType,
    ...(unitCategory && { unitCategory }),
  };

  const [items, total] = await Promise.all([
    prisma.unitMaster.findMany({
      where,
      orderBy: [{ unitCategory: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      skip,
      take: limit,
    }),
    prisma.unitMaster.count({ where }),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── 단건 조회 ──
export async function getUnitMasterById(id: string) {
  return prisma.unitMaster.findFirst({ where: { id } });
}

// ── 생성 ──
export async function createUnitMaster(
  companyId: string,
  input: CreateUnitMasterInput
) {
  return prisma.unitMaster.create({
    data: { companyId, ...input },
  });
}

// ── 수정 ──
export async function updateUnitMaster(
  id: string,
  input: UpdateUnitMasterInput
) {
  return prisma.unitMaster.update({
    where: { id },
    data: input,
  });
}

// ── 삭제 (사용 중 삭제 방지) ──
export async function deleteUnitMaster(companyId: string, id: string) {
  const unit = await prisma.unitMaster.findFirst({ where: { id, companyId } });
  if (!unit) throw new Error("NOT_FOUND");

  // 시스템 기본 단위는 삭제 불가
  if (unit.isSystem) throw new Error("SYSTEM_UNIT_CANNOT_DELETE");

  // 사용 중 검사
  const usages = await checkUnitUsage(companyId, unit.code, unit.itemType);
  if (usages.length > 0) {
    const error = new Error("UNIT_IN_USE");
    (error as Error & { usages: string[] }).usages = usages;
    throw error;
  }

  return prisma.unitMaster.delete({ where: { id } });
}

// ── 사용 중 검사 ──
async function checkUnitUsage(
  companyId: string,
  unitCode: string,
  itemType: ItemType
): Promise<string[]> {
  const usages: string[] = [];

  if (itemType === "MATERIAL") {
    // MaterialMaster.unit
    const materialCount = await prisma.materialMaster.count({
      where: { companyId, unit: unitCode, deletedAt: null },
    });
    if (materialCount > 0) usages.push(`자재 ${materialCount}건에서 사용 중`);

    // UnitConversion (자재용) fromUnit/toUnit
    const convCount = await prisma.unitConversion.count({
      where: {
        companyId,
        subsidiaryMasterId: null,
        OR: [{ fromUnit: unitCode }, { toUnit: unitCode }],
      },
    });
    if (convCount > 0) usages.push(`단위 환산 ${convCount}건에서 사용 중`);

    // SupplierItem.supplyUnit (MATERIAL 타입)
    const siCount = await prisma.supplierItem.count({
      where: {
        supplier: { companyId },
        itemType: "MATERIAL",
        supplyUnit: unitCode,
      },
    });
    if (siCount > 0) usages.push(`공급 품목 ${siCount}건에서 사용 중`);

    // BOMItem.unit
    const bomItemCount = await prisma.bOMItem.count({
      where: { bom: { companyId }, unit: unitCode },
    });
    if (bomItemCount > 0) usages.push(`BOM 항목 ${bomItemCount}건에서 사용 중`);

  } else {
    // SubsidiaryMaster.unit
    const subCount = await prisma.subsidiaryMaster.count({
      where: { companyId, unit: unitCode, deletedAt: null },
    });
    if (subCount > 0) usages.push(`부자재 ${subCount}건에서 사용 중`);

    // UnitConversion (부자재용) fromUnit/toUnit
    const convCount = await prisma.unitConversion.count({
      where: {
        companyId,
        subsidiaryMasterId: { not: null },
        OR: [{ fromUnit: unitCode }, { toUnit: unitCode }],
      },
    });
    if (convCount > 0) usages.push(`단위 환산 ${convCount}건에서 사용 중`);

    // SupplierItem.supplyUnit (SUBSIDIARY 타입)
    const siCount = await prisma.supplierItem.count({
      where: {
        supplier: { companyId },
        itemType: "SUBSIDIARY",
        supplyUnit: unitCode,
      },
    });
    if (siCount > 0) usages.push(`공급 품목 ${siCount}건에서 사용 중`);
  }

  return usages;
}

// ── 카테고리별 단위 목록 (Select Box용) ──
export async function getUnitOptionsByItemType(
  companyId: string,
  itemType: ItemType
) {
  return prisma.unitMaster.findMany({
    where: { companyId, itemType },
    orderBy: [{ unitCategory: "asc" }, { sortOrder: "asc" }],
    select: { id: true, code: true, name: true, unitCategory: true },
  });
}
