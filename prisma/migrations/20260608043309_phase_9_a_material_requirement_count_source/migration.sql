-- Phase 9-A-1.5: MaterialRequirement에 countSource 추가 + 인덱스 정합화
-- 사전조건: material_requirements 테이블 row 0건 (Phase 9-A-0에서 확인)
-- 본 마이그레이션은 이미 부분 적용된 DB 상태(count_source 컬럼·일부 인덱스 존재)를
-- 자기복구(IF NOT EXISTS / IF EXISTS) 패턴으로 멱등 처리한다.

-- 1) MealCountSource enum 신설
DO $$ BEGIN
  CREATE TYPE "meal_count_source" AS ENUM ('ESTIMATED', 'FINAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) count_source 컬럼 추가 (기본 ESTIMATED)
ALTER TABLE "material_requirements"
  ADD COLUMN IF NOT EXISTS "count_source" "meal_count_source" NOT NULL DEFAULT 'ESTIMATED';

-- 3) count_source 보조 인덱스
CREATE INDEX IF NOT EXISTS "material_requirements_count_source_idx"
  ON "material_requirements"("count_source");

-- 4) 기존 3컬럼 유니크 인덱스 제거 (Prisma 자동 명명 / 잘린 이름 모두 대응)
DROP INDEX IF EXISTS "material_requirements_meal_plan_group_id_production_line_id_key";
DROP INDEX IF EXISTS "material_requirements_meal_plan_group_id_production_line_i_key";
ALTER TABLE "material_requirements"
  DROP CONSTRAINT IF EXISTS "uq_mr_group_line_material";
DROP INDEX IF EXISTS "uq_mr_group_line_material";

-- 5) 새 4컬럼 합성 유니크 (명시적 짧은 이름)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_mr_group_line_material_source"
  ON "material_requirements"("meal_plan_group_id", "production_line_id", "material_master_id", "count_source");
