-- CreateEnum
CREATE TYPE "PurchaseKind" AS ENUM ('WIZARD', 'MANUAL_JIT', 'STOCK_KEEPING');

-- CreateEnum
CREATE TYPE "ConsumptionSourceType" AS ENUM ('MEAL_PLAN_AUTO', 'MANUAL_ADDITION');

-- AlterTable
ALTER TABLE "consumption_items" ADD COLUMN     "sourceType" "ConsumptionSourceType" NOT NULL DEFAULT 'MEAL_PLAN_AUTO';

-- AlterTable
ALTER TABLE "material_masters" ADD COLUMN     "isStockKeeping" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "purchaseKind" "PurchaseKind" NOT NULL DEFAULT 'WIZARD';

-- CreateIndex
CREATE INDEX "consumption_items_sourceType_idx" ON "consumption_items"("sourceType");

-- CreateIndex
CREATE INDEX "material_masters_isStockKeeping_idx" ON "material_masters"("isStockKeeping");

-- CreateIndex
CREATE INDEX "purchase_orders_purchaseKind_idx" ON "purchase_orders"("purchaseKind");


-- ============================================================
-- S4-0-a 백필: 기존 PurchaseOrder.isManual → purchaseKind 매핑
-- 주의: 신규 컬럼은 camelCase("purchaseKind"), 기존 컬럼은 snake_case("is_manual")
-- ============================================================
UPDATE "purchase_orders"
SET "purchaseKind" = 'MANUAL_JIT'
WHERE "is_manual" = true;

-- WIZARD 는 default 로 이미 채워짐.
-- material_masters.isStockKeeping / consumption_items.sourceType 도
-- default 로 자동 백필됨.