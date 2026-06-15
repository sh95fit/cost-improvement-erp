-- CreateEnum
CREATE TYPE "consumption_disposition" AS ENUM ('USED', 'RETURNED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "disposal_reason" AS ENUM ('EXPIRED', 'DAMAGED', 'CONTAMINATED', 'OVER_PREPARED', 'OTHER');

-- DropForeignKey
ALTER TABLE "consumption_items" DROP CONSTRAINT "consumption_items_material_master_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_lots" DROP CONSTRAINT "inventory_lots_material_master_id_fkey";

-- AlterTable
ALTER TABLE "consumption_items" ADD COLUMN     "disposal_note" TEXT,
ADD COLUMN     "disposal_reason" "disposal_reason",
ADD COLUMN     "disposition" "consumption_disposition" NOT NULL DEFAULT 'USED',
ADD COLUMN     "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "subsidiary_master_id" TEXT,
ALTER COLUMN "material_master_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "inventory_lots" ALTER COLUMN "material_master_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "approved_by_user_id" TEXT,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_user_id" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "consumption_items_subsidiary_master_id_idx" ON "consumption_items"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "consumption_items_disposition_idx" ON "consumption_items"("disposition");

-- CreateIndex
CREATE INDEX "consumption_items_disposition_consumed_date_idx" ON "consumption_items"("disposition", "consumed_date");

-- CreateIndex
CREATE INDEX "inventory_lots_item_type_idx" ON "inventory_lots"("item_type");

-- CreateIndex
CREATE INDEX "inventory_lots_subsidiary_master_id_idx" ON "inventory_lots"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
