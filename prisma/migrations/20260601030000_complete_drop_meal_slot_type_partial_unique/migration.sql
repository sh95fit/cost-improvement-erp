-- Phase 5-R Step 3.2b-2-β 보완 마이그레이션
-- 이전 마이그레이션(20260601025811)이 부분 적용된 상태를 정상화.
-- 누락 항목:
--   1. meal_plans의 (group, companyMealSlot, lineup) partial unique index
--   2. meal_counts의 unique index를 partial로 재생성
--   3. meal_plans의 company_meal_slot_id FK
--   4. meal_counts의 company_meal_slot_id FK

-- 1. meal_plans partial unique index
CREATE UNIQUE INDEX "meal_plans_meal_plan_group_id_company_meal_slot_id_lineup_i_key"
  ON "meal_plans" ("meal_plan_group_id", "company_meal_slot_id", "lineup_id")
  WHERE "deleted_at" IS NULL;

-- 2. meal_counts unique를 partial로 교체
DROP INDEX "meal_counts_meal_plan_group_id_company_meal_slot_id_lineup__key";

CREATE UNIQUE INDEX "meal_counts_meal_plan_group_id_company_meal_slot_id_lineup__key"
  ON "meal_counts" ("meal_plan_group_id", "company_meal_slot_id", "lineup_id")
  WHERE "deleted_at" IS NULL;

-- 3. meal_plans FK 재생성
ALTER TABLE "meal_plans"
  ADD CONSTRAINT "meal_plans_company_meal_slot_id_fkey"
  FOREIGN KEY ("company_meal_slot_id") REFERENCES "company_meal_slots"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. meal_counts FK 재생성
ALTER TABLE "meal_counts"
  ADD CONSTRAINT "meal_counts_company_meal_slot_id_fkey"
  FOREIGN KEY ("company_meal_slot_id") REFERENCES "company_meal_slots"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
