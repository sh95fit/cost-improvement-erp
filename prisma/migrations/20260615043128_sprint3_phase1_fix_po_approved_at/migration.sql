-- Fix: approved_at column was missing from sprint3_phase1 migration
-- Schema declared approvedAt DateTime? but migration SQL omitted it.
-- IF NOT EXISTS guard ensures idempotency for envs where Prisma already synced.

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);
