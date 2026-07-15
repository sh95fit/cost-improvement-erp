/*
  Warnings:

  - You are about to drop the `shipping_order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipping_orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "shipping_order_items" DROP CONSTRAINT "shipping_order_items_material_master_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_order_items" DROP CONSTRAINT "shipping_order_items_shipping_order_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_order_items" DROP CONSTRAINT "shipping_order_items_subsidiary_master_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_orders" DROP CONSTRAINT "shipping_orders_company_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_orders" DROP CONSTRAINT "shipping_orders_lineup_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_orders" DROP CONSTRAINT "shipping_orders_location_id_fkey";

-- DropForeignKey
ALTER TABLE "shipping_orders" DROP CONSTRAINT "shipping_orders_meal_plan_group_id_fkey";

-- DropTable
DROP TABLE "shipping_order_items";

-- DropTable
DROP TABLE "shipping_orders";

-- DropEnum
DROP TYPE "shipping_status";
