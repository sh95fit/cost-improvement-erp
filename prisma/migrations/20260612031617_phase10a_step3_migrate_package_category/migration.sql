-- Phase 10-A Step 3: 기존 포장 단위들을 PACKAGE 카테고리로 이전
--   (step1에서 PACKAGE 추가 + step2 commit 이후이므로 안전하게 사용 가능)
UPDATE "unit_masters"
   SET "unit_category" = 'PACKAGE'
 WHERE "code" IN ('봉', '팩', '박스', '캔', '병', '세트', '묶음', '롤');
