-- Phase 5-R Step 2.1: LineupMealTemplateMap 신규 모델
-- (라인업 × 슬롯타입) → 기본 식단 템플릿 매핑
-- soft-delete 정책 일관 적용: partial unique index 사용

-- ============================================================
-- 1) 테이블 생성
-- ============================================================
CREATE TABLE "lineup_meal_template_maps" (
    "id"               TEXT NOT NULL,
    "lineup_id"        TEXT NOT NULL,
    "slot_type"        "meal_slot_type" NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    "deleted_at"       TIMESTAMP(3),

    CONSTRAINT "lineup_meal_template_maps_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2) 인덱스
-- ============================================================
CREATE INDEX "lineup_meal_template_maps_lineup_id_idx"
  ON "lineup_meal_template_maps" ("lineup_id");

CREATE INDEX "lineup_meal_template_maps_slot_type_idx"
  ON "lineup_meal_template_maps" ("slot_type");

CREATE INDEX "lineup_meal_template_maps_meal_template_id_idx"
  ON "lineup_meal_template_maps" ("meal_template_id");

CREATE INDEX "lineup_meal_template_maps_deleted_at_idx"
  ON "lineup_meal_template_maps" ("deleted_at");

-- ============================================================
-- 3) Partial Unique Index — (lineup_id, slot_type) 활성 1건만 허용
--    네이밍 컨벤션: {table}_{cols}_active
-- ============================================================
CREATE UNIQUE INDEX "lineup_meal_template_maps_lineup_id_slot_type_active"
  ON "lineup_meal_template_maps" ("lineup_id", "slot_type")
  WHERE "deleted_at" IS NULL;

-- ============================================================
-- 4) Foreign Keys
-- ============================================================
ALTER TABLE "lineup_meal_template_maps"
  ADD CONSTRAINT "lineup_meal_template_maps_lineup_id_fkey"
  FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lineup_meal_template_maps"
  ADD CONSTRAINT "lineup_meal_template_maps_meal_template_id_fkey"
  FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
