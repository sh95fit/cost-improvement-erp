-- ============================================================
-- Phase 1.6: deliveryDate → outboundDate rename + expectedReceiveDate 추가
-- D15-1: 출고일 의미 명확화 (delivery_date → outbound_date)
-- D15-2: 입고 예정일 컬럼 추가 (= outbound_date + MAX(items.supplier_item.lead_time_days))
-- D15-3: 품목별 입고일은 런타임 derived (DB 미저장)
-- D15-4: outboundDate 가 null 이면 expectedReceiveDate 도 null
-- D15-5: leadTimeDays 미정 시 default 1 사용 (SupplierItem.leadTimeDays default)
-- ============================================================

-- 1) 기존 delivery_date 컬럼명 변경 (DATE 타입 그대로 보존)
ALTER TABLE "purchase_orders"
  RENAME COLUMN "delivery_date" TO "outbound_date";

-- 2) expected_receive_date 컬럼 추가 (DATE, nullable)
ALTER TABLE "purchase_orders"
  ADD COLUMN "expected_receive_date" DATE;

-- 3) 기존 PO 들에 대한 데이터 백필
--    outbound_date 가 있는 경우, items 의 supplier_item.lead_time_days MAX 를 더해 계산
--    items 가 없거나 모든 leadTimeDays 가 NULL/0 인 경우 default 1 사용 (D15-5)
--    PostgreSQL: DATE + INTEGER = DATE (일수 가산), 별도 INTERVAL 캐스팅 불필요
UPDATE "purchase_orders" po
SET "expected_receive_date" = po."outbound_date" + COALESCE(
  (
    SELECT MAX(si."lead_time_days")
    FROM "purchase_order_items" poi
    JOIN "supplier_items" si ON si."id" = poi."supplier_item_id"
    WHERE poi."purchase_order_id" = po."id"
  ),
  1
)
WHERE po."outbound_date" IS NOT NULL;

-- 4) 인덱스 생성 (정렬/필터 성능)
CREATE INDEX "purchase_orders_outbound_date_idx"
  ON "purchase_orders"("outbound_date");

CREATE INDEX "purchase_orders_expected_receive_date_idx"
  ON "purchase_orders"("expected_receive_date");

-- 5) 기존 delivery_date 인덱스가 존재했다면 제거
--    (현재 baseline 의 PurchaseOrder @@index 블록에 delivery_date 인덱스 없음 — fetch 확인 결과 batchId/companyId/supplierId/orderDate/status/locationId/productionLineId 만 존재.
--     따라서 별도 DROP INDEX 불필요.)
