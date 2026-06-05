/*
  Warnings:

  - A unique constraint covering the columns `[meal_plan_group_id,production_line_id,material_master_id]` on the table `material_requirements` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `material_requirements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "material_requirements" ADD COLUMN     "generation_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "production_line_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "material_requirement_id" TEXT;

-- CreateIndex
CREATE INDEX "material_requirements_production_line_id_idx" ON "material_requirements"("production_line_id");

-- CreateIndex
CREATE INDEX "material_requirements_location_id_idx" ON "material_requirements"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_requirements_meal_plan_group_id_production_line_id_key" ON "material_requirements"("meal_plan_group_id", "production_line_id", "material_master_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_material_requirement_id_idx" ON "purchase_order_items"("material_requirement_id");

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_requirement_id_fkey" FOREIGN KEY ("material_requirement_id") REFERENCES "material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
