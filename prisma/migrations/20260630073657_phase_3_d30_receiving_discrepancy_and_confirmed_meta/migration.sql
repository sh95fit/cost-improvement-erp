-- CreateEnum
CREATE TYPE "discrepancy_type" AS ENUM ('QUANTITY_SHORT', 'QUANTITY_OVER', 'UNIT_PRICE_DIFF', 'ITEM_MISSING');

-- AlterTable
ALTER TABLE "receiving_notes" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by_user_id" TEXT;

-- CreateTable
CREATE TABLE "receiving_discrepancies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT,
    "receiving_note_id" TEXT NOT NULL,
    "receiving_note_item_id" TEXT,
    "type" "discrepancy_type" NOT NULL,
    "expected_qty" DOUBLE PRECISION,
    "actual_qty" DOUBLE PRECISION,
    "expected_unit_price" DOUBLE PRECISION,
    "actual_unit_price" DOUBLE PRECISION,
    "diff_value" DOUBLE PRECISION,
    "reason" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" TEXT,

    CONSTRAINT "receiving_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receiving_discrepancies_company_id_recorded_at_idx" ON "receiving_discrepancies"("company_id", "recorded_at");

-- CreateIndex
CREATE INDEX "receiving_discrepancies_purchase_order_id_idx" ON "receiving_discrepancies"("purchase_order_id");

-- CreateIndex
CREATE INDEX "receiving_discrepancies_receiving_note_id_idx" ON "receiving_discrepancies"("receiving_note_id");

-- CreateIndex
CREATE INDEX "receiving_discrepancies_type_idx" ON "receiving_discrepancies"("type");

-- CreateIndex
CREATE INDEX "receiving_notes_confirmed_by_user_id_idx" ON "receiving_notes"("confirmed_by_user_id");

-- AddForeignKey
ALTER TABLE "receiving_notes" ADD CONSTRAINT "receiving_notes_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_receiving_note_id_fkey" FOREIGN KEY ("receiving_note_id") REFERENCES "receiving_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_discrepancies" ADD CONSTRAINT "receiving_discrepancies_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
