-- Phase 4-C2 pre: MaterialRequirement.lineupId 추가
-- 근거: docs/progress/COST_LINEUP_ALIGNMENT.md (GAP-1 / DC1)

-- (1) lineup_id 컬럼 추가 (nullable)
ALTER TABLE "material_requirements"
  ADD COLUMN IF NOT EXISTS "lineup_id" TEXT;

-- (2) lineup_id 인덱스
CREATE INDEX IF NOT EXISTS "material_requirements_lineup_id_idx"
  ON "material_requirements" ("lineup_id");

-- (3) Lineup 외래키 (ON DELETE SET NULL, ON UPDATE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'material_requirements_lineup_id_fkey'
  ) THEN
    ALTER TABLE "material_requirements"
      ADD CONSTRAINT "material_requirements_lineup_id_fkey"
      FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- (4) 기존 4-컬럼 unique 제거 (제약/인덱스 양쪽 모두 안전하게)
ALTER TABLE "material_requirements"
  DROP CONSTRAINT IF EXISTS "uq_mr_group_line_material_source";
DROP INDEX IF EXISTS "uq_mr_group_line_material_source";

-- (5) 신규 5-컬럼 unique (DB 인덱스 이름 = uq_mr_group_line_lineup_material_source)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_mr_group_line_lineup_material_source"
  ON "material_requirements" (
    "meal_plan_group_id",
    "production_line_id",
    "lineup_id",
    "material_master_id",
    "count_source"
  );
