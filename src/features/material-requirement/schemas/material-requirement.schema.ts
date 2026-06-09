// src/features/material-requirement/schemas/material-requirement.schema.ts
import { z } from "zod";
import { MealCountSource } from "@prisma/client";

// ============================================================
// Phase 9-A-1 / 9-A-1.5: MaterialRequirement Zod 스키마
// ------------------------------------------------------------
// 본 모듈은 "식단 그룹 기준 소요량 자동 산출"의 입력/출력 계약을 정의한다.
//
// 핵심 결정 사항 (PROGRESS.md "Phase 9-A 결정사항" 참조):
//   1) productionLineId / locationId 모두 NOT NULL.
//      - 산출은 항상 라인 단위 롤업.
//      - locationId는 ProductionLine.locationId에서 서버가 자동 채움(사용자 입력 X).
//   2) 재생성은 같은 (group, line, material, countSource) 키에 대해 UPSERT.
//      - 사라진 키는 soft-delete, 다시 등장하면 UNDELETE.
//      - generationVersion은 매 변경마다 +1.
//   3) 1차/2차 분리: countSource로 ESTIMATED(예상)·FINAL(확정) 행을 분리 보존.
//      - 1차 ESTIMATED → 발주/작업지시 산출 입력
//      - 2차 FINAL     → 원가 비교 산출 입력
//   4) 사용자 입력은 "산출 트리거"와 "조회 쿼리"뿐.
//      - MR row 자체를 사용자가 직접 만들거나 수정하지 않음.
//      - 따라서 createInput / updateInput 스키마는 정의하지 않는다.
// ============================================================

// ------------------------------------------------------------
// 1. 트리거 입력: 특정 식단 그룹에 대해 소요량 재산출
// ------------------------------------------------------------
export const generateMaterialRequirementsSchema = z.object({
  mealPlanGroupId: z.string().min(1, "식단 그룹 ID가 필요합니다"),
  // Phase 9-A-1.5: 1차(ESTIMATED) / 2차(FINAL) 산출 흐름 분기
  // - ESTIMATED: MealCount.estimatedCount 기준 → 발주/작업지시 (기본)
  // - FINAL:     MealCount.finalCount 기준     → 원가 비교
  countSource: z.enum(MealCountSource).default(MealCountSource.ESTIMATED),
  // 향후 옵션 확장 여지 (예: dryRun 미리보기, force 재산출 등)
});

export type GenerateMaterialRequirementsInput = z.infer<
  typeof generateMaterialRequirementsSchema
>;

// ------------------------------------------------------------
// 2. 조회 쿼리: 그룹/라인/자재로 필터링한 활성 MR 목록
// ------------------------------------------------------------
export const listMaterialRequirementsSchema = z.object({
  mealPlanGroupId: z.string().min(1, "식단 그룹 ID가 필요합니다"),
  productionLineId: z.string().optional(),
  materialMasterId: z.string().optional(),
  // Phase 9-A-1.5: 산출 흐름 필터 (미지정 시 양쪽 모두 반환)
  countSource: z.enum(MealCountSource).optional(),
  // 활성 행만 보여줄지 (기본 true). false면 soft-deleted 포함.
  activeOnly: z.boolean().default(true),
  // 페이지네이션 (선택). 대량 조회를 막기 위해 기본 50건, 최대 200건.
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(200).default(50),
});

export type ListMaterialRequirementsQuery = z.infer<
  typeof listMaterialRequirementsSchema
>;

// ------------------------------------------------------------
// 3. 단건 조회: id로 활성 MR 1건
// ------------------------------------------------------------
export const getMaterialRequirementByIdSchema = z.object({
  id: z.string().min(1, "MaterialRequirement ID가 필요합니다"),
});

export type GetMaterialRequirementByIdInput = z.infer<
  typeof getMaterialRequirementByIdSchema
>;

// ------------------------------------------------------------
// 4. 산출 결과 요약 (서비스 반환 타입의 형태 검증용)
//    - 실제 반환은 Prisma 모델 + 통계, 본 스키마는 다른 모듈이
//      반환 모양을 신뢰할 수 있도록 정의해 둔다.
// ------------------------------------------------------------
export const generateResultSchema = z.object({
  mealPlanGroupId: z.string(),
  // Phase 9-A-1.5: 이번 산출이 어느 흐름이었는지 명시
  countSource: z.enum(MealCountSource),
  generationVersion: z.number().int().nonnegative(),
  stats: z.object({
    inserted: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    undeleted: z.number().int().nonnegative(),
    softDeleted: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    recipeContainerSlots: z.number().int().nonnegative(),
    directSlotsSkipped: z.number().int().nonnegative(),
    // ★ Phase 9-C-Fix-H
    slotQuantityMismatchWarnings: z.number().int().nonnegative().default(0),
    mismatchDetails: z
      .array(
        z.object({
          mealPlanId: z.string(),
          mealCount: z.number(),
          slotsSum: z.number(),
        }),
      )
      .default([]),
  }),  
});

export type GenerateResult = z.infer<typeof generateResultSchema>;

// ------------------------------------------------------------
// 5. 산출 차단 에러 코드 (서비스 throw → 액션 변환)
// ------------------------------------------------------------
export const MATERIAL_REQUIREMENT_ERRORS = {
  GROUP_NOT_FOUND: "MR_GROUP_NOT_FOUND",
  GROUP_EMPTY: "MR_GROUP_EMPTY",
  MISSING_PRODUCTION_LINE: "MR_MISSING_PRODUCTION_LINE",
  MISSING_LOCATION: "MR_MISSING_LOCATION",
  MISSING_RECIPE_BOM: "MR_MISSING_RECIPE_BOM",
  // Phase 9-A-1.5 추가: 인분수 누락, 반제품 BOM 누락
  MISSING_MEAL_COUNT: "MR_MISSING_MEAL_COUNT",
  MISSING_SEMI_PRODUCT_BOM: "MR_MISSING_SEMI_PRODUCT_BOM",
  INVALID_UNIT: "MR_INVALID_UNIT",
} as const;

export type MaterialRequirementErrorCode =
  (typeof MATERIAL_REQUIREMENT_ERRORS)[keyof typeof MATERIAL_REQUIREMENT_ERRORS];