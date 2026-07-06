-- ============================================================
-- FIX (2026-07-06): expected_receive_date 부호 정정
--
-- 배경:
--   Phase 1.6 (마이그레이션 20260622080946_phase_1_6_...) 에서
--   expected_receive_date 를 outbound_date + MAX(leadTime) 로 계산·저장했으나,
--   이는 도메인 정의와 반대 방향이었다.
--
-- 확정 도메인 정의:
--   outbound_date        = 출고일 = 실제 사용일 (엔드라인, 넘어갈 수 없음)
--   expected_receive_date = 예상 입고일 = 공급업체가 도착시켜야 하는 날
--                        = outbound_date - MAX(leadTime)   (과거)
--   lead_time D-1        = 사용일 1일 전 도착
--   lead_time D-2        = 사용일 2일 전 도착
--
-- 조치:
--   1) 기존에 잘못 저장된 expected_receive_date 를 재계산해 덮어쓴다.
--   2) lead_time_days 가 NULL 또는 0/음수인 경우 default 1 사용 (D15-5 규칙 유지).
--   3) outbound_date 가 NULL 인 PO 는 건드리지 않는다 (D15-4 규칙 유지).
--
-- 안전성:
--   - 컬럼 스키마 변경 없음 (데이터 UPDATE 만).
--   - Prisma 는 각 migration.sql 을 자체 트랜잭션으로 실행하므로 별도 BEGIN/COMMIT 불필요.
--   - 되돌리기 필요 시, 동일 계산에서 부호만 + 로 바꾼 마이그레이션을 별도 적용.
-- ============================================================

UPDATE "purchase_orders" AS po
SET "expected_receive_date" = po."outbound_date" - COALESCE(
  (
    SELECT MAX(si."lead_time_days")
    FROM "purchase_order_items" poi
    JOIN "supplier_items" si ON si."id" = poi."supplier_item_id"
    WHERE poi."purchase_order_id" = po."id"
      AND si."lead_time_days" IS NOT NULL
      AND si."lead_time_days" > 0
  ),
  1
)
WHERE po."outbound_date" IS NOT NULL;
