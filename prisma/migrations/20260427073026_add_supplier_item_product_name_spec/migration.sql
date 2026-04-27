-- 1. product_name 컬럼 추가 (기본값으로 빈 문자열)
ALTER TABLE "supplier_items" ADD COLUMN "product_name" TEXT NOT NULL DEFAULT '';

-- 2. 기존 행에 materialMaster/subsidiaryMaster 이름으로 product_name 채우기
UPDATE "supplier_items" si
SET "product_name" = COALESCE(mm."name", sm."name", '미지정')
FROM "supplier_items" si2
LEFT JOIN "material_masters" mm ON si2."material_master_id" = mm."id"
LEFT JOIN "subsidiary_masters" sm ON si2."subsidiary_master_id" = sm."id"
WHERE si."id" = si2."id";

-- 3. 기본값 제거
ALTER TABLE "supplier_items" ALTER COLUMN "product_name" DROP DEFAULT;

-- 4. spec 컬럼 추가 (nullable)
ALTER TABLE "supplier_items" ADD COLUMN "spec" TEXT;

-- 5. unique 제약 추가
CREATE UNIQUE INDEX "uq_supplier_material_product" ON "supplier_items"("supplier_id", "item_type", "material_master_id", "product_name");
CREATE UNIQUE INDEX "uq_supplier_subsidiary_product" ON "supplier_items"("supplier_id", "item_type", "subsidiary_master_id", "product_name");
