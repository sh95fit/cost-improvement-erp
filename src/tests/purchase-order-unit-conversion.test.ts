import { describe, expect, it } from 'vitest';
import {
  calculateOrderQuantity,
  type CalculateOrderQuantityInput,
} from '@/features/purchase-order/lib/unit-conversion';

// ★ D17 (2026-06-22): fromUnit === supplyUnitName 강제.
//   기존 D3 의 2단계 체인(포→g, 박스 20포/박스) 은
//   공급단위 = 박스 의 직접 환산(박스 → 20000g)으로 표현한다.
const defaults: CalculateOrderQuantityInput = {
  requiredQtyG: 19000,
  stockQtyG: 0,
  unitConversion: { fromUnit: '박스', factor: 20000 }, // 1박스 = 20,000g
  supplierItem: { supplyUnitName: '박스', supplyUnitQty: 1 },
};

describe('calculateOrderQuantity', () => {
  // ---- 정상 시나리오 ----
  describe('정상 케이스', () => {
    it('가이드 예시: 19,000g / 박스(20,000g) → 1박스', () => {
      const r = calculateOrderQuantity(defaults);
      expect(r.netRequiredG).toBe(19000);
      // D17: netRequiredInFromUnit = 공급단위(박스) 기준 raw = 0.95
      expect(r.netRequiredInFromUnit).toBeCloseTo(0.95, 5);
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

    it('kg 단위 직접 환산 — 5kg 필요, 1박스=1kg → 5박스', () => {
      // D17: fromUnit === supplyUnitName 강제.
      // 기존 "kg → 5포 → 1박스(20포/박스)" 시나리오 대신,
      // "1박스=1000g(=1kg)" 직접 환산으로 5박스 케이스 검증.
      const r = calculateOrderQuantity({
        requiredQtyG: 5000,
        stockQtyG: 0,
        unitConversion: { fromUnit: '박스', factor: 1000 },
        supplierItem: { supplyUnitName: '박스', supplyUnitQty: 1 },
      });
      expect(r.netRequiredInFromUnit).toBe(5);
      expect(r.orderQuantity).toBe(5);
    });
  });

  // ---- 재고 반영 ----
  describe('재고 반영', () => {
    it('재고가 필요량 일부를 충당 (필요 19000, 재고 4000 → 순 15000g)', () => {
      const r = calculateOrderQuantity({ ...defaults, stockQtyG: 4000 });
      expect(r.netRequiredG).toBe(15000);
      // D17: netRequiredInFromUnit = 공급단위(박스) 기준 raw = 15000/20000 = 0.75
      expect(r.netRequiredInFromUnit).toBe(0.75);
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
    it('공급업체 미매핑 → requiresManualInput=true (D17: 환산도 진행 불가)', () => {
      const r = calculateOrderQuantity({ ...defaults, supplierItem: null });
      // D17: 공급업체 없으면 netRequiredInFromUnit 도 산출 불가 (공급단위 미정)
      expect(r.netRequiredInFromUnit).toBeNull();
      expect(r.orderQuantity).toBeNull();
      expect(r.requiresManualInput).toBe(true);
      expect(r.warnings).toContain('공급업체 품목 미지정');
    });

    it('단위 환산 미등록 → requiresManualInput=true (D17: g 폴백 폐기)', () => {
      const r = calculateOrderQuantity({
        ...defaults,
        unitConversion: null,
        supplierItem: { supplyUnitName: '봉', supplyUnitQty: 1 },
      });
      expect(r.requiresManualInput).toBe(true);
      expect(r.orderQuantity).toBeNull();
      expect(r.warnings.some((w) => w.includes('단위 환산 등록 필요'))).toBe(true);
    });

    it('supplyUnitQty 0 → requiresManualInput=true (D17: 1 fallback 폐기)', () => {
      const r = calculateOrderQuantity({
        ...defaults,
        supplierItem: { supplyUnitName: '박스', supplyUnitQty: 0 },
      });
      expect(r.requiresManualInput).toBe(true);
      expect(r.orderQuantity).toBeNull();
      expect(r.warnings).toContain('공급단위 계수(supplyUnitQty)가 0 또는 미입력');
    });

    it('UnitConversion 계수 0 → requiresManualInput=true', () => {
      const r = calculateOrderQuantity({
        ...defaults,
        unitConversion: { fromUnit: '박스', factor: 0 },
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

    it('소수 부동소수점 오차 영향 없음 (10000g / 박스 10000g = 정확히 1박스)', () => {
      const r = calculateOrderQuantity({
        requiredQtyG: 10000,
        stockQtyG: 0,
        unitConversion: { fromUnit: '박스', factor: 10000 },
        supplierItem: { supplyUnitName: '박스', supplyUnitQty: 1 },
      });
      // 10000/10000 = 1.0 — EPSILON 보정으로 2가 되면 안 됨
      expect(r.orderQuantity).toBe(1);
    });
  });

  // ---- D17 회귀 테스트 (기존 보존) ----
  describe('D17 — 공급단위 기준 환산 (회귀 테스트)', () => {
    it('포→1000g, supplyUnitQty=3 (3kg/포), 필요량 19000g → 7포', () => {
      const result = calculateOrderQuantity({
        requiredQtyG: 19000,
        stockQtyG: 0,
        unitConversion: { fromUnit: '포', factor: 1000 },
        supplierItem: { supplyUnitName: '포', supplyUnitQty: 3 },
      });
      expect(result.orderQuantity).toBe(7);
      expect(result.orderQuantityRaw).toBeCloseTo(6.333, 2);
      expect(result.requiresManualInput).toBe(false);
    });

    it('UnitConversion 미등록 → requiresManualInput=true (g 폴백 폐기)', () => {
      const result = calculateOrderQuantity({
        requiredQtyG: 19000,
        stockQtyG: 0,
        unitConversion: null,
        supplierItem: { supplyUnitName: '포', supplyUnitQty: 3 },
      });
      expect(result.requiresManualInput).toBe(true);
      expect(result.orderQuantity).toBeNull();
      expect(result.warnings.some((w) => w.includes('단위 환산 등록 필요'))).toBe(true);
    });

    it('UnitConversion.fromUnit 이 공급단위와 다르면 사용 불가', () => {
      const result = calculateOrderQuantity({
        requiredQtyG: 19000,
        stockQtyG: 0,
        unitConversion: { fromUnit: 'kg', factor: 1000 },
        supplierItem: { supplyUnitName: '포', supplyUnitQty: 3 },
      });
      expect(result.requiresManualInput).toBe(true);
      expect(result.warnings.some((w) => w.includes("'포→g' 환산 등록 필요"))).toBe(true);
    });

    it("공급단위='g' → UnitConversion 불필요 (factor=1 자동)", () => {
      const result = calculateOrderQuantity({
        requiredQtyG: 5000,
        stockQtyG: 0,
        unitConversion: null,
        supplierItem: { supplyUnitName: 'g', supplyUnitQty: 1000 },
      });
      expect(result.orderQuantity).toBe(5);
      expect(result.requiresManualInput).toBe(false);
    });

    it('supplyUnitQty=0 → requiresManualInput=true', () => {
      const result = calculateOrderQuantity({
        requiredQtyG: 19000,
        stockQtyG: 0,
        unitConversion: { fromUnit: '포', factor: 1000 },
        supplierItem: { supplyUnitName: '포', supplyUnitQty: 0 },
      });
      expect(result.requiresManualInput).toBe(true);
    });

    it('정수 결과 경계 — 6000g, 1000g/포, 3 → 2포 (정확히 6.0, ceil 후 2)', () => {
      const result = calculateOrderQuantity({
        requiredQtyG: 6000,
        stockQtyG: 0,
        unitConversion: { fromUnit: '포', factor: 1000 },
        supplierItem: { supplyUnitName: '포', supplyUnitQty: 3 },
      });
      expect(result.orderQuantity).toBe(2);
      expect(result.orderQuantityRaw).toBeCloseTo(2.0, 6);
    });
  });
});
