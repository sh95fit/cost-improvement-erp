-- This is an empty migration.-- Partial unique indexes for soft-delete models
-- deleted_at IS NULL 조건으로 활성 레코드에만 유니크 제약 적용

-- MaterialMaster: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "material_masters_company_id_code_active" 
ON "material_masters" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- SubsidiaryMaster: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "subsidiary_masters_company_id_code_active" 
ON "subsidiary_masters" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- Supplier: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "suppliers_company_id_code_active" 
ON "suppliers" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- Recipe: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "recipes_company_id_code_active" 
ON "recipes" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- SemiProduct: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "semi_products_company_id_code_active" 
ON "semi_products" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- ContainerGroup: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "container_groups_company_id_code_active" 
ON "container_groups" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- Lineup: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "lineups_company_id_code_active" 
ON "lineups" ("company_id", "code") 
WHERE "deleted_at" IS NULL;

-- Location: companyId + code (활성 레코드만)
CREATE UNIQUE INDEX "locations_company_id_code_active" 
ON "locations" ("company_id", "code") 
WHERE "deleted_at" IS NULL;
