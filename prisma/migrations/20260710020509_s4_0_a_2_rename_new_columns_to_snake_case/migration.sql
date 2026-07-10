/*
  Warnings:

  - You are about to drop the column `sourceType` on the `consumption_items` table. All the data in the column will be lost.
  - You are about to drop the column `isStockKeeping` on the `material_masters` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseKind` on the `purchase_orders` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "consumption_items_sourceType_idx";

-- DropIndex
DROP INDEX "material_masters_isStockKeeping_idx";

-- DropIndex
DROP INDEX "purchase_orders_purchaseKind_idx";

-- AlterTable
ALTER TABLE "consumption_items" DROP COLUMN "sourceType",
ADD COLUMN     "source_type" "ConsumptionSourceType" NOT NULL DEFAULT 'MEAL_PLAN_AUTO';

-- AlterTable
ALTER TABLE "material_masters" DROP COLUMN "isStockKeeping",
ADD COLUMN     "is_stock_keeping" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "purchaseKind",
ADD COLUMN     "purchase_kind" "PurchaseKind" NOT NULL DEFAULT 'WIZARD';

-- CreateIndex
CREATE INDEX "consumption_items_source_type_idx" ON "consumption_items"("source_type");

-- CreateIndex
CREATE INDEX "material_masters_is_stock_keeping_idx" ON "material_masters"("is_stock_keeping");

-- CreateIndex
CREATE INDEX "purchase_orders_purchase_kind_idx" ON "purchase_orders"("purchase_kind");
