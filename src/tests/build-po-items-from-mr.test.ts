import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildPOItemsFromMR } from '@/features/purchase-order/lib/build-po-items-from-mr';
import type { InventoryAdapter } from '@/features/purchase-order/lib/inventory-adapter';

// Prisma mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    materialMaster: { findMany: vi.fn() },
    unitConversion: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';

const COMPANY_ID = 'co_1';
const LOCATION_ID = 'loc_1';
const LINE_ID = 'line_1';

function makeMR(overrides: Partial<{
  id: string;
  materialMasterId: string;
  requiredQty: number;
}> = {}) {
  return {
    id: overrides.id ?? 'mr_1',
    materialMasterId: overrides.materialMasterId ?? 'mat_1',
    productionLineId: LINE_ID,
    locationId: LOCATION_ID,
    requiredQty: overrides.requiredQty ?? 19000,
    unit: 'g',
  };
}

function makeMaterial(
  id: string,
  name: string,
  withDefaultSupplier: boolean,
  isActive: boolean = true,
) {
  return {
    id,
    companyId: COMPANY_ID,
    name,
    code: `M-${id}`,
    deletedAt: null,
    isActive,
    defaultSupplierItem: withDefaultSupplier
      ? {
          id: `si_${id}`,
          supplierId: `sup_${id}`,
          productName: `${name} 1박스`,
          currentPrice: 50000,
          supplyUnitQty: 1,            // ★ D17: 1박스 = 1박스 단위. 환산은 UnitConversion 이 g/박스 직접 제공.
          supplier: { id: `sup_${id}`, name: `공급사_${id}` },
          supplyUnit: { id: 'u_box', name: '박스' },
        }
      : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildPOItemsFromMR', () => {
  it('빈 MR 목록 → 빈 결과', async () => {
    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [],
    });
    expect(r.mapped).toHaveLength(0);
    expect(r.unmapped).toHaveLength(0);
    expect(r.summary.totalCount).toBe(0);
  });

  it('즐겨찾기 매핑된 자재 → mapped로 분류, orderQuantity 산출', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '양파', true),
    ]);
    // ★ D17: fromUnit === supplyUnit.name ('박스'), factor=20000 (1박스=20,000g)
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      {
        materialMasterId: 'mat_1',
        subsidiaryMasterId: null,
        fromUnit: '박스',
        toUnit: 'g',
        factor: 20000,
      },
    ]);

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR()],
    });

    expect(r.mapped).toHaveLength(1);
    expect(r.unmapped).toHaveLength(0);
    const item = r.mapped[0];
    expect(item.status).toBe('MAPPED');
    expect(item.materialName).toBe('양파');
    expect(item.fromUnitName).toBe('박스');
    // D17: netRequiredInFromUnit = 공급단위(박스) 기준 raw = 19000/20000 = 0.95
    expect(item.netRequiredInFromUnit).toBeCloseTo(0.95, 5);
    expect(item.orderQuantity).toBe(1); // 0.95 → ceil 1
    expect(item.unitPrice).toBe(50000);
    expect(item.supplierItem?.supplierName).toBe('공급사_mat_1');
    expect(r.summary.estimatedTotalAmount).toBe(50000);
  });

  it('즐겨찾기 없는 자재 → unmapped로 분류', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '마늘', false),
    ]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      { materialMasterId: 'mat_1', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
    ]);

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR({ requiredQty: 2000 })],
    });

    expect(r.mapped).toHaveLength(0);
    expect(r.unmapped).toHaveLength(1);
    const item = r.unmapped[0];
    expect(item.status).toBe('UNMAPPED');
    expect(item.supplierItem).toBeNull();
    expect(item.orderQuantity).toBeNull();
    // D17: 공급업체 없으면 netRequiredInFromUnit 산출 불가
    expect(item.netRequiredInFromUnit).toBeNull();
    expect(item.warnings).toContain('공급업체 품목 미지정');
  });

  it('UnitConversion 미등록 → UNMAPPED로 분류 (D17: g 폴백 폐기)', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '소금', true),
    ]);
    // ★ D17: 환산 행이 없으면 requiresManualInput=true → UNMAPPED
    (prisma.unitConversion.findMany as any).mockResolvedValue([]);

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR({ requiredQty: 5000 })],
    });

    expect(r.mapped).toHaveLength(0);
    expect(r.unmapped).toHaveLength(1);
    const item = r.unmapped[0];
    expect(item.status).toBe('UNMAPPED');
    expect(item.orderQuantity).toBeNull();
    expect(item.warnings.some((w) => w.includes('단위 환산 등록 필요'))).toBe(true);
  });

  it('재고가 전량 활용 → mappedFullStock으로 분류', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '양파', true),
    ]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      { materialMasterId: 'mat_1', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
    ]);

    const stubAdapter: InventoryAdapter = {
      async getStockGByMaterials() {
        return new Map([['mat_1', 50000]]); // 19,000g 필요인데 50,000g 보유
      },
    };

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR()],
      inventoryAdapter: stubAdapter,
    });

    expect(r.mappedFullStock).toHaveLength(1);
    expect(r.mapped).toHaveLength(0);
    expect(r.mappedPartialStock).toHaveLength(0);
    expect(r.mappedFullStock[0].status).toBe('MAPPED_FULL_STOCK');
    expect(r.summary.estimatedTotalAmount).toBe(0);
    // gross(raw) = 0.95 × 50,000 = 47,500원 (재고 차감 전)
    expect(r.summary.stockOffsetAmount).toBe(47500);
    expect(r.summary.mappedGrossAmount).toBe(47500);
  });

  it('재고가 일부 활용 → mappedPartialStock으로 분류 + 순필요량 반영 + raw 기반 offset', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '양파', true),
    ]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      { materialMasterId: 'mat_1', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
    ]);

    const stubAdapter: InventoryAdapter = {
      async getStockGByMaterials() {
        return new Map([['mat_1', 4000]]); // 19000 - 4000 = 15000g
      },
    };

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR()],
      inventoryAdapter: stubAdapter,
    });

    expect(r.mapped).toHaveLength(0);
    expect(r.mappedPartialStock).toHaveLength(1);
    expect(r.mappedFullStock).toHaveLength(0);
    const item = r.mappedPartialStock[0];
    expect(item.status).toBe('MAPPED_PARTIAL_STOCK');
    expect(item.stockQtyG).toBe(4000);
    expect(item.netRequiredG).toBe(15000);
    // D17: netRequiredInFromUnit = 공급단위(박스) 기준 raw = 15000/20000 = 0.75
    expect(item.netRequiredInFromUnit).toBe(0.75);
    expect(item.orderQuantity).toBe(1); // 0.75 → ceil 1
    // raw offset = (0.95 - 0.75) × 50,000 = 10,000원
    expect(r.summary.stockOffsetAmount).toBe(10000);
    expect(r.summary.estimatedTotalAmount).toBe(50000);
    // gross(raw) = 0.95 × 50,000 = 47,500원
    expect(r.summary.mappedGrossAmount).toBe(47500);
  });

  it('자재 마스터 미존재 → unmapped + 자재 정보 없음 경고', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([]);

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR()],
    });

    expect(r.unmapped).toHaveLength(1);
    expect(r.unmapped[0].materialName).toBe('(자재 정보 없음)');
    expect(r.unmapped[0].warnings).toContain('자재 마스터를 찾을 수 없습니다');
  });

  it('여러 자재 혼합 — 매핑/미매핑/재고활용 모두 발생', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '양파', true),    // mapped
      makeMaterial('mat_2', '마늘', false),   // unmapped (즐겨찾기 없음)
      makeMaterial('mat_3', '당근', true),    // full stock
    ]);
    // ★ D17: 모든 자재의 공급단위가 '박스' 이므로 fromUnit='박스' 환산 필요
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      { materialMasterId: 'mat_1', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
      { materialMasterId: 'mat_2', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
      { materialMasterId: 'mat_3', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
    ]);

    const stubAdapter: InventoryAdapter = {
      async getStockGByMaterials(_c, _l, ids) {
        const m = new Map<string, number>();
        for (const id of ids) {
          m.set(id, id === 'mat_3' ? 99999 : 0);
        }
        return m;
      },
    };

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [
        makeMR({ id: 'mr_1', materialMasterId: 'mat_1', requiredQty: 19000 }),
        makeMR({ id: 'mr_2', materialMasterId: 'mat_2', requiredQty: 2000 }),
        makeMR({ id: 'mr_3', materialMasterId: 'mat_3', requiredQty: 3000 }),
      ],
      inventoryAdapter: stubAdapter,
    });

    expect(r.mapped).toHaveLength(1);
    expect(r.unmapped).toHaveLength(1);
    expect(r.mappedFullStock).toHaveLength(1);
    expect(r.mappedPartialStock).toHaveLength(0);
    expect(r.summary.totalCount).toBe(3);
    expect(r.summary.mappedCount).toBe(1);
    expect(r.summary.unmappedCount).toBe(1);
    expect(r.summary.mappedFullStockCount).toBe(1);
    expect(r.summary.mappedPartialStockCount).toBe(0);
  });

  it('재고 조회는 공장별로 1회씩 호출됨 (배치 최적화)', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '양파', true),
      makeMaterial('mat_2', '마늘', true),
    ]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([]);

    const getStockSpy = vi.fn(async () => new Map([['mat_1', 0], ['mat_2', 0]]));
    const stubAdapter: InventoryAdapter = {
      getStockGByMaterials: getStockSpy,
    };

    await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [
        { id: 'mr_1', materialMasterId: 'mat_1', productionLineId: LINE_ID, locationId: LOCATION_ID, requiredQty: 1000, unit: 'g' },
        { id: 'mr_2', materialMasterId: 'mat_2', productionLineId: LINE_ID, locationId: LOCATION_ID, requiredQty: 1000, unit: 'g' },
      ],
      inventoryAdapter: stubAdapter,
    });

    expect(getStockSpy).toHaveBeenCalledTimes(1);
    expect(getStockSpy).toHaveBeenCalledWith(
      COMPANY_ID,
      LOCATION_ID,
      expect.arrayContaining(['mat_1', 'mat_2']),
    );
  });

  it('비활성 자재 → mapped 아닌 unmapped로 분류 + 경고', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '비활성자재', true, false),
    ]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      { materialMasterId: 'mat_1', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
    ]);

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [makeMR()],
    });

    expect(r.mapped).toHaveLength(0);
    expect(r.unmapped).toHaveLength(1);
    const item = r.unmapped[0];
    expect(item.status).toBe('UNMAPPED');
    expect(item.isMaterialActive).toBe(false);
    expect(item.warnings).toContain(
      '비활성 자재 — 활성화 후 진행하거나 대체 자재 선택 필요',
    );
  });

  it('summary — invariant: estimatedTotalAmount ≥ mappedGrossAmount − stockOffsetAmount (박스 올림 차이만큼 ≥)', async () => {
    (prisma.materialMaster.findMany as any).mockResolvedValue([
      makeMaterial('mat_1', '양파', true),
      makeMaterial('mat_2', '마늘', true),
      makeMaterial('mat_3', '당근', true),
    ]);
    (prisma.unitConversion.findMany as any).mockResolvedValue([
      { materialMasterId: 'mat_1', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
      { materialMasterId: 'mat_2', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
      { materialMasterId: 'mat_3', subsidiaryMasterId: null, fromUnit: '박스', toUnit: 'g', factor: 20000 },
    ]);

    const stubAdapter: InventoryAdapter = {
      async getStockGByMaterials(_c, _l, ids) {
        const m = new Map<string, number>();
        for (const id of ids) {
          m.set(id, id === 'mat_1' ? 0 : id === 'mat_2' ? 4000 : 99999);
        }
        return m;
      },
    };

    const r = await buildPOItemsFromMR({
      companyId: COMPANY_ID,
      materialRequirements: [
        makeMR({ id: 'mr_1', materialMasterId: 'mat_1', requiredQty: 19000 }),
        makeMR({ id: 'mr_2', materialMasterId: 'mat_2', requiredQty: 19000 }),
        makeMR({ id: 'mr_3', materialMasterId: 'mat_3', requiredQty: 3000 }),
      ],
      inventoryAdapter: stubAdapter,
    });

    expect(r.summary.stockOffsetAmount).toBeGreaterThanOrEqual(0);
    expect(r.summary.mappedGrossAmount).toBeGreaterThanOrEqual(0);
    expect(r.summary.estimatedTotalAmount).toBeGreaterThanOrEqual(0);
    expect(r.summary.stockOffsetAmount).toBeLessThanOrEqual(
      r.summary.mappedGrossAmount,
    );
    expect(r.summary.estimatedTotalAmount).toBeGreaterThanOrEqual(
      r.summary.mappedGrossAmount - r.summary.stockOffsetAmount,
    );
    expect(Number.isInteger(r.summary.mappedGrossAmount)).toBe(true);
    expect(Number.isInteger(r.summary.stockOffsetAmount)).toBe(true);
    expect(Number.isInteger(r.summary.estimatedTotalAmount)).toBe(true);
  });
});
