-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "scope_role" AS ENUM ('SYSTEM_ADMIN', 'COMPANY_ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "permission_action" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT');

-- CreateEnum
CREATE TYPE "material_type" AS ENUM ('RAW', 'OTHER');

-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('MATERIAL', 'SUBSIDIARY');

-- CreateEnum
CREATE TYPE "ingredient_type" AS ENUM ('MATERIAL', 'SEMI_PRODUCT');

-- CreateEnum
CREATE TYPE "bom_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "meal_plan_status" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

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

-- CreateEnum
CREATE TYPE "receiving_note_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "consumption_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "month_end_status" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "stock_grade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "subsidiary_type" AS ENUM ('CONTAINER', 'ACCESSORY', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "consumption_mode" AS ENUM ('PER_MEAL_COUNT', 'FIXED_QUANTITY');

-- CreateEnum
CREATE TYPE "supplier_type" AS ENUM ('MATERIAL', 'SUBSIDIARY');

-- CreateEnum
CREATE TYPE "slot_kind" AS ENUM ('CONTAINER', 'DIRECT');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('FACTORY', 'WAREHOUSE', 'HYBRID');

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
    "type" "LocationType" NOT NULL DEFAULT 'FACTORY',
    "address" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
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
    "code" TEXT NOT NULL,
    "status" "production_line_status" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

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
    "stock_grade" "stock_grade" NOT NULL DEFAULT 'C',
    "stock_grade_updated_at" TIMESTAMP(3),
    "default_supplier_item_id" TEXT,
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
    "subsidiary_type" "subsidiary_type" NOT NULL DEFAULT 'CONSUMABLE',
    "unit" TEXT NOT NULL,
    "unit_category" "unit_category" NOT NULL DEFAULT 'COUNT',
    "stock_grade" "stock_grade" NOT NULL DEFAULT 'C',
    "stock_grade_updated_at" TIMESTAMP(3),
    "default_supplier_item_id" TEXT,
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
    "supplier_type" "supplier_type" NOT NULL DEFAULT 'MATERIAL',
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "address" TEXT,
    "note" TEXT,
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
    "product_name" TEXT NOT NULL,
    "spec" TEXT,
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
CREATE TABLE "container_slots" (
    "id" TEXT NOT NULL,
    "subsidiary_master_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "volume_ml" DOUBLE PRECISION,

    CONSTRAINT "container_slots_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "ingredient_type" "ingredient_type" NOT NULL,
    "material_master_id" TEXT,
    "semi_product_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_boms" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "bom_status" NOT NULL DEFAULT 'DRAFT',
    "base_weight_g" DOUBLE PRECISION NOT NULL,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recipe_boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_bom_slots" (
    "id" TEXT NOT NULL,
    "recipe_bom_id" TEXT NOT NULL,
    "subsidiary_master_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "total_weight_g" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_bom_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_bom_slot_items" (
    "id" TEXT NOT NULL,
    "recipe_bom_slot_id" TEXT NOT NULL,
    "ingredient_type" "ingredient_type" NOT NULL,
    "material_master_id" TEXT,
    "semi_product_id" TEXT,
    "weight_g" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_bom_slot_items_pkey" PRIMARY KEY ("id")
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
    "semi_product_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "bom_status" NOT NULL DEFAULT 'DRAFT',
    "base_quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "base_unit" TEXT NOT NULL DEFAULT 'kg',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "material_master_id" TEXT,
    "subsidiary_master_id" TEXT,
    "from_unit" TEXT NOT NULL,
    "to_unit" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "unit_category" "unit_category" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_masters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL,
    "unit_category" "unit_category" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_containers" (
    "id" TEXT NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "subsidiary_master_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meal_template_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_accessories" (
    "id" TEXT NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "subsidiary_master_id" TEXT NOT NULL,
    "consumption_type" "consumption_mode" NOT NULL DEFAULT 'PER_MEAL_COUNT',
    "fixed_quantity" DOUBLE PRECISION,
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meal_template_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "status" "meal_plan_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meal_plan_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "company_meal_slot_id" TEXT NOT NULL,
    "lineup_id" TEXT NOT NULL,
    "meal_template_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_slots" (
    "id" TEXT NOT NULL,
    "meal_plan_id" TEXT NOT NULL,
    "kind" "slot_kind" NOT NULL DEFAULT 'CONTAINER',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "subsidiary_master_id" TEXT,
    "container_slot_index" INTEGER,
    "recipe_id" TEXT,
    "recipe_bom_id" TEXT,
    "supplier_item_id" TEXT,
    "production_line_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meal_plan_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_counts" (
    "id" TEXT NOT NULL,
    "meal_plan_group_id" TEXT NOT NULL,
    "company_meal_slot_id" TEXT NOT NULL,
    "lineup_id" TEXT NOT NULL,
    "estimated_count" INTEGER,
    "final_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meal_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_accessories" (
    "id" TEXT NOT NULL,
    "meal_plan_id" TEXT NOT NULL,
    "subsidiary_master_id" TEXT NOT NULL,
    "consumption_mode" "consumption_mode" NOT NULL DEFAULT 'PER_MEAL_COUNT',
    "fixed_quantity" INTEGER,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meal_plan_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lineups_pkey" PRIMARY KEY ("id")
);

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
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "meal_plan_group_id" TEXT,
    "created_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "supplier_item_id" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
    "material_master_id" TEXT,
    "subsidiary_master_id" TEXT,
    "system_quantity" DOUBLE PRECISION,
    "adjusted_quantity" DOUBLE PRECISION,
    "adjustment_reason" TEXT,
    "source_type" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "received_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "inventory_lots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
    "subsidiary_master_id" TEXT,
    "receiving_note_item_id" TEXT,
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
    "meal_plan_group_id" TEXT,
    "location_id" TEXT,
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
    "material_master_id" TEXT,
    "item_type" "item_type" NOT NULL DEFAULT 'MATERIAL',
    "subsidiary_master_id" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "cooking_plan_id" TEXT,
    "consumed_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "consumed_date" DATE NOT NULL,
    "status" "consumption_status" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "cooking_plans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "production_line_id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "status" "cooking_plan_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooking_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_plan_items" (
    "id" TEXT NOT NULL,
    "cooking_plan_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "required_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooking_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_plan_slots" (
    "id" TEXT NOT NULL,
    "cooking_plan_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "recipe_id" TEXT,
    "recipe_bom_id" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "bom_snapshot_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooking_plan_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "snapshot_type" "snapshot_type" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_snapshot_items" (
    "id" TEXT NOT NULL,
    "cost_snapshot_id" TEXT NOT NULL,
    "material_master_id" TEXT NOT NULL,
    "avg_unit_price" DOUBLE PRECISION NOT NULL,
    "total_qty" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_calculations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cost_type" "cost_type" NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "cost_per_unit" DOUBLE PRECISION,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overhead_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_end_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "closing_month" DATE NOT NULL,
    "status" "month_end_status" NOT NULL DEFAULT 'DRAFT',
    "snapshot_data" JSONB NOT NULL,
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
    "adjustment_number" TEXT NOT NULL,
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
    "before_value" TEXT NOT NULL,
    "after_value" TEXT NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

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
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE INDEX "locations_is_active_idx" ON "locations"("is_active");

-- CreateIndex
CREATE INDEX "locations_company_id_sort_order_idx" ON "locations"("company_id", "sort_order");

-- CreateIndex
CREATE INDEX "locations_deleted_at_idx" ON "locations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "locations_company_id_code_key" ON "locations"("company_id", "code");

-- CreateIndex
CREATE INDEX "production_lines_company_id_idx" ON "production_lines"("company_id");

-- CreateIndex
CREATE INDEX "production_lines_location_id_idx" ON "production_lines"("location_id");

-- CreateIndex
CREATE INDEX "production_lines_status_idx" ON "production_lines"("status");

-- CreateIndex
CREATE INDEX "production_lines_company_id_sort_order_idx" ON "production_lines"("company_id", "sort_order");

-- CreateIndex
CREATE INDEX "production_lines_deleted_at_idx" ON "production_lines"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "production_lines_company_id_code_key" ON "production_lines"("company_id", "code");

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
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_company_id_idx" ON "invitations"("company_id");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "material_masters_default_supplier_item_id_key" ON "material_masters"("default_supplier_item_id");

-- CreateIndex
CREATE INDEX "material_masters_company_id_idx" ON "material_masters"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_masters_company_id_code_key" ON "material_masters"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "subsidiary_masters_default_supplier_item_id_key" ON "subsidiary_masters"("default_supplier_item_id");

-- CreateIndex
CREATE INDEX "subsidiary_masters_company_id_idx" ON "subsidiary_masters"("company_id");

-- CreateIndex
CREATE INDEX "subsidiary_masters_company_id_subsidiary_type_idx" ON "subsidiary_masters"("company_id", "subsidiary_type");

-- CreateIndex
CREATE UNIQUE INDEX "subsidiary_masters_company_id_code_key" ON "subsidiary_masters"("company_id", "code");

-- CreateIndex
CREATE INDEX "suppliers_company_id_idx" ON "suppliers"("company_id");

-- CreateIndex
CREATE INDEX "suppliers_company_id_supplier_type_idx" ON "suppliers"("company_id", "supplier_type");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_code_key" ON "suppliers"("company_id", "code");

-- CreateIndex
CREATE INDEX "supplier_items_supplier_id_idx" ON "supplier_items"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_items_material_master_id_idx" ON "supplier_items"("material_master_id");

-- CreateIndex
CREATE INDEX "supplier_items_subsidiary_master_id_idx" ON "supplier_items"("subsidiary_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_material_product" ON "supplier_items"("supplier_id", "item_type", "material_master_id", "product_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_subsidiary_product" ON "supplier_items"("supplier_id", "item_type", "subsidiary_master_id", "product_name");

-- CreateIndex
CREATE INDEX "supplier_item_price_histories_supplier_item_id_idx" ON "supplier_item_price_histories"("supplier_item_id");

-- CreateIndex
CREATE INDEX "container_slots_subsidiary_master_id_idx" ON "container_slots"("subsidiary_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "container_slots_subsidiary_master_id_slot_index_key" ON "container_slots"("subsidiary_master_id", "slot_index");

-- CreateIndex
CREATE INDEX "recipes_company_id_idx" ON "recipes"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_company_id_code_key" ON "recipes"("company_id", "code");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_material_master_id_idx" ON "recipe_ingredients"("material_master_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_semi_product_id_idx" ON "recipe_ingredients"("semi_product_id");

-- CreateIndex
CREATE INDEX "recipe_boms_company_id_idx" ON "recipe_boms"("company_id");

-- CreateIndex
CREATE INDEX "recipe_boms_recipe_id_idx" ON "recipe_boms"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slots_recipe_bom_id_idx" ON "recipe_bom_slots"("recipe_bom_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slots_subsidiary_master_id_idx" ON "recipe_bom_slots"("subsidiary_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_bom_slots_recipe_bom_id_subsidiary_master_id_slot_in_key" ON "recipe_bom_slots"("recipe_bom_id", "subsidiary_master_id", "slot_index");

-- CreateIndex
CREATE INDEX "recipe_bom_slot_items_recipe_bom_slot_id_idx" ON "recipe_bom_slot_items"("recipe_bom_slot_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slot_items_material_master_id_idx" ON "recipe_bom_slot_items"("material_master_id");

-- CreateIndex
CREATE INDEX "recipe_bom_slot_items_semi_product_id_idx" ON "recipe_bom_slot_items"("semi_product_id");

-- CreateIndex
CREATE INDEX "semi_products_company_id_idx" ON "semi_products"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "semi_products_company_id_code_key" ON "semi_products"("company_id", "code");

-- CreateIndex
CREATE INDEX "boms_company_id_idx" ON "boms"("company_id");

-- CreateIndex
CREATE INDEX "boms_semi_product_id_idx" ON "boms"("semi_product_id");

-- CreateIndex
CREATE INDEX "bom_items_bom_id_idx" ON "bom_items"("bom_id");

-- CreateIndex
CREATE INDEX "bom_items_material_master_id_idx" ON "bom_items"("material_master_id");

-- CreateIndex
CREATE INDEX "unit_conversions_company_id_idx" ON "unit_conversions"("company_id");

-- CreateIndex
CREATE INDEX "unit_conversions_material_master_id_idx" ON "unit_conversions"("material_master_id");

-- CreateIndex
CREATE INDEX "unit_conversions_subsidiary_master_id_idx" ON "unit_conversions"("subsidiary_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_company_id_material_master_id_subsidiary_m_key" ON "unit_conversions"("company_id", "material_master_id", "subsidiary_master_id", "from_unit", "to_unit");

-- CreateIndex
CREATE INDEX "unit_masters_company_id_item_type_unit_category_idx" ON "unit_masters"("company_id", "item_type", "unit_category");

-- CreateIndex
CREATE UNIQUE INDEX "unit_masters_company_id_item_type_code_key" ON "unit_masters"("company_id", "item_type", "code");

-- CreateIndex
CREATE INDEX "meal_templates_company_id_idx" ON "meal_templates"("company_id");

-- CreateIndex
CREATE INDEX "meal_template_containers_meal_template_id_idx" ON "meal_template_containers"("meal_template_id");

-- CreateIndex
CREATE INDEX "meal_template_containers_subsidiary_master_id_idx" ON "meal_template_containers"("subsidiary_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_template_containers_meal_template_id_subsidiary_master_key" ON "meal_template_containers"("meal_template_id", "subsidiary_master_id");

-- CreateIndex
CREATE INDEX "meal_template_accessories_meal_template_id_idx" ON "meal_template_accessories"("meal_template_id");

-- CreateIndex
CREATE INDEX "meal_template_accessories_subsidiary_master_id_idx" ON "meal_template_accessories"("subsidiary_master_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_template_accessories_meal_template_id_subsidiary_maste_key" ON "meal_template_accessories"("meal_template_id", "subsidiary_master_id");

-- CreateIndex
CREATE INDEX "meal_plan_groups_company_id_idx" ON "meal_plan_groups"("company_id");

-- CreateIndex
CREATE INDEX "meal_plan_groups_plan_date_idx" ON "meal_plan_groups"("plan_date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_groups_company_id_plan_date_key" ON "meal_plan_groups"("company_id", "plan_date");

-- CreateIndex
CREATE INDEX "meal_plans_meal_plan_group_id_idx" ON "meal_plans"("meal_plan_group_id");

-- CreateIndex
CREATE INDEX "meal_plans_lineup_id_idx" ON "meal_plans"("lineup_id");

-- CreateIndex
CREATE INDEX "meal_plans_meal_template_id_idx" ON "meal_plans"("meal_template_id");

-- CreateIndex
CREATE INDEX "meal_plans_company_meal_slot_id_idx" ON "meal_plans"("company_meal_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plans_meal_plan_group_id_company_meal_slot_id_lineup_i_key" ON "meal_plans"("meal_plan_group_id", "company_meal_slot_id", "lineup_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_meal_plan_id_idx" ON "meal_plan_slots"("meal_plan_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_kind_idx" ON "meal_plan_slots"("kind");

-- CreateIndex
CREATE INDEX "meal_plan_slots_recipe_id_idx" ON "meal_plan_slots"("recipe_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_recipe_bom_id_idx" ON "meal_plan_slots"("recipe_bom_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_subsidiary_master_id_idx" ON "meal_plan_slots"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_supplier_item_id_idx" ON "meal_plan_slots"("supplier_item_id");

-- CreateIndex
CREATE INDEX "meal_plan_slots_production_line_id_idx" ON "meal_plan_slots"("production_line_id");

-- CreateIndex
CREATE INDEX "meal_counts_meal_plan_group_id_idx" ON "meal_counts"("meal_plan_group_id");

-- CreateIndex
CREATE INDEX "meal_counts_lineup_id_idx" ON "meal_counts"("lineup_id");

-- CreateIndex
CREATE INDEX "meal_counts_deleted_at_idx" ON "meal_counts"("deleted_at");

-- CreateIndex
CREATE INDEX "meal_counts_company_meal_slot_id_idx" ON "meal_counts"("company_meal_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_counts_meal_plan_group_id_company_meal_slot_id_lineup__key" ON "meal_counts"("meal_plan_group_id", "company_meal_slot_id", "lineup_id");

-- CreateIndex
CREATE INDEX "meal_plan_accessories_meal_plan_id_idx" ON "meal_plan_accessories"("meal_plan_id");

-- CreateIndex
CREATE INDEX "meal_plan_accessories_subsidiary_master_id_idx" ON "meal_plan_accessories"("subsidiary_master_id");

-- CreateIndex
CREATE INDEX "meal_plan_accessories_deleted_at_idx" ON "meal_plan_accessories"("deleted_at");

-- CreateIndex
CREATE INDEX "lineups_company_id_idx" ON "lineups"("company_id");

-- CreateIndex
CREATE INDEX "lineups_is_active_idx" ON "lineups"("is_active");

-- CreateIndex
CREATE INDEX "lineups_company_id_sort_order_idx" ON "lineups"("company_id", "sort_order");

-- CreateIndex
CREATE INDEX "lineups_deleted_at_idx" ON "lineups"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lineups_company_id_code_key" ON "lineups"("company_id", "code");

-- CreateIndex
CREATE INDEX "company_meal_slots_company_id_idx" ON "company_meal_slots"("company_id");

-- CreateIndex
CREATE INDEX "company_meal_slots_company_id_sort_order_idx" ON "company_meal_slots"("company_id", "sort_order");

-- CreateIndex
CREATE INDEX "company_meal_slots_is_active_idx" ON "company_meal_slots"("is_active");

-- CreateIndex
CREATE INDEX "company_meal_slots_deleted_at_idx" ON "company_meal_slots"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "company_meal_slots_company_id_code_key" ON "company_meal_slots"("company_id", "code");

-- CreateIndex
CREATE INDEX "auto_gen_logs_company_id_idx" ON "auto_gen_logs"("company_id");

-- CreateIndex
CREATE INDEX "auto_gen_logs_created_at_idx" ON "auto_gen_logs"("created_at");

-- CreateIndex
CREATE INDEX "material_requirements_company_id_idx" ON "material_requirements"("company_id");

-- CreateIndex
CREATE INDEX "material_requirements_meal_plan_group_id_idx" ON "material_requirements"("meal_plan_group_id");

-- CreateIndex
CREATE INDEX "material_requirements_material_master_id_idx" ON "material_requirements"("material_master_id");

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
CREATE INDEX "consumption_items_company_id_idx" ON "consumption_items"("company_id");

-- CreateIndex
CREATE INDEX "consumption_items_material_master_id_idx" ON "consumption_items"("material_master_id");

-- CreateIndex
CREATE INDEX "consumption_items_consumed_date_idx" ON "consumption_items"("consumed_date");

-- CreateIndex
CREATE INDEX "consumption_lot_details_consumption_item_id_idx" ON "consumption_lot_details"("consumption_item_id");

-- CreateIndex
CREATE INDEX "consumption_lot_details_inventory_lot_id_idx" ON "consumption_lot_details"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "cooking_plans_company_id_idx" ON "cooking_plans"("company_id");

-- CreateIndex
CREATE INDEX "cooking_plans_production_line_id_idx" ON "cooking_plans"("production_line_id");

-- CreateIndex
CREATE INDEX "cooking_plans_plan_date_idx" ON "cooking_plans"("plan_date");

-- CreateIndex
CREATE INDEX "cooking_plan_items_cooking_plan_id_idx" ON "cooking_plan_items"("cooking_plan_id");

-- CreateIndex
CREATE INDEX "cooking_plan_items_material_master_id_idx" ON "cooking_plan_items"("material_master_id");

-- CreateIndex
CREATE INDEX "cooking_plan_slots_cooking_plan_id_idx" ON "cooking_plan_slots"("cooking_plan_id");

-- CreateIndex
CREATE INDEX "cooking_plan_slots_recipe_id_idx" ON "cooking_plan_slots"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "cooking_plan_slots_cooking_plan_id_slot_index_key" ON "cooking_plan_slots"("cooking_plan_id", "slot_index");

-- CreateIndex
CREATE INDEX "cost_snapshots_company_id_idx" ON "cost_snapshots"("company_id");

-- CreateIndex
CREATE INDEX "cost_snapshots_period_start_idx" ON "cost_snapshots"("period_start");

-- CreateIndex
CREATE INDEX "cost_snapshot_items_cost_snapshot_id_idx" ON "cost_snapshot_items"("cost_snapshot_id");

-- CreateIndex
CREATE INDEX "cost_calculations_company_id_idx" ON "cost_calculations"("company_id");

-- CreateIndex
CREATE INDEX "cost_calculations_reference_type_reference_id_idx" ON "cost_calculations"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "cost_calculation_items_cost_calculation_id_idx" ON "cost_calculation_items"("cost_calculation_id");

-- CreateIndex
CREATE INDEX "overhead_costs_company_id_idx" ON "overhead_costs"("company_id");

-- CreateIndex
CREATE INDEX "overhead_costs_month_idx" ON "overhead_costs"("month");

-- CreateIndex
CREATE INDEX "month_end_snapshots_company_id_idx" ON "month_end_snapshots"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "month_end_snapshots_company_id_closing_month_key" ON "month_end_snapshots"("company_id", "closing_month");

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
CREATE INDEX "notification_logs_company_id_idx" ON "notification_logs"("company_id");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_id_idx" ON "notification_logs"("recipient_id");

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
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_default_supplier_item_id_fkey" FOREIGN KEY ("default_supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary_masters" ADD CONSTRAINT "subsidiary_masters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary_masters" ADD CONSTRAINT "subsidiary_masters_default_supplier_item_id_fkey" FOREIGN KEY ("default_supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "container_slots" ADD CONSTRAINT "container_slots_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_boms" ADD CONSTRAINT "recipe_boms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_boms" ADD CONSTRAINT "recipe_boms_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slots" ADD CONSTRAINT "recipe_bom_slots_recipe_bom_id_fkey" FOREIGN KEY ("recipe_bom_id") REFERENCES "recipe_boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slots" ADD CONSTRAINT "recipe_bom_slots_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slot_items" ADD CONSTRAINT "recipe_bom_slot_items_recipe_bom_slot_id_fkey" FOREIGN KEY ("recipe_bom_slot_id") REFERENCES "recipe_bom_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slot_items" ADD CONSTRAINT "recipe_bom_slot_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_bom_slot_items" ADD CONSTRAINT "recipe_bom_slot_items_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semi_products" ADD CONSTRAINT "semi_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_semi_product_id_fkey" FOREIGN KEY ("semi_product_id") REFERENCES "semi_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_masters" ADD CONSTRAINT "unit_masters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_containers" ADD CONSTRAINT "meal_template_containers_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_containers" ADD CONSTRAINT "meal_template_containers_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_accessories" ADD CONSTRAINT "meal_template_accessories_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_accessories" ADD CONSTRAINT "meal_template_accessories_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_groups" ADD CONSTRAINT "meal_plan_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_company_meal_slot_id_fkey" FOREIGN KEY ("company_meal_slot_id") REFERENCES "company_meal_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_recipe_bom_id_fkey" FOREIGN KEY ("recipe_bom_id") REFERENCES "recipe_boms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_slots" ADD CONSTRAINT "meal_plan_slots_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_counts" ADD CONSTRAINT "meal_counts_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_counts" ADD CONSTRAINT "meal_counts_company_meal_slot_id_fkey" FOREIGN KEY ("company_meal_slot_id") REFERENCES "company_meal_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_counts" ADD CONSTRAINT "meal_counts_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_accessories" ADD CONSTRAINT "meal_plan_accessories_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_accessories" ADD CONSTRAINT "meal_plan_accessories_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_meal_slots" ADD CONSTRAINT "company_meal_slots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_gen_logs" ADD CONSTRAINT "auto_gen_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "shipping_orders" ADD CONSTRAINT "shipping_orders_meal_plan_group_id_fkey" FOREIGN KEY ("meal_plan_group_id") REFERENCES "meal_plan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_orders" ADD CONSTRAINT "shipping_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_order_items" ADD CONSTRAINT "shipping_order_items_shipping_order_id_fkey" FOREIGN KEY ("shipping_order_id") REFERENCES "shipping_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_order_items" ADD CONSTRAINT "shipping_order_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_order_items" ADD CONSTRAINT "shipping_order_items_subsidiary_master_id_fkey" FOREIGN KEY ("subsidiary_master_id") REFERENCES "subsidiary_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_items" ADD CONSTRAINT "consumption_items_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_lot_details" ADD CONSTRAINT "consumption_lot_details_consumption_item_id_fkey" FOREIGN KEY ("consumption_item_id") REFERENCES "consumption_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_lot_details" ADD CONSTRAINT "consumption_lot_details_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plans" ADD CONSTRAINT "cooking_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plans" ADD CONSTRAINT "cooking_plans_production_line_id_fkey" FOREIGN KEY ("production_line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_items" ADD CONSTRAINT "cooking_plan_items_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_items" ADD CONSTRAINT "cooking_plan_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_slots" ADD CONSTRAINT "cooking_plan_slots_cooking_plan_id_fkey" FOREIGN KEY ("cooking_plan_id") REFERENCES "cooking_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_plan_slots" ADD CONSTRAINT "cooking_plan_slots_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshot_items" ADD CONSTRAINT "cost_snapshot_items_cost_snapshot_id_fkey" FOREIGN KEY ("cost_snapshot_id") REFERENCES "cost_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshot_items" ADD CONSTRAINT "cost_snapshot_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_calculations" ADD CONSTRAINT "cost_calculations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_calculation_items" ADD CONSTRAINT "cost_calculation_items_cost_calculation_id_fkey" FOREIGN KEY ("cost_calculation_id") REFERENCES "cost_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_calculation_items" ADD CONSTRAINT "cost_calculation_items_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_costs" ADD CONSTRAINT "overhead_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
