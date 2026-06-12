-- ════════════════════════════════════════════════════════════
-- Phase 10-A Step 2: SupplierItem.supply_unit → supply_unit_id FK
--   (PACKAGE 카테고리 이전은 step3에서 처리 — 트랜잭션 분리 필요)
-- ════════════════════════════════════════════════════════════

-- ── 1. supplier_items에 supply_unit_id 컬럼 추가 (nullable)
ALTER TABLE "supplier_items" ADD COLUMN "supply_unit_id" TEXT;

-- ── 2. 기존 supply_unit 문자열을 supply_unit_id로 변환
UPDATE "supplier_items" si
   SET "supply_unit_id" = um.id
  FROM "unit_masters" um, "suppliers" s
 WHERE si.supplier_id = s.id
   AND um.company_id = s.company_id
   AND um.item_type = si.item_type
   AND um.code = si.supply_unit;

-- ── 3. 변환 누락 안전망
DO $$
DECLARE
  unmapped_count INT;
BEGIN
  SELECT COUNT(*) INTO unmapped_count FROM "supplier_items" WHERE "supply_unit_id" IS NULL;
  IF unmapped_count > 0 THEN
    RAISE EXCEPTION 'Phase 10-A step2 migration aborted: % supplier_items rows could not be mapped to unit_masters.', unmapped_count;
  END IF;
END $$;

-- ── 4. NOT NULL + FK + 인덱스
ALTER TABLE "supplier_items" ALTER COLUMN "supply_unit_id" SET NOT NULL;
ALTER TABLE "supplier_items"
  ADD CONSTRAINT "supplier_items_supply_unit_id_fkey"
  FOREIGN KEY ("supply_unit_id") REFERENCES "unit_masters"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "supplier_items_supply_unit_id_idx" ON "supplier_items"("supply_unit_id");

-- ── 5. 기존 supply_unit 컬럼 제거
ALTER TABLE "supplier_items" DROP COLUMN "supply_unit";
