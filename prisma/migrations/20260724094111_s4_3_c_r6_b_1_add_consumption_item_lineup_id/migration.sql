/*
  Warnings:

  - Added the required column `lineup_id` to the `consumption_items` table without a default value. This is not possible if the table is not empty.

*/
-- ★ S4-3-c-R6-B-1 안전장치 (감사서 §10-15)
-- 기존 데이터 존재 시 마이그레이션 중단 (Q6 확정: 즉시 NOT NULL 도입은 zero-row 전제)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "consumption_items" LIMIT 1) THEN
    RAISE EXCEPTION 'consumption_items has existing rows; R6-B-1 requires zero rows. Run prisma migrate reset in dev, or execute two-step backfill migration in prod.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "consumption_items" ADD COLUMN     "lineup_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "consumption_items_lineup_id_idx" ON "consumption_items"("lineup_id");

-- CreateIndex
CREATE INDEX "consumption_items_consumed_date_lineup_id_idx" ON "consumption_items"("consumed_date", "lineup_id");

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
