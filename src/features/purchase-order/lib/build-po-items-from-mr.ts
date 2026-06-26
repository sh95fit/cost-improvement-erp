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
 * Fix-R1-a (D10): 4분류 도입
 * - MAPPED            : 매핑됨 + 재고 0
 * - MAPPED_PARTIAL_STOCK: 매핑됨 + 재고 일부 활용 (감량 발주)
 * - MAPPED_FULL_STOCK : 매핑됨 + 재고 전량 활용 (발주 0)
 * - UNMAPPED          : 공급업체 미지정 / 자재 비활성 / 자재 정보 없음
 */
export interface POItemCandidate {
  materialRequirementId: string;
  materialMasterId: string;
  materialName: string;
  materialCode: string;
  isMaterialActive: boolean;
  locationId: string;
  productionLineId: string;
  requiredQtyG: number;
  stockQtyG: number;
  netRequiredG: number;
  fromUnitName: string | null;
  netRequiredInFromUnit: number | null;
  /** D19: 현재 자재의 기본 공급업체 품목 ID (체크박스 노출 분기용). 자재 마스터 못 찾으면 null */
  currentDefaultSupplierItemId: string | null;  
  supplierItem: {
    id: string;
    supplierId: string;
    supplierName: string;
    productName: string;
    supplyUnitName: string;
    supplyUnitCode: string;
    supplyUnitQty: number;
    currentPrice: number;
    leadTimeDays: number;
  } | null;
  orderQuantity: number | null;
  orderQuantityRaw: number | null;
  unitPrice: number | null;
  status:
    | 'MAPPED'
    | 'MAPPED_PARTIAL_STOCK'
    | 'MAPPED_FULL_STOCK'
    | 'UNMAPPED';
  warnings: string[];
}

export interface BuildPOItemsResult {
  /** 매핑됨 — 재고 0 → 전량 발주 */
  mapped: POItemCandidate[];
  /** 매핑됨 — 재고 일부 활용 → 감량 발주 */
  mappedPartialStock: POItemCandidate[];
  /** 매핑됨 — 재고 전량 활용 → 발주 불필요 */
  mappedFullStock: POItemCandidate[];
  /** 미매핑 — 공급업체 선택 필요 */
  unmapped: POItemCandidate[];
  /** 합계 (Step 2 카드용) */
  summary: {
    totalCount: number;
    mappedCount: number;
    mappedPartialStockCount: number;
    mappedFullStockCount: number;
    unmappedCount: number;
    /** 매핑 합계 (재고 차감 전 가정) — 매핑된 모든 행에서 currentPrice × baseOrderQty */
    mappedGrossAmount: number;
    /** 재고 활용으로 차감된 금액 — partial/full에서만 발생 (raw 수량 기준) */
    stockOffsetAmount: number;
    /** 실제 예상 발주 금액 = mappedGrossAmount - stockOffsetAmount */
    estimatedTotalAmount: number;
  };
}

export interface BuildPOItemsInput {
  companyId: string;
  materialRequirements: Array<{
    id: string;
    materialMasterId: string;
    productionLineId: string;
    locationId: string;
    requiredQty: number;
    unit: string;
  }>;
  inventoryAdapter?: InventoryAdapter;
}

export async function buildPOItemsFromMR(
  input: BuildPOItemsInput,
): Promise<BuildPOItemsResult> {
  const adapter = input.inventoryAdapter ?? noopInventoryAdapter;
  const mrs = input.materialRequirements;

  if (mrs.length === 0) {
    return {
      mapped: [],
      mappedPartialStock: [],
      mappedFullStock: [],
      unmapped: [],
      summary: {
        totalCount: 0,
        mappedCount: 0,
        mappedPartialStockCount: 0,
        mappedFullStockCount: 0,
        unmappedCount: 0,
        mappedGrossAmount: 0,
        stockOffsetAmount: 0,
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
          supplyUnit: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
  const materialMap = new Map(materials.map((m) => [m.id, m]));

  // 2) UnitConversion 일괄 조회 (D17 — 공급단위 기준 환산)
  //    조회 키: (materialMasterId, fromUnit=supplyUnit.name, toUnit='g')
  //    각 자재의 fromUnit 후보는 defaultSupplierItem.supplyUnit.name 으로 결정.
  //    우선순위: 자재별 환산 → 글로벌 환산(materialMasterId=null AND subsidiaryMasterId=null)
  const supplyUnitByMaterialId = new Map<string, string>();
  for (const m of materials) {
    if (m.defaultSupplierItem?.supplyUnit?.code) {
      // ★ 시스템 단위 참조 규약: UnitMaster.code (UnitConversion.fromUnit, MaterialMaster.unit 등 모두 code)
      supplyUnitByMaterialId.set(m.id, m.defaultSupplierItem.supplyUnit.code);
    }
  }

  // ★ D18 (D-CONV-INDEPENDENT): 자재별 환산은 supplyUnit 후보 유무와 무관하게 전체 조회.
  //    글로벌 환산은 supplyUnit 후보가 있는 경우에만 fromUnit 필터.
  const distinctFromUnits = Array.from(new Set(supplyUnitByMaterialId.values()));
  const unitConversions = await prisma.unitConversion.findMany({
    where: {
      companyId: input.companyId,
      toUnit: 'g',
      OR: [
        // 자재별 환산 — fromUnit 제약 없음 (자재 차원 마스터 데이터)
        { materialMasterId: { in: materialIds } },
        // 글로벌 환산 — supplyUnit 후보가 있을 때만
        ...(distinctFromUnits.length > 0
          ? [
              {
                materialMasterId: null,
                subsidiaryMasterId: null,
                fromUnit: { in: distinctFromUnits },
              },
            ]
          : []),
      ],
    },
  });

  // key: `${materialId}:${fromUnit}` (자재별) / `${fromUnit}` (글로벌)
  const materialConvMap = new Map<string, { fromUnit: string; factor: number }>();
  const globalConvMap = new Map<string, { fromUnit: string; factor: number }>();
  for (const uc of unitConversions) {
    if (uc.materialMasterId) {
      materialConvMap.set(`${uc.materialMasterId}:${uc.fromUnit}`, {
        fromUnit: uc.fromUnit,
        factor: uc.factor,
      });
    } else if (uc.subsidiaryMasterId === null) {
      globalConvMap.set(uc.fromUnit, {
        fromUnit: uc.fromUnit,
        factor: uc.factor,
      });
    }
  }

  /**
   * ★ D18 (D-CONV-INDEPENDENT): 자재 차원으로 환산을 조회한다.
   * SupplierItem 존재 여부와 무관하게 다음 순서로 후보를 찾는다.
   *   1순위: candidateFromUnit 으로 자재별 → 글로벌 정확 매칭
   *   2순위: 자재별 환산 중 'g' 가 아닌 첫 항목 (SupplierItem 미매핑 행도 환산 적용 가능)
   *   candidateFromUnit === 'g' 이면 환산 불필요 → null
   */
  function resolveConversion(
    materialId: string,
    candidateFromUnit: string | null,
  ): { fromUnit: string; factor: number } | null {
    if (candidateFromUnit === 'g') return null;

    if (candidateFromUnit) {
      const exact =
        materialConvMap.get(`${materialId}:${candidateFromUnit}`) ??
        globalConvMap.get(candidateFromUnit);
      if (exact) return exact;
    }

    // 자재별 환산 중 'g' 가 아닌 첫 항목 (미매핑 행에서도 표시 가능)
    for (const [key, conv] of materialConvMap.entries()) {
      if (key.startsWith(`${materialId}:`) && conv.fromUnit !== 'g') {
        return conv;
      }
    }
    return null;
  }

  // 3) 공장별 재고 일괄 조회
  const locationToMaterials = new Map<string, Set<string>>();
  for (const mr of mrs) {
    if (!locationToMaterials.has(mr.locationId)) {
      locationToMaterials.set(mr.locationId, new Set());
    }
    locationToMaterials.get(mr.locationId)!.add(mr.materialMasterId);
  }
  const stockMap = new Map<string, number>();
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
  const mappedPartialStock: POItemCandidate[] = [];
  const mappedFullStock: POItemCandidate[] = [];
  const unmapped: POItemCandidate[] = [];
  let mappedGrossAmount = 0;
  let stockOffsetAmount = 0;
  let estimatedTotalAmount = 0;

  for (const mr of mrs) {
    const material = materialMap.get(mr.materialMasterId);
    if (!material) {
      unmapped.push({
        materialRequirementId: mr.id,
        materialMasterId: mr.materialMasterId,
        materialName: '(자재 정보 없음)',
        materialCode: '-',
        isMaterialActive: false,
        locationId: mr.locationId,
        productionLineId: mr.productionLineId,
        requiredQtyG: mr.requiredQty,
        stockQtyG: 0,
        netRequiredG: mr.requiredQty,
        fromUnitName: null,
        netRequiredInFromUnit: null,
        currentDefaultSupplierItemId: null,        
        supplierItem: null,
        orderQuantity: null,
        orderQuantityRaw: null,
        unitPrice: null,
        status: 'UNMAPPED',
        warnings: ['자재 마스터를 찾을 수 없습니다'],
      });
      continue;
    }

    // ★ D18: SupplierItem.supplyUnit.code 를 후보로 전달 (없으면 null → 자재별 fallback)
    const conv = resolveConversion(
      mr.materialMasterId,
      material.defaultSupplierItem?.supplyUnit?.code ?? null,
    );
    const stockG = stockMap.get(`${mr.locationId}:${mr.materialMasterId}`) ?? 0;
    const dsi = material.defaultSupplierItem;
    const supplierItemInput = dsi
    ? {
        // ★ calculateOrderQuantity는 code 기준으로 fromUnit과 비교
        supplyUnitName: dsi.supplyUnit.code,
        supplyUnitQty: dsi.supplyUnitQty,
      }
    : null;

    // 재고 차감 후 (실제 발주)
    const calcNet: CalculateOrderQuantityResult = calculateOrderQuantity({
      requiredQtyG: mr.requiredQty,
      stockQtyG: stockG,
      unitConversion: conv,
      supplierItem: supplierItemInput,
    });

    // 재고 차감 전 (gross — Step 2 카드 차감 표시용)
    const calcGross: CalculateOrderQuantityResult = calculateOrderQuantity({
      requiredQtyG: mr.requiredQty,
      stockQtyG: 0,
      unitConversion: conv,
      supplierItem: supplierItemInput,
    });

    // ★ D18: SupplierItem 미매핑이지만 자재 차원 환산이 있으면 환산전 단위 표시
    const previewNetRequiredInFromUnit =
      calcNet.netRequiredInFromUnit ??
      (conv && conv.factor > 0 ? calcNet.netRequiredG / conv.factor : null);

    const candidate: POItemCandidate = {
      materialRequirementId: mr.id,
      materialMasterId: mr.materialMasterId,
      materialName: material.name,
      materialCode: material.code,
      isMaterialActive: material.isActive,
      locationId: mr.locationId,
      productionLineId: mr.productionLineId,
      requiredQtyG: mr.requiredQty,
      stockQtyG: stockG,
      netRequiredG: calcNet.netRequiredG,
      fromUnitName: conv?.fromUnit ?? dsi?.supplyUnit.code ?? null,
      netRequiredInFromUnit: previewNetRequiredInFromUnit,
      currentDefaultSupplierItemId: material.defaultSupplierItem?.id ?? null,      
      supplierItem: dsi
        ? {
            id: dsi.id,
            supplierId: dsi.supplierId,
            supplierName: dsi.supplier.name,
            productName: dsi.productName,
            supplyUnitName: dsi.supplyUnit.name,
            supplyUnitCode: dsi.supplyUnit.code,
            supplyUnitQty: dsi.supplyUnitQty,
            currentPrice: dsi.currentPrice,
            leadTimeDays: dsi.leadTimeDays,
          }
        : null,
      orderQuantity: calcNet.orderQuantity,
      orderQuantityRaw: calcNet.orderQuantityRaw,
      unitPrice: dsi ? dsi.currentPrice : null,
      status: 'UNMAPPED',
      warnings: [
        ...calcNet.warnings,
        ...(material.isActive
          ? []
          : ['비활성 자재 — 활성화 후 진행하거나 대체 자재 선택 필요']),
      ],
    };

    // ── 분류 ──
    // (1) 매핑 불가 (자재 비활성 / 즐겨찾기 없음 / 수동 입력 필요)
    if (
      !dsi ||
      calcNet.requiresManualInput ||
      calcNet.orderQuantity === null ||
      !material.isActive
    ) {
      candidate.status = 'UNMAPPED';
      unmapped.push(candidate);
      continue;
    }

    // 이하 매핑된 케이스 — 재고 활용 정도로 세분
    //
    // ★ R1-a-fix: stockOffsetAmount 는 박스 올림 전(raw 수량) 기준으로 계산한다.
    //   이유: 발주 수량은 박스 단위로 올림되므로 (예: 0.95박스 → 1박스, 0.75박스 → 1박스),
    //   gross/net 양쪽 다 올림된 박스 수량으로 차이를 계산하면 0이 나와 의미가 소실된다.
    //   사용자에게 "재고 활용으로 얼마만큼 차감되었는지" 보여주는 게 본래 목적이므로
    //   raw 수량 × 단가로 계산한다.
    //   estimatedTotalAmount 는 실제 발주 금액(박스 올림 후)을 유지한다.
    const grossOrderRaw = calcGross.orderQuantityRaw ?? 0;
    const netOrderRaw = calcNet.orderQuantityRaw ?? 0;
    const netOrder = calcNet.orderQuantity ?? 0;
    // ★ R1-a-fix-2: 금액은 원(KRW) 단위 — 정수로 반올림하여 부동소수점 오차 누적 방지
    const grossAmtRaw = Math.round(grossOrderRaw * dsi.currentPrice);
    const netAmt = Math.round(netOrder * dsi.currentPrice);
    const offsetAmt = Math.max(
      0,
      Math.round((grossOrderRaw - netOrderRaw) * dsi.currentPrice),
    );

    if (stockG <= 0) {
      // 재고 없음 — 일반 mapped
      candidate.status = 'MAPPED';
      mapped.push(candidate);
      mappedGrossAmount += grossAmtRaw;
      estimatedTotalAmount += netAmt;
    } else if (netOrder === 0) {
      // 재고가 전량 활용
      candidate.status = 'MAPPED_FULL_STOCK';
      mappedFullStock.push(candidate);
      mappedGrossAmount += grossAmtRaw;
      stockOffsetAmount += grossAmtRaw; // 전량 차감 (raw 기준)
    } else {
      // 재고 일부 활용
      candidate.status = 'MAPPED_PARTIAL_STOCK';
      mappedPartialStock.push(candidate);
      mappedGrossAmount += grossAmtRaw;
      stockOffsetAmount += offsetAmt;
      estimatedTotalAmount += netAmt;
    }
  }

  return {
    mapped,
    mappedPartialStock,
    mappedFullStock,
    unmapped,
    summary: {
      totalCount: mrs.length,
      mappedCount: mapped.length,
      mappedPartialStockCount: mappedPartialStock.length,
      mappedFullStockCount: mappedFullStock.length,
      unmappedCount: unmapped.length,
      mappedGrossAmount,
      stockOffsetAmount,
      estimatedTotalAmount,
    },
  };
}