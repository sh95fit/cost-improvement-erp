/**
 * 발주 수량 환산 라이브러리 (순수 함수) — D17 (2026-06-22)
 *
 * 환산 체인 (1단계 직접 환산으로 의미 명확화):
 *   필요량(g) - 재고(g) = 순필요량(g)
 *     ÷ (UnitConversion.factor × SupplierItem.supplyUnitQty)  ← g/공급단위
 *   = 발주량(공급 단위)  → Math.ceil()
 *
 * 예시 (D17 회귀):
 *   필요량 19,000g, 재고 0g, supplyUnit='포', supplyUnitQty=3, UnitConversion(포→g)=1000
 *   gPerSupplyUnit = 1000 × 3 = 3000 g/포
 *   19,000 ÷ 3000 = 6.333... → ceil → 7포
 *
 * 정책:
 *   - 재고가 필요량을 초과해도 음수 발주 불가 (max 0)
 *   - 공급단위='g' 이면 UnitConversion 불필요 (factor=1 자동)
 *   - 그 외 공급단위에 대한 UnitConversion 미등록 → requiresManualInput=true (g 폴백 폐기)
 *   - 계수 0 또는 null은 requiresManualInput=true
 *   - 환산 실패 시 throw 없이 result.requiresManualInput=true 반환
 */

export interface UnitConversionInput {
  /** 환산전 단위 명칭 (SupplierItem.supplyUnit.name과 반드시 일치) */
  fromUnit: string;
  /** g 기준 환산 계수 (예: 포 → g = 1000) */
  factor: number;
}

export interface SupplierItemUnitInput {
  /** 공급 단위 명칭 (예: "포") — UnitMaster.name */
  supplyUnitName: string;
  /** 공급 단위당 환산전 단위 수 (예: 1포 = 3kg 이면 3) */
  supplyUnitQty: number;
}

export interface CalculateOrderQuantityInput {
  requiredQtyG: number;
  stockQtyG: number;
  /** UnitConversion 행 (fromUnit이 supplierItem.supplyUnitName과 일치해야 함). 없으면 null. */
  unitConversion: UnitConversionInput | null;
  supplierItem: SupplierItemUnitInput | null;
}

export interface CalculateOrderQuantityResult {
  netRequiredG: number;
  /** 환산전 단위(=공급단위) 기준 순필요량 (예: 6.33포) — raw, 소수 보존 */
  netRequiredInFromUnit: number | null;
  /** 발주량 (공급단위, 정수) — Math.ceil 적용 */
  orderQuantity: number | null;
  /** 발주량 raw (소수) — UI 표시·금액 차감용 */
  orderQuantityRaw: number | null;
  requiresManualInput: boolean;
  warnings: string[];
}

const EPSILON = 1e-9;

export function calculateOrderQuantity(
  input: CalculateOrderQuantityInput,
): CalculateOrderQuantityResult {
  const warnings: string[] = [];

  // 1) 입력 검증
  if (!Number.isFinite(input.requiredQtyG) || input.requiredQtyG < 0) {
    return {
      netRequiredG: 0,
      netRequiredInFromUnit: null,
      orderQuantity: null,
      orderQuantityRaw: null,
      requiresManualInput: true,
      warnings: ['필요량이 올바르지 않습니다'],
    };
  }
  const stockG =
    Number.isFinite(input.stockQtyG) && input.stockQtyG > 0 ? input.stockQtyG : 0;

  // 2) 순필요량 계산
  const netRequiredG = Math.max(0, input.requiredQtyG - stockG);

  if (netRequiredG < EPSILON) {
    return {
      netRequiredG: 0,
      netRequiredInFromUnit: 0,
      orderQuantity: 0,
      orderQuantityRaw: 0,
      requiresManualInput: false,
      warnings: ['재고로 충당 가능 (발주 불필요)'],
    };
  }

  // 3) 공급업체 미매핑 — 환산 진행 불가
  if (input.supplierItem === null) {
    return {
      netRequiredG,
      netRequiredInFromUnit: null,
      orderQuantity: null,
      orderQuantityRaw: null,
      requiresManualInput: true,
      warnings: ['공급업체 품목 미지정'],
    };
  }

  const supplyUnitName = input.supplierItem.supplyUnitName;
  const supplyUnitQty = input.supplierItem.supplyUnitQty;

  // 4) supplyUnitQty 검증
  if (!Number.isFinite(supplyUnitQty) || supplyUnitQty <= EPSILON) {
    return {
      netRequiredG,
      netRequiredInFromUnit: null,
      orderQuantity: null,
      orderQuantityRaw: null,
      requiresManualInput: true,
      warnings: ['공급단위 계수(supplyUnitQty)가 0 또는 미입력'],
    };
  }

  // 5) UnitConversion 결정
  //    - supplyUnit === 'g' → factor=1 자동 (UnitConversion 불필요)
  //    - 그 외 → unitConversion.fromUnit 이 supplyUnitName 과 일치해야 함
  let factor: number;
  if (supplyUnitName === 'g') {
    factor = 1;
  } else if (input.unitConversion === null) {
    return {
      netRequiredG,
      netRequiredInFromUnit: null,
      orderQuantity: null,
      orderQuantityRaw: null,
      requiresManualInput: true,
      warnings: [`공급단위 '${supplyUnitName}' → g 환산 미등록 — 단위 환산 등록 필요`],
    };
  } else if (input.unitConversion.fromUnit !== supplyUnitName) {
    // ★ D17 핵심 가드: 환산의 fromUnit이 공급단위와 다르면 사용 불가
    return {
      netRequiredG,
      netRequiredInFromUnit: null,
      orderQuantity: null,
      orderQuantityRaw: null,
      requiresManualInput: true,
      warnings: [
        `등록된 환산(${input.unitConversion.fromUnit}→g)이 공급단위 '${supplyUnitName}'와 다릅니다 — '${supplyUnitName}→g' 환산 등록 필요`,
      ],
    };
  } else if (input.unitConversion.factor <= EPSILON) {
    return {
      netRequiredG,
      netRequiredInFromUnit: null,
      orderQuantity: null,
      orderQuantityRaw: null,
      requiresManualInput: true,
      warnings: ['단위 환산 계수가 0 또는 음수입니다'],
    };
  } else {
    factor = input.unitConversion.factor;
  }

  // 6) 발주량 산출
  //    gPerSupplyUnit = factor × supplyUnitQty (예: 1000 × 3 = 3000 g/포)
  const gPerSupplyUnit = factor * supplyUnitQty;
  const orderQuantityRaw = netRequiredG / gPerSupplyUnit;
  const orderQuantity = Math.ceil(orderQuantityRaw - EPSILON);

  return {
    netRequiredG,
    netRequiredInFromUnit: orderQuantityRaw, // 공급단위 기준 raw (= 발주량 raw와 동일)
    orderQuantity,
    orderQuantityRaw,
    requiresManualInput: false,
    warnings,
  };
}
