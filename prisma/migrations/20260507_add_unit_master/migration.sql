-- CreateTable: UnitMaster
CREATE TABLE "unit_masters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL,
    "unit_category" "unit_category" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unit_masters_company_id_item_type_unit_category_idx" ON "unit_masters"("company_id", "item_type", "unit_category");

-- CreateUnique
CREATE UNIQUE INDEX "unit_masters_company_id_item_type_code_key" ON "unit_masters"("company_id", "item_type", "code");

-- AddForeignKey
ALTER TABLE "unit_masters" ADD CONSTRAINT "unit_masters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SubsidiaryMaster에 unit_category 추가
ALTER TABLE "subsidiary_masters" ADD COLUMN "unit_category" "unit_category" NOT NULL DEFAULT 'COUNT';

-- AlterTable: UnitConversion에 subsidiary_master_id 추가
ALTER TABLE "unit_conversions" ADD COLUMN "subsidiary_master_id" TEXT;

-- CreateIndex
CREATE INDEX "unit_conversions_subsidiary_master_id_idx" ON "unit_conversions"("subsidiary_master_id");

-- DropIndex (기존 unique 제약 교체)
DROP INDEX IF EXISTS "unit_conversions_company_id_material_master_id_from_unit_to_unit_key";

-- CreateUnique (새 unique 제약)
CREATE UNIQUE INDEX "unit_conversions_company_id_material_master_id_subsidiary_mas_key" ON "unit_conversions"("company_id", "material_master_id", "subsidiary_master_id", "from_unit", "to_unit");

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
