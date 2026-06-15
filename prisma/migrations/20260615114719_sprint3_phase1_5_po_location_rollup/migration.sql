/*
  Warnings:

  - Added the required column `location_id` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "location_id" TEXT NOT NULL,
ADD COLUMN     "production_line_id" TEXT;

-- CreateIndex
CREATE INDEX "purchase_orders_location_id_idx" ON "purchase_orders"("location_id");

-- CreateIndex
CREATE INDEX "purchase_orders_production_line_id_idx" ON "purchase_orders"("production_line_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
