-- 1. company_id 컬럼 추가 (기존 데이터는 from_material_id의 company_id를 가져옴)
ALTER TABLE "unit_conversions" ADD COLUMN "company_id" TEXT;

UPDATE "unit_conversions" uc
SET "company_id" = mm."company_id"
FROM "material_masters" mm
WHERE uc."from_material_id" = mm."id";

ALTER TABLE "unit_conversions" ALTER COLUMN "company_id" SET NOT NULL;

-- 2. material_master_id 컬럼 추가 (from_material_id 값 복사)
ALTER TABLE "unit_conversions" ADD COLUMN "material_master_id" TEXT;

UPDATE "unit_conversions"
SET "material_master_id" = "from_material_id";

-- 3. 기존 인덱스 및 컬럼 제거
DROP INDEX IF EXISTS "unit_conversions_from_material_id_idx";
DROP INDEX IF EXISTS "unit_conversions_to_material_id_idx";

ALTER TABLE "unit_conversions" DROP CONSTRAINT IF EXISTS "unit_conversions_from_material_id_fkey";
ALTER TABLE "unit_conversions" DROP CONSTRAINT IF EXISTS "unit_conversions_to_material_id_fkey";

ALTER TABLE "unit_conversions" DROP COLUMN "from_material_id";
ALTER TABLE "unit_conversions" DROP COLUMN "to_material_id";

-- 4. 새 FK 추가
ALTER TABLE "unit_conversions"
  ADD CONSTRAINT "unit_conversions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unit_conversions"
  ADD CONSTRAINT "unit_conversions_material_master_id_fkey"
  FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. 새 인덱스 및 유니크 제약 추가
CREATE UNIQUE INDEX "unit_conversions_company_id_material_master_id_from_unit_to_key"
  ON "unit_conversions"("company_id", "material_master_id", "from_unit", "to_unit");

CREATE INDEX "unit_conversions_company_id_idx" ON "unit_conversions"("company_id");
CREATE INDEX "unit_conversions_material_master_id_idx" ON "unit_conversions"("material_master_id");
