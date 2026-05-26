/*
  Warnings:

  - You are about to drop the column `lineup_id` on the `meal_plan_groups` table. All the data in the column will be lost.
  - You are about to drop the column `slot_index` on the `meal_plan_slots` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[meal_plan_group_id,slot_type,lineup_id]` on the table `meal_counts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_id,plan_date]` on the table `meal_plan_groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[meal_plan_group_id,slot_type,lineup_id]` on the table `meal_plans` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lineup_id` to the `meal_counts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lineup_id` to the `meal_plans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "slot_kind" AS ENUM ('CONTAINER', 'DIRECT');

-- AlterEnum
ALTER TYPE "meal_slot_type" ADD VALUE 'EVENT';

-- DropForeignKey
ALTER TABLE "meal_plan_groups" DROP CONSTRAINT "meal_plan_groups_lineup_id_fkey";

-- DropIndex
DROP INDEX "meal_counts_meal_plan_group_id_slot_type_key";

-- DropIndex
DROP INDEX "meal_plan_groups_company_id_lineup_id_plan_date_key";

-- DropIndex
DROP INDEX "meal_plan_groups_lineup_id_idx";

-- DropIndex
DROP INDEX "meal_plan_slots_meal_plan_id_slot_index_key";

-- DropIndex
DROP INDEX "meal_plans_meal_plan_group_id_slot_type_key";

-- AlterTable
ALTER TABLE "meal_counts" ADD COLUMN     "lineup_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "meal_plan_groups" DROP COLUMN "lineup_id",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "meal_plan_slots" DROP COLUMN "slot_index",
ADD COLUMN     "container_slot_index" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "kind" "slot_kind" NOT NULL DEFAULT 'CONTAINER',
ADD COLUMN     "production_line_id" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subsidiary_master_id" TEXT,
ADD COLUMN     "supplier_item_id" TEXT;

-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "lineup_id" TEXT NOT NULL,
ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE INDEX "meal_counts_lineup_id_idx" ON "meal_counts"("lineup_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_counts_meal_plan_group_id_slot_type_lineup_id_key" ON "meal_counts"("meal_plan_group_id", "slot_type", "lineup_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_groups_company_id_plan_date_key" ON "meal_plan_groups"("company_id", "plan_date");

-- CreateIndex
CREATE INDEX "meal_plan_slots_kind_idx" ON "meal_plan_slots"("kind");

-- CreateIndex
CREATE INDEX "meal_plan_slots_recipe_bom_id_idx" ON "meal_plan_slots"("recipe_bom_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_subsidiary_master_id_idx" ON "meal_plan_slots"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_supplier_item_id_idx" ON "meal_plan_slots"("supplier_item_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_production_line_id_idx" ON "meal_plan_slots"("production_line_id");

-- CreateIndex
CREATE INDEX "meal_plans_lineup_id_idx" ON "meal_plans"("lineup_id");

-- CreateIndex
CREATE INDEX "meal_plans_meal_template_id_idx" ON "meal_plans"("meal_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plans_meal_plan_group_id_slot_type_lineup_id_key" ON "meal_plans"("meal_plan_group_id", "slot_type", "lineup_id");

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_recipe_bom_id_fkey" FOREIGN KEY ("recipe_bom_id") REFERENCES "recipe_boms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_counts" ADD CONSTRAINT "meal_counts_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
