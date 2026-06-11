-- Phase 9-D-Sym: MealPlanSlot 예상/확정 수량 컬럼 분리
--
-- 변경 사항
--  1) meal_plan_slots.quantity → meal_plan_slots.estimated_quantity 로 개명
--     기존 데이터는 그대로 이관 (NOT NULL, DEFAULT 0 유지)
--  2) meal_plan_slots.final_quantity (Int, NULL 가능) 신규 추가
--     기존 행은 NULL로 초기화. IN_PROGRESS 단계 진입 시 입력.
--
-- 백필 정책
--  - 기존 quantity는 "작성 단계 입력값"이므로 estimated_quantity 로 그대로 이관
--  - final_quantity는 신규 컬럼이므로 백필하지 않는다 (NULL = 미입력)
--    이미 COMPLETED 상태인 그룹이 운영에 존재한다면, 별도 backfill 스크립트로
--    final_quantity := estimated_quantity 처리 검토 가능 (본 마이그레이션 범위 밖)

-- 1) 컬럼 개명
ALTER TABLE "meal_plan_slots"
  RENAME COLUMN "quantity" TO "estimated_quantity";

-- 2) 신규 컬럼 추가 (NULLABLE)
ALTER TABLE "meal_plan_slots"
  ADD COLUMN "final_quantity" INTEGER;
