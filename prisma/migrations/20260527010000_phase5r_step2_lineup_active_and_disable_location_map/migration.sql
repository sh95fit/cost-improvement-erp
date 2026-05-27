-- Phase 5-R Step 2.5 prep:
-- 1) Lineup에 is_active, sort_order, description 컬럼 추가
-- 2) LineupLocationMap은 현재 비즈니스 모델상 명확한 쓰임이 없어 코드 레벨에서 배제
--    (테이블은 보존 — 향후 명확한 쓰임이 정의되면 복원하기 위함)

-- ============================================================
-- 1) Lineup 컬럼 추가
-- ============================================================
ALTER TABLE "lineups"
  ADD COLUMN "is_active"   BOOLEAN  NOT NULL DEFAULT TRUE,
  ADD COLUMN "sort_order"  INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN "description" TEXT;

-- 활성 라인업 필터링을 자주 하므로 인덱스 추가
CREATE INDEX "lineups_is_active_idx" ON "lineups" ("is_active");

-- 노출 순서 정렬을 자주 하므로 인덱스 추가 (sort_order, name 조합)
CREATE INDEX "lineups_company_id_sort_order_idx"
  ON "lineups" ("company_id", "sort_order");

-- ============================================================
-- 2) LineupLocationMap 테이블은 변경하지 않음
--    (현재 빈 테이블, 향후 명확한 쓰임 정의 시 복원)
-- ============================================================
