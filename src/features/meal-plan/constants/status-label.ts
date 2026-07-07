// src/features/meal-plan/constants/meal-plan-status.ts

/**
 * MealPlanGroup 상태 라벨/색상/순서 상수.
 *
 * - enum 값(예: "CONFIRMED")은 DB·서버·테스트 전반에서 사용.
 * - UI 표시 라벨은 STATUS_LABEL 룩업을 거친다 (예: "CONFIRMED" → "준비중").
 * - 라벨 변경 시 enum 값은 절대 건드리지 않는다 (Sprint 2 종결 보강 정책).
 *
 * Phase 9-D-Sym (2026-06-11): CONFIRMED 라벨을 "확정" → "준비중"으로 변경.
 * 이유: "확정"은 식수 확정 의미와 혼동되어 발주 단계 사용자에게 오해를 유발.
 */

export const STATUS_LABEL: Record<string, string> = {
    DRAFT: "작성중",
    CONFIRMED: "준비중",
    IN_PROGRESS: "진행중",
    COMPLETED: "완료",
    CANCELLED: "취소",
  };
  
  export const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-800",  // ★ green → amber (UX: 진행중 = 주의)
    COMPLETED: "bg-green-100 text-green-800",    // ★ purple → green (UX: 완료 = 초록 표준)
    CANCELLED: "bg-red-100 text-red-700",
  };
  
  /**
   * Phase 9-C-Fix-R1-5b: 정방향/역방향 판단용
   * 낮은 인덱스 → 높은 인덱스 = 정방향 (DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED).
   * CANCELLED는 별도 처리하므로 ORDER에서 제외.
   */
  export const STATUS_ORDER: string[] = [
    "DRAFT",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
  ];
  
  /**
   * Phase 9-C-Fix-R1-5: 허용 상태 전환 표 (서버 정책과 1:1 정합).
   * page.tsx 의 handleStatusChange + material-requirement 산출 가드에서 공통 사용.
   */
  export const ALLOWED_FORWARD_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["IN_PROGRESS", "DRAFT", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CONFIRMED", "CANCELLED"],
    COMPLETED: ["IN_PROGRESS", "CANCELLED"],
    CANCELLED: ["DRAFT"],
  };
  
  /**
   * MealPlanAccessory 소비 모드 라벨.
   * page.tsx 부자재 다이얼로그 및 향후 다른 페이지에서 공통 사용.
   */
  export const CONSUMPTION_MODE_LABEL: Record<string, string> = {
    PER_MEAL_COUNT: "식수 비례",
    FIXED_QUANTITY: "고정수량",
  };