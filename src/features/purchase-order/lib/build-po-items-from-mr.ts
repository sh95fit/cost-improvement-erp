import { prisma } from '@/lib/prisma';
import {
  calculateOrderQuantity,
  type CalculateOrderQuantityResult,
} from './unit-conversion';
import {
  noopInventoryAdapter,
  type InventoryAdapter,
} from './inventory-adapter';

/**
 * 발주 후보 항목 1건
 *
 * UI Step 3 테이블의 한 행에 매핑됨.
 * - 매핑됨(MAPPED): supplierItem 채워짐 + orderQuantity 산출됨
 * - 미매핑(UNMAPPED): supplierItem=null, orderQuantity=null
 */
export interface POItemCandidate {
  /** MR 행 ID (1:1 추적용) */
  materialRequirementId: string;
  /** 자재 마스터 정보 */
  materialMasterId: string;
  materialName: string;
  materialCode: string;
  /** ★ M-Fix-R1: 자재 활성 여부 (false면 위저드에서 경고) */
  isMaterialActive: boolean;
  /** 공장/라인 */
  locationId: string;
  productionLineId: string;
  /** 필요량 (g) */
  requiredQtyG: number;
  /** 현재 재고 (g) — placeholder 0 */
  stockQtyG: number;
  /** 순필요량 (g) = max(0, required - stock) */
  netRequiredG: number;
  /** 환산전 단위 표시 */
  fromUnitName: string | null;
  netRequiredInFromUnit: number | null;
  /** 매핑된 공급업체 품목 (즐겨찾기) — 없으면 null */
  supplierItem: {
    id: string;
    supplierId: string;
    supplierName: string;
    productName: string;
    supplyUnitName: string;
    supplyUnitQty: number;
    currentPrice: number;
  } | null;
  /** 발주 단위 수량 (ceil 적용) — 미매핑 시 null */
  orderQuantity: number | null;
  /** 발주 단위 수량 (소수 원시값) */
  orderQuantityRaw: number | null;
  /** UI 행 단위 가격 (currentPrice 자동 채움, 사용자 편집 가능) */
  unitPrice: number | null;
  /** 매핑 상태 */
  status: 'MAPPED' | 'UNMAPPED' | 'NO_ORDER_NEEDED';
  /** 경고/안내 메시지 */
  warnings: string[];
}

export interface BuildPOItemsResult {
  /** 매핑됨 — 즐겨찾기로 자동 매핑된 항목 */
  mapped: POItemCandidate[];
  /** 미매핑 — 공급업체 선택 필요 */
  unmapped: POItemCandidate[];
  /** 재고 충당으로 발주 불필요한 항목 */
  noOrderNeeded: POItemCandidate[];
  /** 전체 합계 (집계용) */
  summary: {
    totalCount: number;
    mappedCount: number;
    unmappedCount: number;
    noOrderNeededCount: number;
    estimatedTotalAmount: number; // 매핑된 행만 합산
  };
}

export interface BuildPOItemsInput {
  companyId: string;
  /** MR 목록 (이미 조회된 상태로 전달 — 보통 MaterialRequirement[]) */
  materialRequirements: Array<{
    id: string;
    materialMasterId: string;
    productionLineId: string;
    locationId: string;
    requiredQty: number;
    unit: string;
  }>;
  /** 재고 어댑터 (기본: noopInventoryAdapter) */
  inventoryAdapter?: InventoryAdapter;
}

/**
 * MR 목록을 받아 위저드 Step 3에 표시할 발주 후보 항목을 생성
 *
 * 흐름:
 *   1) MR 목록 → 자재 ID 추출 → MaterialMaster + defaultSupplierItem(+supplier+supplyUnit) 일괄 조회
 *   2) UnitConversion 일괄 조회 (자재별 fromUnit→g 환산 정보)
 *   3) 공장별로 그룹화하여 재고 일괄 조회
 *   4) 각 MR에 대해 calculateOrderQuantity() 호출
 *   5) 매핑됨/미매핑/발주불필요 3그룹으로 분류
 */
export async function buildPOItemsFromMR(
  input: BuildPOItemsInput,
): Promise<BuildPOItemsResult> {
  const adapter = input.inventoryAdapter ?? noopInventoryAdapter;
  const mrs = input.materialRequirements;

  if (mrs.length === 0) {
    return {
      mapped: [],
      unmapped: [],
      noOrderNeeded: [],
      summary: {
        totalCount: 0,
        mappedCount: 0,
        unmappedCount: 0,
        noOrderNeededCount: 0,
        estimatedTotalAmount: 0,
      },
    };
  }

  // 1) MaterialMaster + 즐겨찾기 SupplierItem 일괄 조회
  const materialIds = Array.from(new Set(mrs.map((m) => m.materialMasterId)));
  const materials = await prisma.materialMaster.findMany({
    where: {
      id: { in: materialIds },
      companyId: input.companyId,
      deletedAt: null,
    },
    include: {
      defaultSupplierItem: {
        include: {
          supplier: { select: { id: true, name: true } },
          supplyUnit: { select: { id: true, name: true } },
        },
      },
    },
  });
  const materialMap = new Map(materials.map((m) => [m.id, m]));

  // 2) UnitConversion 일괄 조회 (자재별 단위 환산 정보)
  //    자재의 unit(=환산전 단위) → "g" 환산 정보를 찾음
  const unitConversions = await prisma.unitConversion.findMany({
    where: {
      companyId: input.companyId,
      materialMasterId: { in: materialIds },
      toUnit: 'g',
    },
  });
  const conversionMap = new Map<string, { fromUnit: string; factor: number }>();
  for (const uc of unitConversions) {
    if (uc.materialMasterId) {
      conversionMap.set(uc.materialMasterId, {
        fromUnit: uc.fromUnit,
        factor: uc.factor,
      });
    }
  }

  // 3) 공장별 재고 일괄 조회
  const locationToMaterials = new Map<string, Set<string>>();
  for (const mr of mrs) {
    if (!locationToMaterials.has(mr.locationId)) {
      locationToMaterials.set(mr.locationId, new Set());
    }
    locationToMaterials.get(mr.locationId)!.add(mr.materialMasterId);
  }
  const stockMap = new Map<string, number>(); // key: `${locationId}:${materialId}`
  for (const [locationId, mIds] of locationToMaterials) {
    const partial = await adapter.getStockGByMaterials(
      input.companyId,
      locationId,
      Array.from(mIds),
    );
    for (const [mId, qty] of partial) {
      stockMap.set(`${locationId}:${mId}`, qty);
    }
  }

  // 4) 각 MR 처리
  const mapped: POItemCandidate[] = [];
  const unmapped: POItemCandidate[] = [];
  const noOrderNeeded: POItemCandidate[] = [];
  let estimatedTotalAmount = 0;

  for (const mr of mrs) {
    const material = materialMap.get(mr.materialMasterId);
    if (!material) {
      // 자재가 삭제됐거나 다른 회사 — 미매핑으로 분류
      unmapped.push({
        materialRequirementId: mr.id,
        materialMasterId: mr.materialMasterId,
        materialName: '(자재 정보 없음)',
        materialCode: '-',
        isMaterialActive: false,        // ★ M-Fix-R1
        locationId: mr.locationId,
        productionLineId: mr.productionLineId,
        requiredQtyG: mr.requiredQty,
        stockQtyG: 0,
        netRequiredG: mr.requiredQty,
        fromUnitName: null,
        netRequiredInFromUnit: null,
        supplierItem: null,
        orderQuantity: null,
        orderQuantityRaw: null,
        unitPrice: null,
        status: 'UNMAPPED',
        warnings: ['자재 마스터를 찾을 수 없습니다'],
      });
      continue;
    }

    const conv = conversionMap.get(mr.materialMasterId) ?? null;
    const stockG = stockMap.get(`${mr.locationId}:${mr.materialMasterId}`) ?? 0;
    const dsi = material.defaultSupplierItem;
    const supplierItemInput = dsi
      ? {
          supplyUnitName: dsi.supplyUnit.name,
          conversionFactor: dsi.supplyUnitQty,
        }
      : null;

    const calc: CalculateOrderQuantityResult = calculateOrderQuantity({
      requiredQtyG: mr.requiredQty,
      stockQtyG: stockG,
      unitConversion: conv,
      supplierItem: supplierItemInput,
    });

    const candidate: POItemCandidate = {
      materialRequirementId: mr.id,
      materialMasterId: mr.materialMasterId,
      materialName: material.name,
      materialCode: material.code,
      isMaterialActive: material.isActive,  // ★ M-Fix-R1
      locationId: mr.locationId,
      productionLineId: mr.productionLineId,
      requiredQtyG: mr.requiredQty,
      stockQtyG: stockG,
      netRequiredG: calc.netRequiredG,
      fromUnitName: conv?.fromUnit ?? null,
      netRequiredInFromUnit: calc.netRequiredInFromUnit,
      supplierItem: dsi
        ? {
            id: dsi.id,
            supplierId: dsi.supplierId,
            supplierName: dsi.supplier.name,
            productName: dsi.productName,
            supplyUnitName: dsi.supplyUnit.name,
            supplyUnitQty: dsi.supplyUnitQty,
            currentPrice: dsi.currentPrice,
          }
        : null,
      orderQuantity: calc.orderQuantity,
      orderQuantityRaw: calc.orderQuantityRaw,
      unitPrice: dsi ? dsi.currentPrice : null,
      status: 'UNMAPPED',
      warnings: [
        ...calc.warnings,
        ...(material.isActive ? [] : ['비활성 자재 — 활성화 후 진행하거나 대체 자재 선택 필요']),  // ★ M-Fix-R1
      ],
    };

    // 분류
    if (calc.netRequiredG === 0 && calc.orderQuantity === 0) {
      candidate.status = 'NO_ORDER_NEEDED';
      noOrderNeeded.push(candidate);
    } else if (dsi && !calc.requiresManualInput && calc.orderQuantity !== null && material.isActive) {
      candidate.status = 'MAPPED';
      mapped.push(candidate);
      estimatedTotalAmount += calc.orderQuantity * dsi.currentPrice;
    } else {
      candidate.status = 'UNMAPPED';
      unmapped.push(candidate);
    }
  }

  return {
    mapped,
    unmapped,
    noOrderNeeded,
    summary: {
      totalCount: mrs.length,
      mappedCount: mapped.length,
      unmappedCount: unmapped.length,
      noOrderNeededCount: noOrderNeeded.length,
      estimatedTotalAmount,
    },
  };
}
