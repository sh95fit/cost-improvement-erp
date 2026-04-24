-- CreateEnum
CREATE TYPE "receiving_note_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "consumption_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "month_end_status" AS ENUM ('DRAFT', 'LOCKED');

-- AlterTable
ALTER TABLE "cooking_plans" ADD COLUMN     "production_line_id" TEXT;

-- AlterTable
ALTER TABLE "inventory_lots" ADD COLUMN     "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "receiving_note_item_id" TEXT,
ADD COLUMN     "subsidiary_master_id" TEXT;

-- AlterTable
ALTER TABLE "month_end_snapshots" ADD COLUMN     "cost_per_meal" DOUBLE PRECISION,
ADD COLUMN     "status" "month_end_status" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "total_material_cost" DOUBLE PRECISION,
ADD COLUMN     "total_meal_count" INTEGER,
ADD COLUMN     "total_overhead_cost" DOUBLE PRECISION,
ADD COLUMN     "total_subsidiary_cost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "adjusted_quantity" DOUBLE PRECISION,
ADD COLUMN     "adjustment_reason" TEXT,
ADD COLUMN     "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "material_master_id" TEXT,
ADD COLUMN     "source_type" TEXT,
ADD COLUMN     "subsidiary_master_id" TEXT,
ADD COLUMN     "system_quantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "created_by_user_id" TEXT,
ADD COLUMN     "is_manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meal_plan_group_id" TEXT;

-- AlterTable
ALTER TABLE "shipping_order_items" ADD COLUMN     "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "subsidiary_master_id" TEXT,
ALTER COLUMN "material_master_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "shipping_orders" ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "meal_plan_group_id" TEXT;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "scope_role" NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_accessories" (
    "id" TEXT NOT NULL,
    "meal_plan_id" TEXT NOT NULL,
    "subsidiary_master_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requirements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "required_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "receive_number" TEXT NOT NULL,
    "status" "receiving_note_status" NOT NULL DEFAULT 'DRAFT',
    "received_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receiving_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_note_items" (
    "id" TEXT NOT NULL,
    "receiving_note_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT NOT NULL,
    "received_qty" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cooking_plan_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "consumed_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "consumption_status" NOT NULL DEFAULT 'DRAFT',
    "consumed_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumption_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_lot_details" (
    "id" TEXT NOT NULL,
    "consumption_item_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumption_lot_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_plan_items" (
    "id" TEXT NOT NULL,
    "cooking_plan_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "required_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooking_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_plan_slots" (
    "id" TEXT NOT NULL,
    "cooking_plan_id" TEXT NOT NULL,
    "slot_type" "meal_slot_type" NOT NULL,
    "recipe_variant_id" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooking_plan_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_calculations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cost_type" "cost_type" NOT NULL,
    "target_month" DATE NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_calculation_items" (
    "id" TEXT NOT NULL,
    "cost_calculation_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_calculation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_costs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "target_month" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overhead_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_company_id_idx" ON "invitations"("company_id");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "meal_plan_accessories_meal_plan_id_idx" ON "meal_plan_accessories"("meal_plan_id");

-- CreateIndex
CREATE INDEX "meal_plan_accessories_subsidiary_master_id_idx" ON "meal_plan_accessories"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "material_requirements_company_id_idx" ON "material_requirements"("company_id");

-- CreateIndex
CREATE INDEX "material_requirements_meal_plan_group_id_idx" ON "material_requirements"("meal_plan_group_id");

-- CreateIndex
CREATE INDEX "material_requirements_material_master_id_idx" ON "material_requirements"("material_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_notes_receive_number_key" ON "receiving_notes"("receive_number");

-- CreateIndex
CREATE INDEX "receiving_notes_company_id_idx" ON "receiving_notes"("company_id");

-- CreateIndex
CREATE INDEX "receiving_notes_purchase_order_id_idx" ON "receiving_notes"("purchase_order_id");

-- CreateIndex
CREATE INDEX "receiving_note_items_receiving_note_id_idx" ON "receiving_note_items"("receiving_note_id");

-- CreateIndex
CREATE INDEX "receiving_note_items_purchase_order_item_id_idx" ON "receiving_note_items"("purchase_order_item_id");

-- CreateIndex
CREATE INDEX "consumption_items_company_id_idx" ON "consumption_items"("company_id");

-- CreateIndex
CREATE INDEX "consumption_items_cooking_plan_id_idx" ON "consumption_items"("cooking_plan_id");

-- CreateIndex
CREATE INDEX "consumption_items_material_master_id_idx" ON "consumption_items"("material_master_id");

-- CreateIndex
CREATE INDEX "consumption_items_consumed_date_idx" ON "consumption_items"("consumed_date");

-- CreateIndex
CREATE INDEX "consumption_lot_details_consumption_item_id_idx" ON "consumption_lot_details"("consumption_item_id");

-- CreateIndex
CREATE INDEX "consumption_lot_details_inventory_lot_id_idx" ON "consumption_lot_details"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "cooking_plan_items_cooking_plan_id_idx" ON "cooking_plan_items"("cooking_plan_id");

-- CreateIndex
CREATE INDEX "cooking_plan_items_material_master_id_idx" ON "cooking_plan_items"("material_master_id");

-- CreateIndex
CREATE INDEX "cooking_plan_slots_cooking_plan_id_idx" ON "cooking_plan_slots"("cooking_plan_id");

-- CreateIndex
CREATE INDEX "cooking_plan_slots_recipe_variant_id_idx" ON "cooking_plan_slots"("recipe_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cooking_plan_slots_cooking_plan_id_slot_type_key" ON "cooking_plan_slots"("cooking_plan_id", "slot_type");

-- CreateIndex
CREATE INDEX "cost_calculations_company_id_idx" ON "cost_calculations"("company_id");

-- CreateIndex
CREATE INDEX "cost_calculations_target_month_idx" ON "cost_calculations"("target_month");

-- CreateIndex
CREATE INDEX "cost_calculation_items_cost_calculation_id_idx" ON "cost_calculation_items"("cost_calculation_id");

-- CreateIndex
CREATE INDEX "cost_calculation_items_material_master_id_idx" ON "cost_calculation_items"("material_master_id");

-- CreateIndex
CREATE INDEX "overhead_costs_company_id_idx" ON "overhead_costs"("company_id");

-- CreateIndex
CREATE INDEX "overhead_costs_target_month_idx" ON "overhead_costs"("target_month");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_accessories" ADD CONSTRAINT "meal_plan_accessories_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_accessories" ADD CONSTRAINT "meal_plan_accessories_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_notes" ADD CONSTRAINT "receiving_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_notes" ADD CONSTRAINT "receiving_notes_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_note_items" ADD CONSTRAINT "receiving_note_items_receiving_note_id_fkey" FOREIGN KEY ("receiving_note_id") REFERENCES "receiving_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_note_items" ADD CONSTRAINT "receiving_note_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_orders" ADD CONSTRAINT "shipping_orders_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_orders" ADD CONSTRAINT "shipping_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_order_items" ADD CONSTRAINT "shipping_order_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_order_items" ADD CONSTRAINT "shipping_order_items_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_lot_details" ADD CONSTRAINT "consumption_lot_details_consumption_item_id_fkey" FOREIGN KEY ("consumption_item_id") REFERENCES "consumption_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_lot_details" ADD CONSTRAINT "consumption_lot_details_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plans" ADD CONSTRAINT "cooking_plans_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_items" ADD CONSTRAINT "cooking_plan_items_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_items" ADD CONSTRAINT "cooking_plan_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_slots" ADD CONSTRAINT "cooking_plan_slots_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_slots" ADD CONSTRAINT "cooking_plan_slots_recipe_variant_id_fkey" FOREIGN KEY ("recipe_variant_id") REFERENCES "recipe_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_calculations" ADD CONSTRAINT "cost_calculations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_calculation_items" ADD CONSTRAINT "cost_calculation_items_cost_calculation_id_fkey" FOREIGN KEY ("cost_calculation_id") REFERENCES "cost_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_calculation_items" ADD CONSTRAINT "cost_calculation_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_costs" ADD CONSTRAINT "overhead_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
