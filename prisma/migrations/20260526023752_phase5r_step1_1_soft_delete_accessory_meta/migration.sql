-- AlterTable
ALTER TABLE "meal_counts" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "meal_plan_accessories" ADD COLUMN     "consumption_mode" "consumption_mode" NOT NULL DEFAULT 'PER_MEAL_COUNT',
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "fixed_quantity" INTEGER,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "meal_counts_deleted_at_idx" ON "meal_counts"("deleted_at");

-- CreateIndex
CREATE INDEX "meal_plan_accessories_deleted_at_idx" ON "meal_plan_accessories"("deleted_at");
