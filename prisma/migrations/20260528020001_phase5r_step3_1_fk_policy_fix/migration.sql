-- DropForeignKey
ALTER TABLE "company_meal_slots" DROP CONSTRAINT "company_meal_slots_company_id_fkey";

-- AddForeignKey
ALTER TABLE "company_meal_slots" ADD CONSTRAINT "company_meal_slots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
