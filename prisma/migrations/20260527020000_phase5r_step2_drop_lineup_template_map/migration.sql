-- Phase 5-R Step 2 정정: LineupMealTemplateMap 폐기
-- 사유: 슬롯-템플릿 매핑은 라인업이 아닌 식단(MealPlan) 작성 단계에서 결정됨.
--       동일 라인업·동일 슬롯도 날짜별로 다른 템플릿 사용 가능해야 하므로
--       라인업 단계에서 default를 강제하는 모델은 부적절.

-- FK는 모델 DROP 시 함께 정리됨
DROP TABLE IF EXISTS "lineup_meal_template_maps";
