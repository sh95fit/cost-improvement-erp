-- ============================================================
-- v5 마이그레이션: ContainerGroup 폐지 → SubsidiaryMaster 흡수
-- 기존 데이터 마이그레이션 포함
-- ============================================================

-- ============================================================
-- 1. 신규 Enum 생성
-- ============================================================
CREATE TYPE "subsidiary_type" AS ENUM ('CONTAINER', 'ACCESSORY', 'CONSUMABLE');
CREATE TYPE "consumption_mode" AS ENUM ('PER_MEAL_COUNT', 'FIXED_QUANTITY');
CREATE TYPE "supplier_type" AS ENUM ('MATERIAL', 'SUBSIDIARY');

-- ============================================================
-- 2. SubsidiaryMaster에 subsidiaryType 컬럼 추가
-- ============================================================
ALTER TABLE "subsidiary_masters" ADD COLUMN "subsidiary_type" "subsidiary_type" NOT NULL DEFAULT 'CONSUMABLE';

-- ============================================================
-- 3. Supplier에 supplierType 컬럼 추가
-- ============================================================
ALTER TABLE "suppliers" ADD COLUMN "supplier_type" "supplier_type" NOT NULL DEFAULT 'MATERIAL';

-- ============================================================
-- 4. ContainerGroup → SubsidiaryMaster 데이터 마이그레이션
--    기존 ContainerGroup을 SubsidiaryMaster(CONTAINER)로 복사
-- ============================================================

-- 4-1. 기존 ContainerGroup 데이터를 SubsidiaryMaster에 삽입
--      code 충돌 방지: 'CTG-' 접두사를 'SUB-CTG-'로 변환
INSERT INTO "subsidiary_masters" (
  "id", "company_id", "name", "code", "subsidiary_type",
  "unit", "unit_category", "stock_grade",
  "created_at", "updated_at", "deleted_at"
)
SELECT
  cg."id",
  cg."company_id",
  cg."name",
  'SUB-' || cg."code",    -- CTG-001 → SUB-CTG-001 (코드 충돌 방지)
  'CONTAINER'::"subsidiary_type",
  '개',                     -- 기본 단위
  'COUNT'::"unit_category",
  'C'::"stock_grade",
  cg."created_at",
  cg."updated_at",
  cg."deleted_at"
FROM "container_groups" cg
WHERE NOT EXISTS (
  SELECT 1 FROM "subsidiary_masters" sm WHERE sm."id" = cg."id"
);

-- ============================================================
-- 5. ContainerSlot: containerGroupId → subsidiaryMasterId 전환
-- ============================================================

-- 5-1. 새 컬럼 추가 (nullable로 먼저)
ALTER TABLE "container_slots" ADD COLUMN "subsidiary_master_id" TEXT;

-- 5-2. 기존 데이터 마이그레이션 (ContainerGroup ID = SubsidiaryMaster ID)
UPDATE "container_slots"
SET "subsidiary_master_id" = "container_group_id";

-- 5-3. NOT NULL 제약 추가
ALTER TABLE "container_slots" ALTER COLUMN "subsidiary_master_id" SET NOT NULL;

-- 5-4. 기존 FK, unique, index 삭제
ALTER TABLE "container_slots" DROP CONSTRAINT IF EXISTS "container_slots_container_group_id_fkey";
DROP INDEX IF EXISTS "container_slots_container_group_id_slot_index_key";
DROP INDEX IF EXISTS "container_slots_container_group_id_idx";

-- 5-5. 기존 컬럼 삭제
ALTER TABLE "container_slots" DROP COLUMN "container_group_id";

-- 5-6. 새 FK, unique, index 생성
ALTER TABLE "container_slots"
  ADD CONSTRAINT "container_slots_subsidiary_master_id_fkey"
  FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "container_slots_subsidiary_master_id_slot_index_key"
  ON "container_slots"("subsidiary_master_id", "slot_index");

CREATE INDEX "container_slots_subsidiary_master_id_idx"
  ON "container_slots"("subsidiary_master_id");

-- ============================================================
-- 6. RecipeBOMSlot: containerGroupId → subsidiaryMasterId 전환
-- ============================================================

-- 6-1. 새 컬럼 추가 (nullable로 먼저)
ALTER TABLE "recipe_bom_slots" ADD COLUMN "subsidiary_master_id" TEXT;

-- 6-2. 기존 데이터 마이그레이션
UPDATE "recipe_bom_slots"
SET "subsidiary_master_id" = "container_group_id";

-- 6-3. NOT NULL 제약 추가
ALTER TABLE "recipe_bom_slots" ALTER COLUMN "subsidiary_master_id" SET NOT NULL;

-- 6-4. 기존 FK, unique, index 삭제
ALTER TABLE "recipe_bom_slots" DROP CONSTRAINT IF EXISTS "recipe_bom_slots_container_group_id_fkey";
DROP INDEX IF EXISTS "recipe_bom_slots_recipe_bom_id_container_group_id_slot_inde_key";
DROP INDEX IF EXISTS "recipe_bom_slots_container_group_id_idx";

-- 6-5. 기존 컬럼 삭제
ALTER TABLE "recipe_bom_slots" DROP COLUMN "container_group_id";

-- 6-6. 새 FK, unique, index 생성
ALTER TABLE "recipe_bom_slots"
  ADD CONSTRAINT "recipe_bom_slots_subsidiary_master_id_fkey"
  FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "recipe_bom_slots_recipe_bom_id_subsidiary_master_id_slot_idx_key"
  ON "recipe_bom_slots"("recipe_bom_id", "subsidiary_master_id", "slot_index");

CREATE INDEX "recipe_bom_slots_subsidiary_master_id_idx"
  ON "recipe_bom_slots"("subsidiary_master_id");

-- ============================================================
-- 7. MealTemplate: containerGroupId 제거
-- ============================================================

-- 7-1. FK, index 삭제
ALTER TABLE "meal_templates" DROP CONSTRAINT IF EXISTS "meal_templates_container_group_id_fkey";
DROP INDEX IF EXISTS "meal_templates_container_group_id_idx";

-- 7-2. 신규 MealTemplateContainer 테이블 생성
CREATE TABLE "meal_template_containers" (
  "id" TEXT NOT NULL,
  "meal_template_id" TEXT NOT NULL,
  "subsidiary_master_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "meal_template_containers_pkey" PRIMARY KEY ("id")
);

-- 7-3. 기존 MealTemplate의 containerGroupId → MealTemplateContainer로 데이터 이전
INSERT INTO "meal_template_containers" ("id", "meal_template_id", "subsidiary_master_id", "sort_order")
SELECT
  gen_random_uuid()::text,
  mt."id",
  mt."container_group_id",
  0
FROM "meal_templates" mt
WHERE mt."container_group_id" IS NOT NULL;

-- 7-4. containerGroupId 컬럼 삭제
ALTER TABLE "meal_templates" DROP COLUMN "container_group_id";

-- 7-5. MealTemplateContainer FK, unique, index 생성
ALTER TABLE "meal_template_containers"
  ADD CONSTRAINT "meal_template_containers_meal_template_id_fkey"
  FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_template_containers"
  ADD CONSTRAINT "meal_template_containers_subsidiary_master_id_fkey"
  FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "meal_template_containers_meal_template_id_subsidiary_master_key"
  ON "meal_template_containers"("meal_template_id", "subsidiary_master_id");

CREATE INDEX "meal_template_containers_meal_template_id_idx"
  ON "meal_template_containers"("meal_template_id");

CREATE INDEX "meal_template_containers_subsidiary_master_id_idx"
  ON "meal_template_containers"("subsidiary_master_id");

-- ============================================================
-- 8. MealTemplateAccessory 재설계
--    기존: name(String) 기반 → 새: subsidiaryMasterId FK 기반
-- ============================================================

-- 8-1. 기존 테이블 삭제
DROP TABLE IF EXISTS "meal_template_accessories";

-- 8-2. 새 테이블 생성
CREATE TABLE "meal_template_accessories" (
  "id" TEXT NOT NULL,
  "meal_template_id" TEXT NOT NULL,
  "subsidiary_master_id" TEXT NOT NULL,
  "consumption_type" "consumption_mode" NOT NULL DEFAULT 'PER_MEAL_COUNT',
  "fixed_quantity" DOUBLE PRECISION,
  "is_required" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "meal_template_accessories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "meal_template_accessories"
  ADD CONSTRAINT "meal_template_accessories_meal_template_id_fkey"
  FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_template_accessories"
  ADD CONSTRAINT "meal_template_accessories_subsidiary_master_id_fkey"
  FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "meal_template_accessories_meal_template_id_subsidiary_mast_key"
  ON "meal_template_accessories"("meal_template_id", "subsidiary_master_id");

CREATE INDEX "meal_template_accessories_meal_template_id_idx"
  ON "meal_template_accessories"("meal_template_id");

CREATE INDEX "meal_template_accessories_subsidiary_master_id_idx"
  ON "meal_template_accessories"("subsidiary_master_id");

-- ============================================================
-- 9. MealTemplateSlot 삭제
-- ============================================================
DROP TABLE IF EXISTS "meal_template_slots";

-- ============================================================
-- 10. ContainerAccessory 삭제
-- ============================================================
DROP TABLE IF EXISTS "container_accessories";

-- ============================================================
-- 11. ContainerGroup 삭제
--     (데이터는 SubsidiaryMaster로 이전 완료)
-- ============================================================

-- 11-1. Company → ContainerGroup FK 해제 (relation field 제거는 schema에서 처리)
-- ContainerGroup은 Company와 relation만 있고 별도 FK 컬럼이 Company에 없으므로 바로 삭제 가능

DROP TABLE IF EXISTS "container_groups";

-- ============================================================
-- 12. SubsidiaryMaster 인덱스 추가
-- ============================================================
CREATE INDEX "subsidiary_masters_company_id_subsidiary_type_idx"
  ON "subsidiary_masters"("company_id", "subsidiary_type");

-- ============================================================
-- 13. Supplier 인덱스 추가
-- ============================================================
CREATE INDEX "suppliers_company_id_supplier_type_idx"
  ON "suppliers"("company_id", "supplier_type");
