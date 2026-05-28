-- Phase 5-R Step 3.1: CompanyMealSlot 마스터 테이블 신설
-- 목적: MealSlotType enum을 대체하기 위한 회사 단위 식단 슬롯 마스터.
-- 본 마이그레이션은 테이블 신설만 수행. MealPlan/MealCount.slot_type 컬럼은
-- Step 3.2 마이그레이션에서 별도로 FK 교체 예정.

-- CreateTable
CREATE TABLE "company_meal_slots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "company_meal_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (일반 unique — Lineup 패턴과 동일)
CREATE UNIQUE INDEX "company_meal_slots_company_id_code_key"
    ON "company_meal_slots"("company_id", "code");

-- CreateIndex (조회/정렬용)
CREATE INDEX "company_meal_slots_company_id_idx"
    ON "company_meal_slots"("company_id");
CREATE INDEX "company_meal_slots_company_id_sort_order_idx"
    ON "company_meal_slots"("company_id", "sort_order");
CREATE INDEX "company_meal_slots_is_active_idx"
    ON "company_meal_slots"("is_active");
CREATE INDEX "company_meal_slots_deleted_at_idx"
    ON "company_meal_slots"("deleted_at");

-- AddForeignKey
ALTER TABLE "company_meal_slots"
    ADD CONSTRAINT "company_meal_slots_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
