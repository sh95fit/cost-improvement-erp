/**
 * 발주 수량 환산 라이브러리 (순수 함수)
 *
 * 환산 체인:
 *   필요량(g) - 재고(g) = 순필요량(g)
 *     ↓ [UnitConversion: 환산전단위 → g, factor]
 *   순필요량(환산전 단위, 예: 포)
 *     ↓ [SupplierItem.supplyUnit + 계수]
 *   발주량(공급 단위, 예: 박스)  → Math.ceil()
 *
 * 예시:
 *   필요량 19,000g, 재고 0g
 *   UnitConversion(포 → g, factor 1000): 19,000g ÷ 1000 = 19포
 *   SupplierItem(supplyUnit="포", 계수=20): 19포 ÷ 20 = 0.95
 *   → ceil → 1박스
 *
 * 정책:
 *   - 재고가 필요량을 초과해도 음수 발주 불가 (max 0)
 *   - 환산전 단위가 "g" 또는 "kg"이면 UnitConversion 불필요
 *   - 계수 0 또는 null은 1로 간주 + 경고 플래그
 *   - 환산 실패 시 result.requiresManualInput=true 반환 (throw 안 함)
 */

export interface UnitConversionInput {
    /** 환산전 단위 명칭 (예: "포", "kg") */
    fromUnit: string;
    /** g 기준 환산 계수 (예: 포 → g = 1000) */
    factor: number;
  }
  
  export interface SupplierItemUnitInput {
    /** 공급 단위 명칭 (예: "박스") */
    supplyUnitName: string;
    /** 공급 단위당 환산전 단위 수 (예: 1박스 = 20포) */
    conversionFactor: number;
  }
  
  export interface CalculateOrderQuantityInput {
    /** 필요량 (g 단위) — MaterialRequirement.requiredQty */
    requiredQtyG: number;
    /** 현재 재고 (g 단위) — Phase 6 InventoryService.getCurrentStockByMaterial() */
    stockQtyG: number;
    /** 환산전 단위 정보 (자재 마스터 또는 UnitConversion 기준) */
    unitConversion: UnitConversionInput | null;
    /** 공급업체 품목 정보 (미매핑 시 null) */
    supplierItem: SupplierItemUnitInput | null;
  }
  
  export interface CalculateOrderQuantityResult {
    /** 순필요량 (g) = max(0, required - stock) */
    netRequiredG: number;
    /** 환산전 단위 기준 순필요량 (예: 19포) */
    netRequiredInFromUnit: number | null;
    /** 발주량 (공급 단위, 정수) — Math.ceil() 적용 */
    orderQuantity: number | null;
    /** 발주량 산출용 원시값 (소수 포함, 사용자 확인용) */
    orderQuantityRaw: number | null;
    /** 환산 미가능 여부 — true 시 UI에서 수동 입력 강제 */
    requiresManualInput: boolean;
    /** 경고 메시지 목록 (UI 호버 안내용) */
    warnings: string[];
  }
  
  const EPSILON = 1e-9;
  
  /**
   * 발주 수량 계산 (순수 함수)
   */
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
    const stockG = Number.isFinite(input.stockQtyG) && input.stockQtyG > 0
      ? input.stockQtyG
      : 0;
  
    // 2) 순필요량 계산
    const netRequiredG = Math.max(0, input.requiredQtyG - stockG);
  
    if (netRequiredG < EPSILON) {
      // 재고가 필요량을 모두 충족 — 발주 불필요
      return {
        netRequiredG: 0,
        netRequiredInFromUnit: 0,
        orderQuantity: 0,
        orderQuantityRaw: 0,
        requiresManualInput: false,
        warnings: ['재고로 충당 가능 (발주 불필요)'],
      };
    }
  
    // 3) g → 환산전 단위
    let netRequiredInFromUnit: number;
    if (input.unitConversion === null) {
      // 환산 정보 없음 — g 자체를 환산전 단위로 간주
      netRequiredInFromUnit = netRequiredG;
      warnings.push('단위 환산 정보 미등록 (g 단위로 처리)');
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
      netRequiredInFromUnit = netRequiredG / input.unitConversion.factor;
    }
  
    // 4) 공급업체 미매핑 — 환산전 단위까지만 산출
    if (input.supplierItem === null) {
      return {
        netRequiredG,
        netRequiredInFromUnit,
        orderQuantity: null,
        orderQuantityRaw: null,
        requiresManualInput: true,
        warnings: [...warnings, '공급업체 품목 미지정'],
      };
    }
  
    // 5) 환산전 단위 → 공급 단위
    const supplierFactor = input.supplierItem.conversionFactor;
    let effectiveSupplierFactor: number;
    if (!Number.isFinite(supplierFactor) || supplierFactor <= EPSILON) {
      effectiveSupplierFactor = 1;
      warnings.push('공급업체 계수가 0 또는 미입력 (1로 간주)');
    } else {
      effectiveSupplierFactor = supplierFactor;
    }
  
    const orderQuantityRaw = netRequiredInFromUnit / effectiveSupplierFactor;
    const orderQuantity = Math.ceil(orderQuantityRaw - EPSILON);
  
    return {
      netRequiredG,
      netRequiredInFromUnit,
      orderQuantity,
      orderQuantityRaw,
      requiresManualInput: false,
      warnings,
    };
  }
  