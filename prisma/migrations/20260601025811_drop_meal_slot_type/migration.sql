/*
  Warnings:

  - You are about to drop the column `slot_type` on the `meal_counts` table. All the data in the column will be lost.
  - You are about to drop the column `slot_type` on the `meal_plans` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[meal_plan_group_id,company_meal_slot_id,lineup_id]` on the table `meal_counts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "meal_counts" DROP CONSTRAINT "meal_counts_company_meal_slot_id_fkey";

-- DropForeignKey
ALTER TABLE "meal_plans" DROP CONSTRAINT "meal_plans_company_meal_slot_id_fkey";

-- DropIndex
DROP INDEX "meal_counts_meal_plan_group_id_slot_type_lineup_id_key";

-- AlterTable
ALTER TABLE "meal_counts" DROP COLUMN "slot_type";

-- AlterTable
ALTER TABLE "meal_plans" DROP COLUMN "slot_type";

-- DropEnum
DROP TYPE "meal_slot_type";

-- CreateIndex
CREATE UNIQUE INDEX "meal_counts_meal_plan_group_id_company_meal_slot_id_lineup__key" ON "meal_counts"("meal_plan_group_id", "company_meal_slot_id", "lineup_id");
