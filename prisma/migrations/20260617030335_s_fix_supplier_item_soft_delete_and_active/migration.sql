-- ============================================================
-- S-Fix (D15): SupplierItem isActive + soft-delete 도입
--
-- 배경:
--   - 다른 도메인 모델(Supplier, MaterialMaster, SubsidiaryMaster)은
--     soft-delete 컨벤션을 따르나 SupplierItem만 누락되어 있었음.
--   - 잘못 등록된 공급 품목 삭제 시 PO·식단 이력 무결성 위험.
--
-- 변경사항:
--   1) is_active 컬럼 추가 (default true) — 의존성 무관 활성/비활성 토글
--   2) deleted_at 컬럼 추가 — 향후 soft-delete 경로 대비 (현재 hard-delete 유지)
--   3) 기존 unique 제약을 partial(WHERE deleted_at IS NULL)로 변경
--   4) is_active / deleted_at 인덱스 추가
--
-- 동작 정책:
--   - 의존성 0건일 때만 hard-delete 허용
--   - 그 외에는 is_active=false 토글로 처리 (이력 보존)
-- ============================================================

-- (1) is_active 컬럼 추가
ALTER TABLE "supplier_items"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- (2) deleted_at 컬럼 추가
ALTER TABLE "supplier_items"
  ADD COLUMN "deleted_at" TIMESTAMP(3);

-- (3) 기존 unique 제약을 partial로 교체
DROP INDEX IF EXISTS "uq_supplier_material_product";
DROP INDEX IF EXISTS "uq_supplier_subsidiary_product";

CREATE UNIQUE INDEX "uq_supplier_material_product_active"
  ON "supplier_items" ("supplier_id", "item_type", "material_master_id", "product_name")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_supplier_subsidiary_product_active"
  ON "supplier_items" ("supplier_id", "item_type", "subsidiary_master_id", "product_name")
  WHERE "deleted_at" IS NULL;

-- (4) 인덱스 추가
CREATE INDEX "supplier_items_is_active_idx" ON "supplier_items" ("is_active");
CREATE INDEX "supplier_items_deleted_at_idx" ON "supplier_items" ("deleted_at");
