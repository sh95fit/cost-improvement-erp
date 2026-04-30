-- AlterTable
ALTER TABLE "cooking_plan_slots" ADD COLUMN     "bom_snapshot_json" JSONB;

-- AlterTable
ALTER TABLE "recipe_boms" ADD COLUMN     "activated_at" TIMESTAMP(3);
