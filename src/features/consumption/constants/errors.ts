/**
 * ════════════════════════════════════════
 * Consumption 도메인 에러 코드 상수
 * ════════════════════════════════════════
 * action 계층의 handleActionError 매핑에서 사용자 메시지로 변환된다.
 */
export const CONSUMPTION_ERRORS = {
    /** S4-3-a: MealPlanGroup.status !== COMPLETED */
    MEAL_PLAN_NOT_COMPLETED_FOR_CONSUMPTION: "MEAL_PLAN_NOT_COMPLETED_FOR_CONSUMPTION",
    /** S4-3-b: FINAL MaterialRequirement 가 없음 (데이터 무결성 방어) */
    MATERIAL_REQUIREMENT_NOT_GENERATED: "MATERIAL_REQUIREMENT_NOT_GENERATED",
    /** S4-3-b: MealPlanGroup 자체 없음 (진입 가드 뒤라 이론상 도달 불가) */
    MEAL_PLAN_GROUP_NOT_FOUND: "MEAL_PLAN_GROUP_NOT_FOUND",
    /** S4-3-d: 사용량 + 폐기량 > availableQty (P11 Pre-flight 실패) */
    INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
    STALE_DRAFT: "STALE_DRAFT",
    INVALID_LAYER_B_ITEM: "INVALID_LAYER_B_ITEM",    
  } as const;
  
  export type ConsumptionErrorCode =
    (typeof CONSUMPTION_ERRORS)[keyof typeof CONSUMPTION_ERRORS];