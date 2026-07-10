-- DropForeignKey
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_material_master_id_fkey";

-- AlterTable
ALTER TABLE "inventory_transactions" ADD COLUMN     "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "subsidiary_master_id" TEXT,
ALTER COLUMN "material_master_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inventory_transactions_item_type_idx" ON "inventory_transactions"("item_type");

-- CreateIndex
CREATE INDEX "inventory_transactions_subsidiary_master_id_idx" ON "inventory_transactions"("subsidiary_master_id");

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- S4-0-b XOR CHECK constraint
-- item_type=MATERIAL 이면 material_master_id NOT NULL, subsidiary_master_id NULL
-- item_type=SUBSIDIARY 이면 subsidiary_master_id NOT NULL, material_master_id NULL
-- ============================================================
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_item_type_xor" CHECK (
    (item_type = 'MATERIAL'   AND material_master_id   IS NOT NULL AND subsidiary_master_id IS NULL)
 OR (item_type = 'SUBSIDIARY' AND subsidiary_master_id IS NOT NULL AND material_master_id   IS NULL)
  );

-- 검증 쿼리 (배포 시 참고, 주석 유지):
-- SELECT item_type, COUNT(*) FROM inventory_transactions
--   WHERE (item_type='MATERIAL' AND material_master_id IS NULL)
--      OR (item_type='SUBSIDIARY' AND subsidiary_master_id IS NULL)
--      OR (item_type='MATERIAL' AND subsidiary_master_id IS NOT NULL)
--      OR (item_type='SUBSIDIARY' AND material_master_id IS NOT NULL)
--   GROUP BY item_type;
-- 기대: 0 rows.