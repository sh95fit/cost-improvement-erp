-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "lineup_id" TEXT;

-- CreateIndex
CREATE INDEX "purchase_orders_lineup_id_idx" ON "purchase_orders"("lineup_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
