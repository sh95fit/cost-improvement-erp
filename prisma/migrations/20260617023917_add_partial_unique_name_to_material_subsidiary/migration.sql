-- ============================================================
-- M-Fix (D14): MaterialMaster / SubsidiaryMaster
-- (company_id, name) partial unique index — WHERE deleted_at IS NULL
--
-- 목적:
--   같은 회사 내에서 살아있는(soft-delete 안 된) 자재/부자재의
--   name 중복을 DB 차원에서 금지.
--   soft-delete 된 행은 검사 대상에서 제외 → 이력 보존 가능.
--
-- 배경:
--   Sprint 3 Phase 4-B'-5c 위저드 Step 3에서 동명 자재로 인해
--   공급업체 매핑이 차단되는 이슈 발생 → 사전 방지.
--
-- 주의:
--   Prisma @@unique 로는 partial 조건을 표현할 수 없으므로
--   본 마이그레이션 SQL에 직접 정의함.
-- ============================================================

CREATE UNIQUE INDEX "material_masters_company_id_name_active_key"
  ON "material_masters" ("company_id", "name")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "subsidiary_masters_company_id_name_active_key"
  ON "subsidiary_masters" ("company_id", "name")
  WHERE "deleted_at" IS NULL;
