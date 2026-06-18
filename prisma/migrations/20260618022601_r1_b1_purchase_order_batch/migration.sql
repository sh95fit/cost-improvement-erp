-- DropForeignKey
ALTER TABLE "po_adjustment_logs" DROP CONSTRAINT "po_adjustment_logs_purchase_order_id_fkey";

-- AddForeignKey
ALTER TABLE "po_adjustment_logs" ADD CONSTRAINT "po_adjustment_logs_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
