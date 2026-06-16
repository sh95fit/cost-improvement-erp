import { describe, expect, it } from 'vitest';
import {
  calculateOrderQuantity,
  type CalculateOrderQuantityInput,
} from '@/features/purchase-order/lib/unit-conversion';

const defaults: CalculateOrderQuantityInput = {
  requiredQtyG: 19000,
  stockQtyG: 0,
  unitConversion: { fromUnit: '포', factor: 1000 },
  supplierItem: { supplyUnitName: '박스', conversionFactor: 20 },
};

describe('calculateOrderQuantity', () => {
  // ---- 정상 시나리오 ----
  describe('정상 케이스', () => {
    it('가이드 예시: 19,000g / 포(1000) / 박스(20) → 1박스', () => {
      const r = calculateOrderQuantity(defaults);
      expect(r.netRequiredG).toBe(19000);
      expect(r.netRequiredInFromUnit).toBe(19);
      expect(r.orderQuantityRaw).toBeCloseTo(0.95, 5);
      expect(r.orderQuantity).toBe(1);
      expect(r.requiresManualInput).toBe(false);
      expect(r.warnings).toHaveLength(0);
    });

    it('필요량이 정확히 1박스에 일치 (20,000g) → 1박스 (ceil 영향 없음)', () => {
      const r = calculateOrderQuantity({ ...defaults, requiredQtyG: 20000 });
      expect(r.orderQuantityRaw).toBe(1);
      expect(r.orderQuantity).toBe(1);
    });

    it('필요량이 1박스 초과 (20,001g) → 2박스', () => {
      const r = calculateOrderQuantity({ ...defaults, requiredQtyG: 20001 });
      expect(r.orderQuantity).toBe(2);
    });

    it('kg 단위 (factor 1000) — 5kg 필요 시 5포 → 1박스(20포 기준)', () => {
      const r = calculateOrderQuantity({
        requiredQtyG: 5000,
        stockQtyG: 0,
        unitConversion: { fromUnit: 'kg', factor: 1000 },
        supplierItem: { supplyUnitName: '박스', conversionFactor: 20 },
      });
      expect(r.netRequiredInFromUnit).toBe(5);
      expect(r.orderQuantity).toBe(1);
    });
  });

  // ---- 재고 반영 ----
  describe('재고 반영', () => {
    it('재고가 필요량 일부를 충당 (필요 19000, 재고 4000 → 순 15000g)', () => {
      const r = calculateOrderQuantity({ ...defaults, stockQtyG: 4000 });
      expect(r.netRequiredG).toBe(15000);
      expect(r.netRequiredInFromUnit).toBe(15);
      expect(r.orderQuantityRaw).toBe(0.75);
      expect(r.orderQuantity).toBe(1);
    });

    it('재고가 필요량을 초과 (필요 19000, 재고 25000) → 발주 불필요', () => {
      const r = calculateOrderQuantity({ ...defaults, stockQtyG: 25000 });
      expect(r.netRequiredG).toBe(0);
      expect(r.orderQuantity).toBe(0);
      expect(r.warnings).toContain('재고로 충당 가능 (발주 불필요)');
    });

    it('재고가 필요량과 정확히 일치 → 발주 불필요', () => {
      const r = calculateOrderQuantity({ ...defaults, stockQtyG: 19000 });
      expect(r.netRequiredG).toBe(0);
      expect(r.orderQuantity).toBe(0);
    });

    it('재고 음수 입력은 0으로 처리', () => {
      const r = calculateOrderQuantity({ ...defaults, stockQtyG: -500 });
      expect(r.netRequiredG).toBe(19000);
    });
  });

  // ---- 미매핑/누락 케이스 ----
  describe('미매핑 / 정보 누락', () => {
    it('공급업체 미매핑 — 환산전 단위까지만 산출, requiresManualInput=true', () => {
      const r = calculateOrderQuantity({ ...defaults, supplierItem: null });
      expect(r.netRequiredInFromUnit).toBe(19);
      expect(r.orderQuantity).toBeNull();
      expect(r.requiresManualInput).toBe(true);
      expect(r.warnings).toContain('공급업체 품목 미지정');
    });

    it('단위 환산 미등록 — g 자체를 단위로 처리, 경고 부착', () => {
      const r = calculateOrderQuantity({
        ...defaults,
        unitConversion: null,
        supplierItem: { supplyUnitName: '봉', conversionFactor: 1000 },
      });
      expect(r.netRequiredInFromUnit).toBe(19000);
      expect(r.orderQuantityRaw).toBe(19);
      expect(r.orderQuantity).toBe(19);
      expect(r.warnings).toContain('단위 환산 정보 미등록 (g 단위로 처리)');
    });

    it('공급업체 계수 0 — 1로 간주 + 경고', () => {
      const r = calculateOrderQuantity({
        ...defaults,
        supplierItem: { supplyUnitName: '박스', conversionFactor: 0 },
      });
      expect(r.orderQuantity).toBe(19);
      expect(r.warnings).toContain('공급업체 계수가 0 또는 미입력 (1로 간주)');
    });

    it('UnitConversion 계수 0 → requiresManualInput=true', () => {
      const r = calculateOrderQuantity({
        ...defaults,
        unitConversion: { fromUnit: '포', factor: 0 },
      });
      expect(r.requiresManualInput).toBe(true);
      expect(r.orderQuantity).toBeNull();
      expect(r.warnings).toContain('단위 환산 계수가 0 또는 음수입니다');
    });
  });

  // ---- 경계값 ----
  describe('경계값 / 에러 입력', () => {
    it('필요량 0 → 발주 0', () => {
      const r = calculateOrderQuantity({ ...defaults, requiredQtyG: 0 });
      expect(r.orderQuantity).toBe(0);
    });

    it('필요량 음수 → requiresManualInput=true', () => {
      const r = calculateOrderQuantity({ ...defaults, requiredQtyG: -100 });
      expect(r.requiresManualInput).toBe(true);
      expect(r.warnings).toContain('필요량이 올바르지 않습니다');
    });

    it('필요량 NaN → requiresManualInput=true', () => {
      const r = calculateOrderQuantity({ ...defaults, requiredQtyG: NaN });
      expect(r.requiresManualInput).toBe(true);
    });

    it('소수 부동소수점 오차 영향 없음 (10000g / 1000 / 10 = 정확히 1박스)', () => {
      const r = calculateOrderQuantity({
        requiredQtyG: 10000,
        stockQtyG: 0,
        unitConversion: { fromUnit: '포', factor: 1000 },
        supplierItem: { supplyUnitName: '박스', conversionFactor: 10 },
      });
      // 10/10 = 1.0 — EPSILON 보정으로 2가 되면 안 됨
      expect(r.orderQuantity).toBe(1);
    });
  });
});
