-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "scope_role" AS ENUM ('SYSTEM_ADMIN', 'COMPANY_ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "permission_action" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT');

-- CreateEnum
CREATE TYPE "material_type" AS ENUM ('RAW', 'PROCESSED', 'SEASONING', 'OTHER');

-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('MATERIAL', 'SUBSIDIARY');

-- CreateEnum
CREATE TYPE "owner_type" AS ENUM ('RECIPE_VARIANT', 'SEMI_PRODUCT');

-- CreateEnum
CREATE TYPE "bom_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "meal_plan_status" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "meal_slot_type" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "po_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('REQUESTED', 'DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transfer_type" AS ENUM ('PUSH', 'PULL');

-- CreateEnum
CREATE TYPE "stock_take_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "shipping_status" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "cooking_plan_status" AS ENUM ('DRAFT', 'CONFIRMED', 'COMPLETED', 'REPLACED');

-- CreateEnum
CREATE TYPE "reservation_release_reason" AS ENUM ('CONSUMED', 'AUTO_EXPIRED', 'MANUAL_CANCEL');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_log_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'STATUS_CHANGE', 'LOGIN', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "snapshot_type" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "cost_type" AS ENUM ('ESTIMATED', 'ORDER_BASED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "unit_category" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'LENGTH');

-- CreateEnum
CREATE TYPE "production_line_status" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "auto_gen_status" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "biz_no" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "production_line_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scopes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "scope_role" NOT NULL,
    "permission_set_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_set_items" (
    "id" TEXT NOT NULL,
    "permission_set_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" "permission_action" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_masters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "material_type" "material_type" NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_category" "unit_category" NOT NULL,
    "min_stock" DOUBLE PRECISION,
    "max_stock" DOUBLE PRECISION,
    "shelf_life_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "material_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary_masters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subsidiary_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_items" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL,
    "material_master_id" TEXT,
    "subsidiary_master_id" TEXT,
    "supplier_item_code" TEXT,
    "supply_unit" TEXT NOT NULL,
    "supply_unit_qty" DOUBLE PRECISION NOT NULL,
    "current_price" DOUBLE PRECISION NOT NULL,
    "lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "moq" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_item_price_histories" (
    "id" TEXT NOT NULL,
    "supplier_item_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_item_price_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "container_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_slots" (
    "id" TEXT NOT NULL,
    "container_group_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "volume_ml" DOUBLE PRECISION,

    CONSTRAINT "container_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_accessories" (
    "id" TEXT NOT NULL,
    "container_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "container_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_variants" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semi_products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "semi_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "owner_type" "owner_type" NOT NULL,
    "recipe_variant_id" TEXT,
    "semi_product_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "bom_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL,
    "material_master_id" TEXT,
    "subsidiary_master_id" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "from_material_id" TEXT NOT NULL,
    "to_material_id" TEXT NOT NULL,
    "from_unit" TEXT NOT NULL,
    "to_unit" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "unit_category" "unit_category" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "container_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_slots" (
    "id" TEXT NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "meal_template_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_accessories" (
    "id" TEXT NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meal_template_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lineup_id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "status" "meal_plan_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "slot_type" "meal_slot_type" NOT NULL,
    "meal_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_slots" (
    "id" TEXT NOT NULL,
    "meal_plan_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "recipe_variant_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_counts" (
    "id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "slot_type" "meal_slot_type" NOT NULL,
    "estimated_count" INTEGER,
    "final_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineup_location_maps" (
    "id" TEXT NOT NULL,
    "lineup_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineup_location_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_gen_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "status" "auto_gen_status" NOT NULL DEFAULT 'PENDING',
    "input_json" JSONB,
    "output_json" JSONB,
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_gen_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "po_status" NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL,
    "delivery_date" DATE,
    "total_amount" DOUBLE PRECISION,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "supplier_item_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "received_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "initial_qty" DOUBLE PRECISION NOT NULL,
    "remaining_qty" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "expiration_date" DATE,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT,
    "transaction_type" "transaction_type" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "note" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "use_date" DATE NOT NULL,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "release_reason" "reservation_release_reason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "transfer_type" "transfer_type" NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'DRAFT',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_items" (
    "id" TEXT NOT NULL,
    "inventory_transfer_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_takes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "status" "stock_take_status" NOT NULL DEFAULT 'DRAFT',
    "take_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_takes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_take_items" (
    "id" TEXT NOT NULL,
    "stock_take_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "system_qty" DOUBLE PRECISION NOT NULL,
    "actual_qty" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_take_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lineup_id" TEXT NOT NULL,
    "shipping_date" DATE NOT NULL,
    "status" "shipping_status" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_order_items" (
    "id" TEXT NOT NULL,
    "shipping_order_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_plans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "cooking_plan_status" NOT NULL DEFAULT 'DRAFT',
    "expected_meals" INTEGER NOT NULL,
    "actual_meals" INTEGER,
    "replaced_by_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooking_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cost_type" "cost_type" NOT NULL,
    "target_month" DATE NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_snapshot_items" (
    "id" TEXT NOT NULL,
    "cost_snapshot_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_end_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "target_month" DATE NOT NULL,
    "snapshot_type" "snapshot_type" NOT NULL,
    "data_json" JSONB NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "month_end_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_end_adjustments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "month_end_snapshot_id" TEXT NOT NULL,
    "adjustment_number" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "adjusted_by_id" TEXT NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_end_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_end_adjustment_items" (
    "id" TEXT NOT NULL,
    "adjustment_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before_value" DOUBLE PRECISION NOT NULL,
    "after_value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_end_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_tag_defs" (
    "id" TEXT NOT NULL,
    "tag_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_tag_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "template_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body_template" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "notification_log_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "action" "audit_action" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "locations_company_id_idx" ON "locations"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_company_id_code_key" ON "locations"("company_id", "code");

-- CreateIndex
CREATE INDEX "production_lines_company_id_idx" ON "production_lines"("company_id");

-- CreateIndex
CREATE INDEX "production_lines_location_id_idx" ON "production_lines"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_user_id_key" ON "users"("provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_scopes_user_id_idx" ON "user_scopes"("user_id");

-- CreateIndex
CREATE INDEX "user_scopes_company_id_idx" ON "user_scopes"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scopes_user_id_company_id_key" ON "user_scopes"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "permission_set_items_permission_set_id_idx" ON "permission_set_items"("permission_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_set_items_permission_set_id_resource_action_key" ON "permission_set_items"("permission_set_id", "resource", "action");

-- CreateIndex
CREATE INDEX "material_masters_company_id_idx" ON "material_masters"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_masters_company_id_code_key" ON "material_masters"("company_id", "code");

-- CreateIndex
CREATE INDEX "subsidiary_masters_company_id_idx" ON "subsidiary_masters"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "subsidiary_masters_company_id_code_key" ON "subsidiary_masters"("company_id", "code");

-- CreateIndex
CREATE INDEX "suppliers_company_id_idx" ON "suppliers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_code_key" ON "suppliers"("company_id", "code");

-- CreateIndex
CREATE INDEX "supplier_items_supplier_id_idx" ON "supplier_items"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_items_material_master_id_idx" ON "supplier_items"("material_master_id");

-- CreateIndex
CREATE INDEX "supplier_items_subsidiary_master_id_idx" ON "supplier_items"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "supplier_item_price_histories_supplier_item_id_idx" ON "supplier_item_price_histories"("supplier_item_id");

-- CreateIndex
CREATE INDEX "container_groups_company_id_idx" ON "container_groups"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "container_groups_company_id_code_key" ON "container_groups"("company_id", "code");

-- CreateIndex
CREATE INDEX "container_slots_container_group_id_idx" ON "container_slots"("container_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "container_slots_container_group_id_slot_index_key" ON "container_slots"("container_group_id", "slot_index");

-- CreateIndex
CREATE INDEX "container_accessories_container_group_id_idx" ON "container_accessories"("container_group_id");

-- CreateIndex
CREATE INDEX "recipes_company_id_idx" ON "recipes"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_company_id_code_key" ON "recipes"("company_id", "code");

-- CreateIndex
CREATE INDEX "recipe_variants_recipe_id_idx" ON "recipe_variants"("recipe_id");

-- CreateIndex
CREATE INDEX "semi_products_company_id_idx" ON "semi_products"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "semi_products_company_id_code_key" ON "semi_products"("company_id", "code");

-- CreateIndex
CREATE INDEX "boms_company_id_idx" ON "boms"("company_id");

-- CreateIndex
CREATE INDEX "boms_recipe_variant_id_idx" ON "boms"("recipe_variant_id");

-- CreateIndex
CREATE INDEX "boms_semi_product_id_idx" ON "boms"("semi_product_id");

-- CreateIndex
CREATE INDEX "bom_items_bom_id_idx" ON "bom_items"("bom_id");

-- CreateIndex
CREATE INDEX "bom_items_material_master_id_idx" ON "bom_items"("material_master_id");

-- CreateIndex
CREATE INDEX "bom_items_subsidiary_master_id_idx" ON "bom_items"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "unit_conversions_from_material_id_idx" ON "unit_conversions"("from_material_id");

-- CreateIndex
CREATE INDEX "unit_conversions_to_material_id_idx" ON "unit_conversions"("to_material_id");

-- CreateIndex
CREATE INDEX "meal_templates_company_id_idx" ON "meal_templates"("company_id");

-- CreateIndex
CREATE INDEX "meal_templates_container_group_id_idx" ON "meal_templates"("container_group_id");

-- CreateIndex
CREATE INDEX "meal_template_slots_meal_template_id_idx" ON "meal_template_slots"("meal_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_template_slots_meal_template_id_slot_index_key" ON "meal_template_slots"("meal_template_id", "slot_index");

-- CreateIndex
CREATE INDEX "meal_template_accessories_meal_template_id_idx" ON "meal_template_accessories"("meal_template_id");

-- CreateIndex
CREATE INDEX "meal_plan_groups_company_id_idx" ON "meal_plan_groups"("company_id");

-- CreateIndex
CREATE INDEX "meal_plan_groups_lineup_id_idx" ON "meal_plan_groups"("lineup_id");

-- CreateIndex
CREATE INDEX "meal_plan_groups_plan_date_idx" ON "meal_plan_groups"("plan_date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_groups_company_id_lineup_id_plan_date_key" ON "meal_plan_groups"("company_id", "lineup_id", "plan_date");

-- CreateIndex
CREATE INDEX "meal_plans_meal_plan_group_id_idx" ON "meal_plans"("meal_plan_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plans_meal_plan_group_id_slot_type_key" ON "meal_plans"("meal_plan_group_id", "slot_type");

-- CreateIndex
CREATE INDEX "meal_plan_slots_meal_plan_id_idx" ON "meal_plan_slots"("meal_plan_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_recipe_variant_id_idx" ON "meal_plan_slots"("recipe_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_slots_meal_plan_id_slot_index_key" ON "meal_plan_slots"("meal_plan_id", "slot_index");

-- CreateIndex
CREATE INDEX "meal_counts_meal_plan_group_id_idx" ON "meal_counts"("meal_plan_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_counts_meal_plan_group_id_slot_type_key" ON "meal_counts"("meal_plan_group_id", "slot_type");

-- CreateIndex
CREATE INDEX "lineups_company_id_idx" ON "lineups"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "lineups_company_id_code_key" ON "lineups"("company_id", "code");

-- CreateIndex
CREATE INDEX "lineup_location_maps_lineup_id_idx" ON "lineup_location_maps"("lineup_id");

-- CreateIndex
CREATE INDEX "lineup_location_maps_location_id_idx" ON "lineup_location_maps"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "lineup_location_maps_lineup_id_location_id_key" ON "lineup_location_maps"("lineup_id", "location_id");

-- CreateIndex
CREATE INDEX "auto_gen_logs_company_id_idx" ON "auto_gen_logs"("company_id");

-- CreateIndex
CREATE INDEX "auto_gen_logs_created_at_idx" ON "auto_gen_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_idx" ON "purchase_orders"("company_id");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_order_date_idx" ON "purchase_orders"("order_date");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_supplier_item_id_idx" ON "purchase_order_items"("supplier_item_id");

-- CreateIndex
CREATE INDEX "inventory_lots_company_id_idx" ON "inventory_lots"("company_id");

-- CreateIndex
CREATE INDEX "inventory_lots_location_id_idx" ON "inventory_lots"("location_id");

-- CreateIndex
CREATE INDEX "inventory_lots_material_master_id_idx" ON "inventory_lots"("material_master_id");

-- CreateIndex
CREATE INDEX "inventory_lots_lot_number_idx" ON "inventory_lots"("lot_number");

-- CreateIndex
CREATE INDEX "inventory_transactions_company_id_idx" ON "inventory_transactions"("company_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_location_id_idx" ON "inventory_transactions"("location_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_material_master_id_idx" ON "inventory_transactions"("material_master_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventory_lot_id_idx" ON "inventory_transactions"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_date_idx" ON "inventory_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "inventory_reservations_company_id_idx" ON "inventory_reservations"("company_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventory_lot_id_idx" ON "inventory_reservations"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_material_master_id_idx" ON "inventory_reservations"("material_master_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_use_date_idx" ON "inventory_reservations"("use_date");

-- CreateIndex
CREATE INDEX "inventory_transfers_company_id_idx" ON "inventory_transfers"("company_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_from_location_id_idx" ON "inventory_transfers"("from_location_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_to_location_id_idx" ON "inventory_transfers"("to_location_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_inventory_transfer_id_idx" ON "inventory_transfer_items"("inventory_transfer_id");

-- CreateIndex
CREATE INDEX "stock_takes_company_id_idx" ON "stock_takes"("company_id");

-- CreateIndex
CREATE INDEX "stock_takes_location_id_idx" ON "stock_takes"("location_id");

-- CreateIndex
CREATE INDEX "stock_take_items_stock_take_id_idx" ON "stock_take_items"("stock_take_id");

-- CreateIndex
CREATE INDEX "shipping_orders_company_id_idx" ON "shipping_orders"("company_id");

-- CreateIndex
CREATE INDEX "shipping_orders_lineup_id_idx" ON "shipping_orders"("lineup_id");

-- CreateIndex
CREATE INDEX "shipping_orders_shipping_date_idx" ON "shipping_orders"("shipping_date");

-- CreateIndex
CREATE INDEX "shipping_order_items_shipping_order_id_idx" ON "shipping_order_items"("shipping_order_id");

-- CreateIndex
CREATE INDEX "cooking_plans_company_id_idx" ON "cooking_plans"("company_id");

-- CreateIndex
CREATE INDEX "cooking_plans_meal_plan_group_id_idx" ON "cooking_plans"("meal_plan_group_id");

-- CreateIndex
CREATE INDEX "cost_snapshots_company_id_idx" ON "cost_snapshots"("company_id");

-- CreateIndex
CREATE INDEX "cost_snapshots_target_month_idx" ON "cost_snapshots"("target_month");

-- CreateIndex
CREATE INDEX "cost_snapshot_items_cost_snapshot_id_idx" ON "cost_snapshot_items"("cost_snapshot_id");

-- CreateIndex
CREATE INDEX "cost_snapshot_items_material_master_id_idx" ON "cost_snapshot_items"("material_master_id");

-- CreateIndex
CREATE INDEX "month_end_snapshots_company_id_idx" ON "month_end_snapshots"("company_id");

-- CreateIndex
CREATE INDEX "month_end_snapshots_target_month_idx" ON "month_end_snapshots"("target_month");

-- CreateIndex
CREATE UNIQUE INDEX "month_end_snapshots_company_id_target_month_snapshot_type_key" ON "month_end_snapshots"("company_id", "target_month", "snapshot_type");

-- CreateIndex
CREATE INDEX "month_end_adjustments_company_id_idx" ON "month_end_adjustments"("company_id");

-- CreateIndex
CREATE INDEX "month_end_adjustments_month_end_snapshot_id_idx" ON "month_end_adjustments"("month_end_snapshot_id");

-- CreateIndex
CREATE INDEX "month_end_adjustment_items_adjustment_id_idx" ON "month_end_adjustment_items"("adjustment_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_tag_defs_tag_key_key" ON "notification_tag_defs"("tag_key");

-- CreateIndex
CREATE INDEX "notification_rules_company_id_idx" ON "notification_rules"("company_id");

-- CreateIndex
CREATE INDEX "notification_rules_event_type_idx" ON "notification_rules"("event_type");

-- CreateIndex
CREATE INDEX "notification_logs_company_id_idx" ON "notification_logs"("company_id");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_id_idx" ON "notification_logs"("recipient_id");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_items" ADD CONSTRAINT "permission_set_items_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary_masters" ADD CONSTRAINT "subsidiary_masters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_price_histories" ADD CONSTRAINT "supplier_item_price_histories_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_groups" ADD CONSTRAINT "container_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_slots" ADD CONSTRAINT "container_slots_container_group_id_fkey" FOREIGN KEY ("container_group_id") REFERENCES "container_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_accessories" ADD CONSTRAINT "container_accessories_container_group_id_fkey" FOREIGN KEY ("container_group_id") REFERENCES "container_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_variants" ADD CONSTRAINT "recipe_variants_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semi_products" ADD CONSTRAINT "semi_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_recipe_variant_id_fkey" FOREIGN KEY ("recipe_variant_id") REFERENCES "recipe_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_from_material_id_fkey" FOREIGN KEY ("from_material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_to_material_id_fkey" FOREIGN KEY ("to_material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_container_group_id_fkey" FOREIGN KEY ("container_group_id") REFERENCES "container_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_slots" ADD CONSTRAINT "meal_template_slots_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_accessories" ADD CONSTRAINT "meal_template_accessories_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_groups" ADD CONSTRAINT "meal_plan_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_groups" ADD CONSTRAINT "meal_plan_groups_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_recipe_variant_id_fkey" FOREIGN KEY ("recipe_variant_id") REFERENCES "recipe_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_counts" ADD CONSTRAINT "meal_counts_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup_location_maps" ADD CONSTRAINT "lineup_location_maps_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup_location_maps" ADD CONSTRAINT "lineup_location_maps_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_gen_logs" ADD CONSTRAINT "auto_gen_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_inventory_transfer_id_fkey" FOREIGN KEY ("inventory_transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_stock_take_id_fkey" FOREIGN KEY ("stock_take_id") REFERENCES "stock_takes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_orders" ADD CONSTRAINT "shipping_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_orders" ADD CONSTRAINT "shipping_orders_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_order_items" ADD CONSTRAINT "shipping_order_items_shipping_order_id_fkey" FOREIGN KEY ("shipping_order_id") REFERENCES "shipping_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plans" ADD CONSTRAINT "cooking_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plans" ADD CONSTRAINT "cooking_plans_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "cooking_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshot_items" ADD CONSTRAINT "cost_snapshot_items_cost_snapshot_id_fkey" FOREIGN KEY ("cost_snapshot_id") REFERENCES "cost_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshot_items" ADD CONSTRAINT "cost_snapshot_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_end_snapshots" ADD CONSTRAINT "month_end_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_end_adjustments" ADD CONSTRAINT "month_end_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_end_adjustments" ADD CONSTRAINT "month_end_adjustments_month_end_snapshot_id_fkey" FOREIGN KEY ("month_end_snapshot_id") REFERENCES "month_end_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_end_adjustments" ADD CONSTRAINT "month_end_adjustments_adjusted_by_id_fkey" FOREIGN KEY ("adjusted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_end_adjustment_items" ADD CONSTRAINT "month_end_adjustment_items_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "month_end_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
