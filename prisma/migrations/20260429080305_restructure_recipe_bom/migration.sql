/*
  Warnings:

  - You are about to drop the column `item_type` on the `bom_items` table. All the data in the column will be lost.
  - You are about to drop the column `subsidiary_master_id` on the `bom_items` table. All the data in the column will be lost.
  - You are about to drop the column `owner_type` on the `boms` table. All the data in the column will be lost.
  - You are about to drop the column `recipe_variant_id` on the `boms` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `cooking_plan_items` table. All the data in the column will be lost.
  - You are about to drop the column `recipe_variant_id` on the `cooking_plan_slots` table. All the data in the column will be lost.
  - You are about to drop the column `slot_type` on the `cooking_plan_slots` table. All the data in the column will be lost.
  - You are about to drop the column `actual_meals` on the `cooking_plans` table. All the data in the column will be lost.
  - You are about to drop the column `expected_meals` on the `cooking_plans` table. All the data in the column will be lost.
  - You are about to drop the column `meal_plan_group_id` on the `cooking_plans` table. All the data in the column will be lost.
  - You are about to drop the column `replaced_by_id` on the `cooking_plans` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `cooking_plans` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `cost_calculations` table. All the data in the column will be lost.
  - You are about to drop the column `target_month` on the `cost_calculations` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `cost_snapshot_items` table. All the data in the column will be lost.
  - You are about to drop the column `total_price` on the `cost_snapshot_items` table. All the data in the column will be lost.
  - You are about to drop the column `unit_price` on the `cost_snapshot_items` table. All the data in the column will be lost.
  - You are about to drop the column `cost_type` on the `cost_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `target_month` on the `cost_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `recipe_variant_id` on the `meal_plan_slots` table. All the data in the column will be lost.
  - You are about to drop the column `cost_per_meal` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `data_json` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `is_locked` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `snapshot_type` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `target_month` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `total_material_cost` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `total_meal_count` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `total_overhead_cost` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `total_subsidiary_cost` on the `month_end_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `target_month` on the `overhead_costs` table. All the data in the column will be lost.
  - You are about to drop the `recipe_variants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `serving_set_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `serving_sets` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cooking_plan_id,slot_index]` on the table `cooking_plan_slots` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_id,closing_month]` on the table `month_end_snapshots` will be added. If there are existing duplicate values, this will fail.
  - Made the column `material_master_id` on table `bom_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `semi_product_id` on table `boms` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `slot_index` to the `cooking_plan_slots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `cooking_plan_slots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plan_date` to the `cooking_plans` table without a default value. This is not possible if the table is not empty.
  - Made the column `production_line_id` on table `cooking_plans` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `reference_id` to the `cost_calculations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference_type` to the `cost_calculations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `avg_unit_price` to the `cost_snapshot_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_cost` to the `cost_snapshot_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_qty` to the `cost_snapshot_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_end` to the `cost_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period_start` to the `cost_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshot_type` to the `cost_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `closing_month` to the `month_end_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshot_data` to the `month_end_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `notification_tag_defs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `month` to the `overhead_costs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ingredient_type" AS ENUM ('MATERIAL', 'SEMI_PRODUCT');

-- DropForeignKey
ALTER TABLE "bom_items" DROP CONSTRAINT "bom_items_material_master_id_fkey";

-- DropForeignKey
ALTER TABLE "bom_items" DROP CONSTRAINT "bom_items_subsidiary_master_id_fkey";

-- DropForeignKey
ALTER TABLE "boms" DROP CONSTRAINT "boms_recipe_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "boms" DROP CONSTRAINT "boms_semi_product_id_fkey";

-- DropForeignKey
ALTER TABLE "consumption_items" DROP CONSTRAINT "consumption_items_cooking_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "cooking_plan_slots" DROP CONSTRAINT "cooking_plan_slots_recipe_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "cooking_plans" DROP CONSTRAINT "cooking_plans_production_line_id_fkey";

-- DropForeignKey
ALTER TABLE "cooking_plans" DROP CONSTRAINT "cooking_plans_replaced_by_id_fkey";

-- DropForeignKey
ALTER TABLE "meal_plan_slots" DROP CONSTRAINT "meal_plan_slots_recipe_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "recipe_variants" DROP CONSTRAINT "recipe_variants_recipe_id_fkey";

-- DropForeignKey
ALTER TABLE "serving_set_items" DROP CONSTRAINT "serving_set_items_container_group_id_fkey";

-- DropForeignKey
ALTER TABLE "serving_set_items" DROP CONSTRAINT "serving_set_items_serving_set_id_fkey";

-- DropForeignKey
ALTER TABLE "serving_sets" DROP CONSTRAINT "serving_sets_company_id_fkey";

-- DropForeignKey
ALTER TABLE "serving_sets" DROP CONSTRAINT "serving_sets_recipe_variant_id_fkey";

-- DropIndex
DROP INDEX "bom_items_subsidiary_master_id_idx";

-- DropIndex
DROP INDEX "boms_recipe_variant_id_idx";

-- DropIndex
DROP INDEX "consumption_items_cooking_plan_id_idx";

-- DropIndex
DROP INDEX "cooking_plan_slots_cooking_plan_id_slot_type_key";

-- DropIndex
DROP INDEX "cooking_plan_slots_recipe_variant_id_idx";

-- DropIndex
DROP INDEX "cooking_plans_meal_plan_group_id_idx";

-- DropIndex
DROP INDEX "cost_calculation_items_material_master_id_idx";

-- DropIndex
DROP INDEX "cost_calculations_target_month_idx";

-- DropIndex
DROP INDEX "cost_snapshot_items_material_master_id_idx";

-- DropIndex
DROP INDEX "cost_snapshots_target_month_idx";

-- DropIndex
DROP INDEX "meal_plan_slots_recipe_variant_id_idx";

-- DropIndex
DROP INDEX "month_end_snapshots_company_id_target_month_snapshot_type_key";

-- DropIndex
DROP INDEX "month_end_snapshots_target_month_idx";

-- DropIndex
DROP INDEX "notification_logs_created_at_idx";

-- DropIndex
DROP INDEX "notification_rules_event_type_idx";

-- DropIndex
DROP INDEX "overhead_costs_target_month_idx";

-- AlterTable
ALTER TABLE "bom_items" DROP COLUMN "item_type",
DROP COLUMN "subsidiary_master_id",
ALTER COLUMN "material_master_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "boms" DROP COLUMN "owner_type",
DROP COLUMN "recipe_variant_id",
ADD COLUMN     "base_quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "base_unit" TEXT NOT NULL DEFAULT 'kg',
ALTER COLUMN "semi_product_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "consumption_items" ALTER COLUMN "cooking_plan_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "cooking_plan_items" DROP COLUMN "note";

-- AlterTable
ALTER TABLE "cooking_plan_slots" DROP COLUMN "recipe_variant_id",
DROP COLUMN "slot_type",
ADD COLUMN     "recipe_bom_id" TEXT,
ADD COLUMN     "recipe_id" TEXT,
ADD COLUMN     "slot_index" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "servings" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "cooking_plans" DROP COLUMN "actual_meals",
DROP COLUMN "expected_meals",
DROP COLUMN "meal_plan_group_id",
DROP COLUMN "replaced_by_id",
DROP COLUMN "version",
ADD COLUMN     "plan_date" DATE NOT NULL,
ALTER COLUMN "production_line_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "cost_calculations" DROP COLUMN "note",
DROP COLUMN "target_month",
ADD COLUMN     "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cost_per_unit" DOUBLE PRECISION,
ADD COLUMN     "reference_id" TEXT NOT NULL,
ADD COLUMN     "reference_type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cost_snapshot_items" DROP COLUMN "quantity",
DROP COLUMN "total_price",
DROP COLUMN "unit_price",
ADD COLUMN     "avg_unit_price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "total_cost" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "total_qty" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "cost_snapshots" DROP COLUMN "cost_type",
DROP COLUMN "target_month",
ADD COLUMN     "period_end" DATE NOT NULL,
ADD COLUMN     "period_start" DATE NOT NULL,
ADD COLUMN     "snapshot_type" "snapshot_type" NOT NULL;

-- AlterTable
ALTER TABLE "meal_plan_slots" DROP COLUMN "recipe_variant_id",
ADD COLUMN     "recipe_bom_id" TEXT,
ADD COLUMN     "recipe_id" TEXT;

-- AlterTable
ALTER TABLE "month_end_adjustment_items" ALTER COLUMN "before_value" SET DATA TYPE TEXT,
ALTER COLUMN "after_value" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "month_end_adjustments" ALTER COLUMN "adjustment_number" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "month_end_snapshots" DROP COLUMN "cost_per_meal",
DROP COLUMN "data_json",
DROP COLUMN "is_locked",
DROP COLUMN "snapshot_type",
DROP COLUMN "target_month",
DROP COLUMN "total_material_cost",
DROP COLUMN "total_meal_count",
DROP COLUMN "total_overhead_cost",
DROP COLUMN "total_subsidiary_cost",
ADD COLUMN     "closing_month" DATE NOT NULL,
ADD COLUMN     "snapshot_data" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "notification_tag_defs" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "overhead_costs" DROP COLUMN "target_month",
ADD COLUMN     "month" DATE NOT NULL;

-- DropTable
DROP TABLE "recipe_variants";

-- DropTable
DROP TABLE "serving_set_items";

-- DropTable
DROP TABLE "serving_sets";

-- DropEnum
DROP TYPE "owner_type";

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "ingredient_type" "ingredient_type" NOT NULL,
    "material_master_id" TEXT,
    "semi_product_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_boms" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "bom_status" NOT NULL DEFAULT 'DRAFT',
    "base_weight_g" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recipe_boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_bom_slots" (
    "id" TEXT NOT NULL,
    "recipe_bom_id" TEXT NOT NULL,
    "container_group_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "total_weight_g" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_bom_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_bom_slot_items" (
    "id" TEXT NOT NULL,
    "recipe_bom_slot_id" TEXT NOT NULL,
    "ingredient_type" "ingredient_type" NOT NULL,
    "material_master_id" TEXT,
    "semi_product_id" TEXT,
    "weight_g" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_bom_slot_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_material_master_id_idx" ON "recipe_ingredients"("material_master_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_semi_product_id_idx" ON "recipe_ingredients"("semi_product_id");

-- CreateIndex
CREATE INDEX "recipe_boms_company_id_idx" ON "recipe_boms"("company_id");

-- CreateIndex
CREATE INDEX "recipe_boms_recipe_id_idx" ON "recipe_boms"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slots_recipe_bom_id_idx" ON "recipe_bom_slots"("recipe_bom_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slots_container_group_id_idx" ON "recipe_bom_slots"("container_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_bom_slots_recipe_bom_id_container_group_id_slot_inde_key" ON "recipe_bom_slots"("recipe_bom_id", "container_group_id", "slot_index");

-- CreateIndex
CREATE INDEX "recipe_bom_slot_items_recipe_bom_slot_id_idx" ON "recipe_bom_slot_items"("recipe_bom_slot_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slot_items_material_master_id_idx" ON "recipe_bom_slot_items"("material_master_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slot_items_semi_product_id_idx" ON "recipe_bom_slot_items"("semi_product_id");

-- CreateIndex
CREATE INDEX "cooking_plan_slots_recipe_id_idx" ON "cooking_plan_slots"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "cooking_plan_slots_cooking_plan_id_slot_index_key" ON "cooking_plan_slots"("cooking_plan_id", "slot_index");

-- CreateIndex
CREATE INDEX "cooking_plans_production_line_id_idx" ON "cooking_plans"("production_line_id");

-- CreateIndex
CREATE INDEX "cooking_plans_plan_date_idx" ON "cooking_plans"("plan_date");

-- CreateIndex
CREATE INDEX "cost_calculations_reference_type_reference_id_idx" ON "cost_calculations"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "cost_snapshots_period_start_idx" ON "cost_snapshots"("period_start");

-- CreateIndex
CREATE INDEX "meal_plan_slots_recipe_id_idx" ON "meal_plan_slots"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "month_end_snapshots_company_id_closing_month_key" ON "month_end_snapshots"("company_id", "closing_month");

-- CreateIndex
CREATE INDEX "overhead_costs_month_idx" ON "overhead_costs"("month");

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_boms" ADD CONSTRAINT "recipe_boms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_boms" ADD CONSTRAINT "recipe_boms_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slots" ADD CONSTRAINT "recipe_bom_slots_recipe_bom_id_fkey" FOREIGN KEY ("recipe_bom_id") REFERENCES "recipe_boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slots" ADD CONSTRAINT "recipe_bom_slots_container_group_id_fkey" FOREIGN KEY ("container_group_id") REFERENCES "container_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slot_items" ADD CONSTRAINT "recipe_bom_slot_items_recipe_bom_slot_id_fkey" FOREIGN KEY ("recipe_bom_slot_id") REFERENCES "recipe_bom_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slot_items" ADD CONSTRAINT "recipe_bom_slot_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slot_items" ADD CONSTRAINT "recipe_bom_slot_items_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plans" ADD CONSTRAINT "cooking_plans_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_slots" ADD CONSTRAINT "cooking_plan_slots_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
