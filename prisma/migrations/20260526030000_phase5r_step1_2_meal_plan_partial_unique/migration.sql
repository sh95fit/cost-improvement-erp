-- Phase 5-R Step 1.2: MealPlan soft delete 호환 partial unique index
--
-- 문제: @@unique([mealPlanGroupId, slotType, lineupId])는 deleted_at에 무관하게
--       작동하여, soft delete된 행과 동일 조합의 새 행 생성을 차단함.
-- 해결: deleted_at IS NULL인 활성 행에만 적용되는 partial unique index로 교체.
--
-- 컨벤션: 20260423074023_add_partial_unique_indexes와 동일한 {table}_{cols}_active 네이밍.

-- 1) 기존 일반 unique index 제거 (Prisma 자동 생성 이름)
DROP INDEX IF EXISTS "meal_plans_meal_plan_group_id_slot_type_lineup_id_key";

-- 2) deleted_at IS NULL 조건 partial unique index 생성
CREATE UNIQUE INDEX IF NOT EXISTS "meal_plans_meal_plan_group_id_slot_type_lineup_id_active"
  ON "meal_plans" ("meal_plan_group_id", "slot_type", "lineup_id")
  WHERE "deleted_at" IS NULL;
