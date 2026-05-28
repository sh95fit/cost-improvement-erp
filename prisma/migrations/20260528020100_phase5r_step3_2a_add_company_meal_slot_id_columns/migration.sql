-- Phase 5-R Step 3.2a: MealPlan/MealCount에 company_meal_slot_id 컬럼 추가 + 백필
-- 본 마이그레이션은 신규 컬럼 추가, 기존 slot_type 값 기반 백필, NOT NULL 전환, FK + 인덱스까지 수행.
-- 기존 slot_type 컬럼과 MealSlotType enum은 그대로 유지됨 (Step 3.2b에서 제거).
-- 백필 매핑: LUNCH → SLOT-001, DINNER → SLOT-002, EVENT → SLOT-003 (회사별).
-- 기본 시드 외 enum 값(BREAKFAST/SNACK) 데이터가 있으면 마이그레이션 실패 → 에러 메시지로 안내.

-- ============================================================
-- 1) MealPlan: company_meal_slot_id 컬럼 추가 (nullable로 시작)
-- ============================================================
ALTER TABLE "meal_plans"
    ADD COLUMN "company_meal_slot_id" TEXT;

-- 백필: 기존 slot_type 값을 회사별 슬롯 ID로 매핑
UPDATE "meal_plans" mp
SET "company_meal_slot_id" = cms.id
FROM "meal_plan_groups" mpg, "company_meal_slots" cms
WHERE mp.meal_plan_group_id = mpg.id
  AND cms.company_id = mpg.company_id
  AND cms.deleted_at IS NULL
  AND (
    (mp.slot_type = 'LUNCH'  AND cms.code = 'SLOT-001') OR
    (mp.slot_type = 'DINNER' AND cms.code = 'SLOT-002') OR
    (mp.slot_type = 'EVENT'  AND cms.code = 'SLOT-003')
  );

-- 최종 검증: 모든 행이 매핑됐는지
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM "meal_plans" WHERE "company_meal_slot_id" IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'meal_plans: % rows could not be mapped to company_meal_slot. Check that SLOT-001(LUNCH)/SLOT-002(DINNER)/SLOT-003(EVENT) exist for all companies and slot_type values are within {LUNCH, DINNER, EVENT}.', null_count;
    END IF;
END $$;

-- NOT NULL 전환
ALTER TABLE "meal_plans"
    ALTER COLUMN "company_meal_slot_id" SET NOT NULL;

-- FK 추가
ALTER TABLE "meal_plans"
    ADD CONSTRAINT "meal_plans_company_meal_slot_id_fkey"
    FOREIGN KEY ("company_meal_slot_id") REFERENCES "company_meal_slots"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

-- 인덱스
CREATE INDEX "meal_plans_company_meal_slot_id_idx"
    ON "meal_plans"("company_meal_slot_id");


-- ============================================================
-- 2) MealCount: 동일한 방식으로 처리
-- ============================================================
ALTER TABLE "meal_counts"
    ADD COLUMN "company_meal_slot_id" TEXT;

UPDATE "meal_counts" mc
SET "company_meal_slot_id" = cms.id
FROM "meal_plan_groups" mpg, "company_meal_slots" cms
WHERE mc.meal_plan_group_id = mpg.id
  AND cms.company_id = mpg.company_id
  AND cms.deleted_at IS NULL
  AND (
    (mc.slot_type = 'LUNCH'  AND cms.code = 'SLOT-001') OR
    (mc.slot_type = 'DINNER' AND cms.code = 'SLOT-002') OR
    (mc.slot_type = 'EVENT'  AND cms.code = 'SLOT-003')
  );

DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM "meal_counts" WHERE "company_meal_slot_id" IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'meal_counts: % rows could not be mapped to company_meal_slot.', null_count;
    END IF;
END $$;

ALTER TABLE "meal_counts"
    ALTER COLUMN "company_meal_slot_id" SET NOT NULL;

ALTER TABLE "meal_counts"
    ADD CONSTRAINT "meal_counts_company_meal_slot_id_fkey"
    FOREIGN KEY ("company_meal_slot_id") REFERENCES "company_meal_slots"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "meal_counts_company_meal_slot_id_idx"
    ON "meal_counts"("company_meal_slot_id");
