-- AlterTable
ALTER TABLE "recipe_variants" ADD COLUMN     "base_weight_g" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "serving_sets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recipe_variant_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "bom_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "serving_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serving_set_items" (
    "id" TEXT NOT NULL,
    "serving_set_id" TEXT NOT NULL,
    "container_group_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "serving_weight_g" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serving_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "serving_sets_company_id_idx" ON "serving_sets"("company_id");

-- CreateIndex
CREATE INDEX "serving_sets_recipe_variant_id_idx" ON "serving_sets"("recipe_variant_id");

-- CreateIndex
CREATE INDEX "serving_set_items_serving_set_id_idx" ON "serving_set_items"("serving_set_id");

-- CreateIndex
CREATE INDEX "serving_set_items_container_group_id_idx" ON "serving_set_items"("container_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "serving_set_items_serving_set_id_container_group_id_slot_in_key" ON "serving_set_items"("serving_set_id", "container_group_id", "slot_index");

-- AddForeignKey
ALTER TABLE "serving_sets" ADD CONSTRAINT "serving_sets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serving_sets" ADD CONSTRAINT "serving_sets_recipe_variant_id_fkey" FOREIGN KEY ("recipe_variant_id") REFERENCES "recipe_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serving_set_items" ADD CONSTRAINT "serving_set_items_serving_set_id_fkey" FOREIGN KEY ("serving_set_id") REFERENCES "serving_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serving_set_items" ADD CONSTRAINT "serving_set_items_container_group_id_fkey" FOREIGN KEY ("container_group_id") REFERENCES "container_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
