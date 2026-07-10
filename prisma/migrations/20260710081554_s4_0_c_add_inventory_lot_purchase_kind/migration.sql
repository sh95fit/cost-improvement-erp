-- AlterTable
ALTER TABLE "inventory_lots" ADD COLUMN     "purchase_kind" "PurchaseKind";

-- CreateIndex
CREATE INDEX "inventory_lots_purchase_kind_idx" ON "inventory_lots"("purchase_kind");

-- Back-fill purchase_kind from originating purchase order
-- (all 40 lots have receiving_note_item_id, verified 2026-07-10)
UPDATE "inventory_lots" il
SET "purchase_kind" = po."purchase_kind"
FROM "receiving_note_items" rni
JOIN "purchase_order_items" poi ON poi."id" = rni."purchase_order_item_id"
JOIN "purchase_orders" po       ON po."id"  = poi."purchase_order_id"
WHERE rni."id" = il."receiving_note_item_id";

-- Verification (comment only)
-- SELECT purchase_kind, COUNT(*) FROM inventory_lots GROUP BY 1;
-- Expected: WIZARD 35, MANUAL_JIT 4, (NULL 1 = manual/seed lot without RNI, if any)