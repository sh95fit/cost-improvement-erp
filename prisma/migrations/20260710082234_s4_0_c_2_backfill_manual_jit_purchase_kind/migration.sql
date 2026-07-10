-- ============================================================
-- S4-0-c-2 보정 백필: S4-0-a-2 rename 시 소실된 MANUAL_JIT 복원
-- 
-- 배경:
--   S4-0-a (20260710015720): purchase_orders.purchaseKind 컬럼 생성 후
--                            is_manual=true → MANUAL_JIT 백필 (4건)
--   S4-0-a-2 (20260710020509): camelCase → snake_case rename 이
--                              DROP COLUMN + ADD COLUMN (default WIZARD)
--                              로 처리되어 백필된 4건 값이 소실됨
--
-- 복구:
--   1) purchase_orders.purchase_kind 재백필 (is_manual=true → MANUAL_JIT)
--   2) 해당 PO에서 파생된 inventory_lots.purchase_kind 도 재동기화
--      (S4-0-c 백필은 이미 소실된 상태의 PO를 참조했으므로 마찬가지로 재적용)
-- ============================================================

-- 1) PurchaseOrder 재백필
UPDATE "purchase_orders"
SET "purchase_kind" = 'MANUAL_JIT'
WHERE "is_manual" = true
  AND "purchase_kind" = 'WIZARD';

-- 2) InventoryLot 재동기화 (현 시점 PO 상태 기준)
UPDATE "inventory_lots" il
SET "purchase_kind" = po."purchase_kind"
FROM "receiving_note_items" rni
JOIN "purchase_order_items" poi ON poi."id" = rni."purchase_order_item_id"
JOIN "purchase_orders" po       ON po."id"  = poi."purchase_order_id"
WHERE rni."id" = il."receiving_note_item_id"
  AND il."purchase_kind" IS DISTINCT FROM po."purchase_kind";

-- Verification (comment only)
-- SELECT purchase_kind, COUNT(*) FROM purchase_orders GROUP BY 1;
--   Expected: WIZARD 35, MANUAL_JIT 4
-- SELECT purchase_kind, COUNT(*) FROM inventory_lots GROUP BY 1;
--   Expected: WIZARD 40  (Q2 결과상 MANUAL_JIT PO 4건은 아직 입고 전이므로 lot 없음)
