-- ============================================================
-- Phase 9-A 보강: MaterialRequirement NOT NULL 승급 + soft-delete
-- ============================================================
-- 1) production_line_id, location_id를 NOT NULL로 승급
--    (산출 진입 전 슬롯의 productionLineId 검증으로 무결성 보장)
-- 2) deleted_at 컬럼 추가 + 인덱스
--    (재생성 시 UNDELETE 패턴으로 unique 충돌 회피)
-- 3) production_line_id, location_id FK 정책을 SET NULL → RESTRICT로 변경
--    (NOT NULL과 SET NULL 충돌 방지 + 마스터 의존성 가드와 일관성)
-- 사전 조건: SELECT COUNT(*) FROM material_requirements = 0
-- ============================================================

-- AlterTable: NOT NULL 승급
ALTER TABLE "material_requirements"
  ALTER COLUMN "production_line_id" SET NOT NULL;

ALTER TABLE "material_requirements"
  ALTER COLUMN "location_id" SET NOT NULL;

-- AlterTable: soft-delete 컬럼 추가
ALTER TABLE "material_requirements"
  ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex: deletedAt 인덱스 (다른 모델 컨벤션 일치)
CREATE INDEX "material_requirements_deleted_at_idx"
  ON "material_requirements"("deleted_at");

-- DropForeignKey + ReAdd: production_line_id FK 정책을 RESTRICT로 변경
ALTER TABLE "material_requirements"
  DROP CONSTRAINT "material_requirements_production_line_id_fkey";

ALTER TABLE "material_requirements"
  ADD CONSTRAINT "material_requirements_production_line_id_fkey"
  FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey + ReAdd: location_id FK 정책을 RESTRICT로 변경
ALTER TABLE "material_requirements"
  DROP CONSTRAINT "material_requirements_location_id_fkey";

ALTER TABLE "material_requirements"
  ADD CONSTRAINT "material_requirements_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
