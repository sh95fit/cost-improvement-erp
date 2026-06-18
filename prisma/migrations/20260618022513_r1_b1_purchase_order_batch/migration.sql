-- ★ R1-b1: PurchaseOrderBatch + POAdjustmentLog + PurchaseOrder.batchId

-- CreateEnum
CREATE TYPE "po_batch_mode" AS ENUM ('NEW', 'DELTA', 'REPLACE');

-- CreateEnum
CREATE TYPE "po_adjustment_action" AS ENUM ('ADD', 'UPDATE_QUANTITY', 'UPDATE_UNIT_PRICE', 'REMOVE', 'NOTE_CHANGE');

-- CreateTable
CREATE TABLE "purchase_order_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "meal_plan_group_id" TEXT,
    "countSource" "meal_count_source" NOT NULL,
    "mode" "po_batch_mode" NOT NULL,
    "based_on_po_ids" TEXT[],
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_batches_company_id_idempotency_key_key"
ON "purchase_order_batches"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "purchase_order_batches_meal_plan_group_id_idx"
ON "purchase_order_batches"("meal_plan_group_id");

CREATE INDEX "purchase_order_batches_created_at_idx"
ON "purchase_order_batches"("created_at");

-- AddForeignKey
ALTER TABLE "purchase_order_batches" ADD CONSTRAINT "purchase_order_batches_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_batches" ADD CONSTRAINT "purchase_order_batches_meal_plan_group_id_fkey"
  FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_batches" ADD CONSTRAINT "purchase_order_batches_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable (PurchaseOrder.batchId)
ALTER TABLE "purchase_orders" ADD COLUMN "batch_id" TEXT;

CREATE INDEX "purchase_orders_batch_id_idx" ON "purchase_orders"("batch_id");

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "purchase_order_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable POAdjustmentLog (R1-b3 에서 사용, 선행 생성)
CREATE TABLE "po_adjustment_logs" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT,
    "action" "po_adjustment_action" NOT NULL,
    "field_name" TEXT,
    "before_value" TEXT,
    "after_value" TEXT,
    "reason" TEXT NOT NULL,
    "source_batch_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_adjustment_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "po_adjustment_logs_purchase_order_id_idx" ON "po_adjustment_logs"("purchase_order_id");
CREATE INDEX "po_adjustment_logs_source_batch_id_idx" ON "po_adjustment_logs"("source_batch_id");
CREATE INDEX "po_adjustment_logs_created_at_idx" ON "po_adjustment_logs"("created_at");

ALTER TABLE "po_adjustment_logs" ADD CONSTRAINT "po_adjustment_logs_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "po_adjustment_logs" ADD CONSTRAINT "po_adjustment_logs_purchase_order_item_id_fkey"
  FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "po_adjustment_logs" ADD CONSTRAINT "po_adjustment_logs_source_batch_id_fkey"
  FOREIGN KEY ("source_batch_id") REFERENCES "purchase_order_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "po_adjustment_logs" ADD CONSTRAINT "po_adjustment_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
