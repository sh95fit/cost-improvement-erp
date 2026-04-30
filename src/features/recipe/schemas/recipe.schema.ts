import { z } from "zod";
import { IngredientType, BOMStatus } from "@prisma/client";

const ingredientTypeValues = Object.values(IngredientType) as [string, ...string[]];
const bomStatusValues = Object.values(BOMStatus) as [string, ...string[]];

// ════════════════════════════════════════
// Recipe
// ════════════════════════════════════════

export const createRecipeSchema = z.object({
  name: z
    .string()
    .min(1, "레시피명은 필수입니다")
    .max(100, "레시피명은 100자 이내여야 합니다"),
  description: z.string().max(500, "설명은 500자 이내여야 합니다").optional(),
});

export const updateRecipeSchema = createRecipeSchema.partial();

// ════════════════════════════════════════
// RecipeIngredient
// ════════════════════════════════════════

export const createRecipeIngredientSchema = z
  .object({
    ingredientType: z
      .enum(ingredientTypeValues)
      .transform((v) => v as IngredientType),
    materialMasterId: z.string().optional(),
    semiProductId: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.ingredientType === "MATERIAL") return !!data.materialMasterId;
      if (data.ingredientType === "SEMI_PRODUCT") return !!data.semiProductId;
      return false;
    },
    { message: "재료 타입에 맞는 ID가 필요합니다" }
  );

export const updateRecipeIngredientSchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
});

// ════════════════════════════════════════
// RecipeBOM
// ════════════════════════════════════════

export const createRecipeBOMSchema = z.object({
  recipeId: z.string().min(1, "레시피 ID는 필수입니다"),
  version: z.number().int().min(1).default(1),
  status: z
    .enum(bomStatusValues)
    .transform((v) => v as BOMStatus)
    .default("DRAFT"),
  // ★ 변경: min(0.1) → min(0).default(0) — BOM 생성 시 기준중량 0 허용
  baseWeightG: z.number().min(0).default(0),
});

export const updateRecipeBOMStatusSchema = z.object({
  status: z.enum(bomStatusValues).transform((v) => v as BOMStatus),
});

// ★ 변경: min(0.1) → min(0)
export const updateRecipeBOMBaseWeightSchema = z.object({
  baseWeightG: z.number().min(0, "기준 중량은 0 이상이어야 합니다"),
});

// ════════════════════════════════════════
// RecipeBOMSlot
// ════════════════════════════════════════

export const createRecipeBOMSlotSchema = z.object({
  containerGroupId: z.string().min(1, "용기 그룹은 필수입니다"),
  slotIndex: z.number().int().min(0, "슬롯 인덱스는 0 이상이어야 합니다"),
  totalWeightG: z.number().min(0.1, "총 중량은 0.1g 이상이어야 합니다"),
  note: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateRecipeBOMSlotSchema = z.object({
  totalWeightG: z.number().min(0.1).optional(),
  note: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ════════════════════════════════════════
// RecipeBOMSlotItem
// ════════════════════════════════════════

export const createRecipeBOMSlotItemSchema = z
  .object({
    ingredientType: z
      .enum(ingredientTypeValues)
      .transform((v) => v as IngredientType),
    materialMasterId: z.string().optional(),
    semiProductId: z.string().optional(),
    // ★ 변경: min(0.01) → min(0).default(0) — 자동할당 시 weightG=0 허용
    weightG: z.number().min(0).default(0),
    unit: z.string().max(20).default("g"),
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.ingredientType === "MATERIAL") return !!data.materialMasterId;
      if (data.ingredientType === "SEMI_PRODUCT") return !!data.semiProductId;
      return false;
    },
    { message: "재료 타입에 맞는 ID가 필요합니다" }
  );

// ★ 변경: min(0.01) → min(0)
export const updateRecipeBOMSlotItemSchema = z.object({
  weightG: z.number().min(0).optional(),
  unit: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ════════════════════════════════════════
// SemiProduct
// ════════════════════════════════════════

export const createSemiProductSchema = z.object({
  name: z
    .string()
    .min(1, "반제품명은 필수입니다")
    .max(100, "반제품명은 100자 이내여야 합니다"),
  unit: z
    .string()
    .min(1, "단위는 필수입니다")
    .max(20, "단위는 20자 이내여야 합니다"),
});

export const updateSemiProductSchema = createSemiProductSchema.partial();

// ════════════════════════════════════════
// BOM (반제품 전용)
// ════════════════════════════════════════

export const createBOMSchema = z.object({
  semiProductId: z.string().min(1, "반제품 ID는 필수입니다"),
  version: z.number().int().min(1).default(1),
  status: z
    .enum(bomStatusValues)
    .transform((v) => v as BOMStatus)
    .default("DRAFT"),
  baseQuantity: z.number().min(0.001).default(1),
  baseUnit: z.string().max(20).default("kg"),
});

export const updateBOMStatusSchema = z.object({
  status: z.enum(bomStatusValues).transform((v) => v as BOMStatus),
});

// ════════════════════════════════════════
// BOMItem (반제품 BOM 전용)
// ════════════════════════════════════════

export const createBOMItemSchema = z.object({
  materialMasterId: z.string().min(1, "식자재 ID는 필수입니다"),
  quantity: z.number().min(0.001, "수량은 0보다 커야 합니다"),
  unit: z
    .string()
    .min(1, "단위는 필수입니다")
    .max(20, "단위는 20자 이내여야 합니다"),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateBOMItemSchema = z.object({
  quantity: z.number().min(0.001).optional(),
  unit: z.string().min(1).max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ════════════════════════════════════════
// 목록 조회용 필터
// ════════════════════════════════════════

export const recipeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const semiProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ════════════════════════════════════════
// 타입 추출
// ════════════════════════════════════════

export type CreateRecipeInput = z.output<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.output<typeof updateRecipeSchema>;
export type CreateRecipeIngredientInput = z.output<typeof createRecipeIngredientSchema>;
export type UpdateRecipeIngredientInput = z.output<typeof updateRecipeIngredientSchema>;
export type CreateRecipeBOMInput = z.output<typeof createRecipeBOMSchema>;
export type UpdateRecipeBOMStatusInput = z.output<typeof updateRecipeBOMStatusSchema>;
export type UpdateRecipeBOMBaseWeightInput = z.output<typeof updateRecipeBOMBaseWeightSchema>;
export type CreateRecipeBOMSlotInput = z.output<typeof createRecipeBOMSlotSchema>;
export type UpdateRecipeBOMSlotInput = z.output<typeof updateRecipeBOMSlotSchema>;
export type CreateRecipeBOMSlotItemInput = z.output<typeof createRecipeBOMSlotItemSchema>;
export type UpdateRecipeBOMSlotItemInput = z.output<typeof updateRecipeBOMSlotItemSchema>;
export type CreateSemiProductInput = z.output<typeof createSemiProductSchema>;
export type UpdateSemiProductInput = z.output<typeof updateSemiProductSchema>;
export type CreateBOMInput = z.output<typeof createBOMSchema>;
export type UpdateBOMStatusInput = z.output<typeof updateBOMStatusSchema>;
export type CreateBOMItemInput = z.output<typeof createBOMItemSchema>;
export type UpdateBOMItemInput = z.output<typeof updateBOMItemSchema>;
export type RecipeListQuery = z.output<typeof recipeListQuerySchema>;
export type SemiProductListQuery = z.output<typeof semiProductListQuerySchema>;
