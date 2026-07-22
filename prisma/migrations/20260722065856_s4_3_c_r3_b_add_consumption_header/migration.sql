/*
  Warnings:

  - Added the required column `header_id` to the `consumption_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "consumption_header_source" AS ENUM ('AUTO_MEAL_PLAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "consumption_header_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "consumption_items" ADD COLUMN     "header_id" TEXT NOT NULL,
ADD COLUMN     "supplier_item_id" TEXT;

-- CreateTable
CREATE TABLE "consumption_headers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "production_line_id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "consumed_date" DATE NOT NULL,
    "source" "consumption_header_source" NOT NULL DEFAULT 'AUTO_MEAL_PLAN',
    "status" "consumption_header_status" NOT NULL DEFAULT 'PENDING',
    "manual_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumption_headers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consumption_headers_company_id_consumed_date_idx" ON "consumption_headers"("company_id", "consumed_date");

-- CreateIndex
CREATE INDEX "consumption_headers_status_idx" ON "consumption_headers"("status");

-- CreateIndex
CREATE INDEX "consumption_headers_meal_plan_group_id_idx" ON "consumption_headers"("meal_plan_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumption_headers_meal_plan_group_id_location_id_producti_key" ON "consumption_headers"("meal_plan_group_id", "location_id", "production_line_id", "source");

-- CreateIndex
CREATE INDEX "consumption_items_header_id_idx" ON "consumption_items"("header_id");

-- CreateIndex
CREATE INDEX "consumption_items_supplier_item_id_idx" ON "consumption_items"("supplier_item_id");

-- AddForeignKey
ALTER TABLE "consumption_headers" ADD CONSTRAINT "consumption_headers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_headers" ADD CONSTRAINT "consumption_headers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_headers" ADD CONSTRAINT "consumption_headers_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_headers" ADD CONSTRAINT "consumption_headers_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_headers" ADD CONSTRAINT "consumption_headers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_headers" ADD CONSTRAINT "consumption_headers_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_header_id_fkey" FOREIGN KEY ("header_id") REFERENCES "consumption_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
