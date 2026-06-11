// src/features/meal-plan/schemas/meal-plan.schema.ts
import { z } from "zod";

// ══════════════════════════════════════════════════════════════
// Common enums (Prisma enum과 1:1 매칭 — Phase 5-R v2)
// ══════════════════════════════════════════════════════════════

export const mealPlanStatusEnum = z.enum([
  "DRAFT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type MealPlanStatus = z.infer<typeof mealPlanStatusEnum>;

export const slotKindEnum = z.enum(["CONTAINER", "DIRECT"]);
export type SlotKind = z.infer<typeof slotKindEnum>;

// ISO date string ("YYYY-MM-DD") 검증 — 서비스 레이어에서 Date로 변환
const isoDateString = z
  .string()
  .min(1, "날짜를 입력하세요")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

// ══════════════════════════════════════════════════════════════
// MealPlanGroup (날짜 기반 그룹 — lineupId 제거됨)
// ══════════════════════════════════════════════════════════════

export const mealPlanGroupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(), // note 검색
  status: mealPlanStatusEnum.optional(),
  /**
   * Phase 5-R: lineupId는 MealPlanGroup에서 분리되었으나,
   * 목록 필터로는 MealPlan.lineupId를 통해 간접 필터 가능 (서비스에서 처리)
   */
  lineupId: z.string().optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(),
  sortBy: z.enum(["planDate", "createdAt", "status"]).default("planDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type MealPlanGroupListQuery = z.infer<
  typeof mealPlanGroupListQuerySchema
>;

export const createMealPlanGroupSchema = z.object({
  planDate: isoDateString,
  note: z.string().max(500, "비고는 500자 이내").optional(),
});
export type CreateMealPlanGroupInput = z.infer<
  typeof createMealPlanGroupSchema
>;

export const updateMealPlanGroupSchema = z.object({
  status: mealPlanStatusEnum.optional(),
  note: z.string().max(500, "비고는 500자 이내").nullable().optional(),
});
export type UpdateMealPlanGroupInput = z.infer<
  typeof updateMealPlanGroupSchema
>;

// ══════════════════════════════════════════════════════════════
// MealPlan (식사타입 × 라인업 단위 카드 — lineupId 필수)
// ══════════════════════════════════════════════════════════════

// Phase 5-R Step 3.2b-2-β: companyMealSlotId 단일 입력.
export const createMealPlanSchema = z.object({
  companyMealSlotId: z.string().min(1, "슬롯을 선택하세요"),
  lineupId: z.string().min(1, "라인업을 선택하세요"),
  mealTemplateId: z.string().optional(),
  note: z.string().max(500, "비고는 500자 이내").optional(),
});
export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;

export const updateMealPlanSchema = z.object({
  mealTemplateId: z.string().nullable().optional(),
  note: z.string().max(500, "비고는 500자 이내").nullable().optional(),
});
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;

// Phase 5-R Step 3.2b-2-β: companyMealSlotId 단일 입력.
export const upsertMealCountSchema = z.object({
  companyMealSlotId: z.string().min(1, "슬롯을 선택하세요"),
  lineupId: z.string().min(1, "라인업을 선택하세요"),
  estimatedCount: z.number().int().min(0).default(0),
  finalCount: z.number().int().min(0).nullable().optional(),
});
export type UpsertMealCountInput = z.infer<typeof upsertMealCountSchema>;

// ══════════════════════════════════════════════════════════════
// MealPlanSlot (실행 단위 — SlotKind discriminator)
// ──────────────────────────────────────────────────────────────
// DB는 모두 nullable, 앱 레벨에서 kind 별 필수 필드를 검증
// CONTAINER: subsidiaryMasterId + containerSlotIndex 필수, recipeId 필수
// DIRECT:    supplierItemId 필수
// 공통: sortOrder, quantity, productionLineId(선택), note(선택)
// ══════════════════════════════════════════════════════════════

const slotBaseSchema = z.object({
  sortOrder: z.number().int().min(0).default(0),
  // Phase 9-D-Sym: estimated/final 분리
  estimatedQuantity: z.number().int().min(0).default(0),
  finalQuantity: z.number().int().min(0).nullable().optional(),
  productionLineId: z.string().nullable().optional(),
  note: z.string().max(500, "비고는 500자 이내").nullable().optional(),
});

const containerSlotCreateSchema = slotBaseSchema.extend({
  kind: z.literal("CONTAINER"),
  subsidiaryMasterId: z.string().min(1, "용기를 선택하세요"),
  containerSlotIndex: z.number().int().min(0, "용기 슬롯 인덱스를 입력하세요"),
  recipeId: z.string().min(1, "레시피를 선택하세요"),
  recipeBomId: z.string().optional(),
  // DIRECT 전용 필드는 사용 불가
  supplierItemId: z.undefined().optional(),
});

const directSlotCreateSchema = slotBaseSchema.extend({
  kind: z.literal("DIRECT"),
  supplierItemId: z.string().min(1, "공급업체 품목을 선택하세요"),
  // CONTAINER 전용 필드는 사용 불가
  subsidiaryMasterId: z.undefined().optional(),
  containerSlotIndex: z.undefined().optional(),
  recipeId: z.undefined().optional(),
  recipeBomId: z.undefined().optional(),
});

export const createMealPlanSlotSchema = z.discriminatedUnion("kind", [
  containerSlotCreateSchema,
  directSlotCreateSchema,
]);
export type CreateMealPlanSlotInput = z.infer<typeof createMealPlanSlotSchema>;

// 업데이트는 부분 갱신 — kind 변경은 불가(삭제 후 재생성)
const containerSlotUpdateSchema = z.object({
  kind: z.literal("CONTAINER"),
  subsidiaryMasterId: z.string().optional(),
  containerSlotIndex: z.number().int().min(0).optional(),
  recipeId: z.string().nullable().optional(),
  recipeBomId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // Phase 9-D-Sym: estimated/final 분리
  estimatedQuantity: z.number().int().min(0).optional(),
  finalQuantity: z.number().int().min(0).nullable().optional(),
  productionLineId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

const directSlotUpdateSchema = z.object({
  kind: z.literal("DIRECT"),
  supplierItemId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // Phase 9-D-Sym: estimated/final 분리
  estimatedQuantity: z.number().int().min(0).optional(),
  finalQuantity: z.number().int().min(0).nullable().optional(),
  productionLineId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const updateMealPlanSlotSchema = z.discriminatedUnion("kind", [
  containerSlotUpdateSchema,
  directSlotUpdateSchema,
]);
export type UpdateMealPlanSlotInput = z.infer<typeof updateMealPlanSlotSchema>;

// 슬롯 재정렬용 (UI에서 drag&drop 후 일괄 갱신)
export const reorderMealPlanSlotsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1, "재정렬할 슬롯이 없습니다"),
});
export type ReorderMealPlanSlotsInput = z.infer<
  typeof reorderMealPlanSlotsSchema
>;


// ══════════════════════════════════════════════════════════════
// Phase 7-A3: 용기 그룹 단위 일괄 슬롯 생성
// ──────────────────────────────────────────────────────────────
// 한 식단에 (한 용기 그룹의 모든 슬롯)을 한 번에 추가한다.
// - recipeId는 슬롯별로 비어있을 수 있다 (미배정 허용 — A2 정책)
// - 슬롯 인덱스는 ContainerSlot의 slotIndex와 1:1 매칭
// - sortOrder는 서비스에서 기존 max+1부터 자동 부여
// ══════════════════════════════════════════════════════════════

export const bulkCreateContainerSlotsSchema = z.object({
  subsidiaryMasterId: z.string().min(1, "용기 그룹을 선택하세요"),
  defaultProductionLineId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        containerSlotIndex: z.number().int().min(0),
        recipeId: z.string().nullable().optional(),
        productionLineId: z.string().nullable().optional(),
        // Phase 9-D-Sym: 신규 슬롯 생성 시점에는 estimatedQuantity만 입력.
        // finalQuantity는 IN_PROGRESS 단계 진입 시 별도 편집.
        estimatedQuantity: z.number().int().min(0).default(0),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, "생성할 슬롯이 없습니다"),
});
export type BulkCreateContainerSlotsInput = z.infer<
  typeof bulkCreateContainerSlotsSchema
>;

// ══════════════════════════════════════════════════════════════
// MealCount (라인업별 식수 — 예상/확정 분리)
// ══════════════════════════════════════════════════════════════

// 일괄 입력 (UI에서 그룹 단위로 라인업 식수 한번에 저장)
export const bulkUpsertMealCountSchema = z.object({
  items: z.array(upsertMealCountSchema).min(1, "입력할 식수가 없습니다"),
});
export type BulkUpsertMealCountInput = z.infer<
  typeof bulkUpsertMealCountSchema
>;

// ══════════════════════════════════════════════════════════════
// MealPlanAccessory (식단별 부자재)
// ══════════════════════════════════════════════════════════════

export const createMealPlanAccessorySchema = z.object({
  subsidiaryMasterId: z.string().min(1, "부자재를 선택하세요"),
  consumptionMode: z.enum(["PER_MEAL_COUNT", "FIXED_QUANTITY"]),
  fixedQuantity: z.number().int().min(0).nullable().optional(),
  required: z.boolean().default(true),
  note: z.string().max(500).nullable().optional(),
});
export type CreateMealPlanAccessoryInput = z.infer<
  typeof createMealPlanAccessorySchema
>;

export const updateMealPlanAccessorySchema =
  createMealPlanAccessorySchema.partial();
export type UpdateMealPlanAccessoryInput = z.infer<
  typeof updateMealPlanAccessorySchema
>;

// ══════════════════════════════════════════════════════════════
// Copy / 자동 적용 — 식단 템플릿 → 슬롯 일괄 생성
// ══════════════════════════════════════════════════════════════

export const applyMealTemplateSchema = z.object({
  mealTemplateId: z.string().min(1, "식단 템플릿을 선택하세요"),
  /**
   * true이면 기존 슬롯을 모두 제거 후 템플릿 기반 신규 생성
   * false이면 기존 슬롯 유지 + 템플릿 슬롯을 append
   */
  replaceExisting: z.boolean().default(true),
});
export type ApplyMealTemplateInput = z.infer<typeof applyMealTemplateSchema>;

export const copyMealPlanGroupSchema = z.object({
  sourceMealPlanGroupId: z.string().min(1),
  targetPlanDate: isoDateString,
  copyMealCounts: z.boolean().default(false),
  copyAccessories: z.boolean().default(true),
});
export type CopyMealPlanGroupInput = z.infer<typeof copyMealPlanGroupSchema>;
