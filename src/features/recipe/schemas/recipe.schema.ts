import { z } from "zod";
import { OwnerType, BOMStatus, ItemType } from "@prisma/client";

const ownerTypeValues = Object.values(OwnerType) as [string, ...string[]];
const bomStatusValues = Object.values(BOMStatus) as [string, ...string[]];
const itemTypeValues = Object.values(ItemType) as [string, ...string[]];

// ── Recipe 생성 ──
export const createRecipeSchema = z.object({
  name: z
    .string()
    .min(1, "레시피명은 필수입니다")
    .max(100, "레시피명은 100자 이내여야 합니다"),
  description: z.string().max(500, "설명은 500자 이내여야 합니다").optional(),
});

// ── Recipe 수정 ──
export const updateRecipeSchema = createRecipeSchema.partial();

// ── RecipeVariant 생성 ──
export const createRecipeVariantSchema = z.object({
  variantName: z
    .string()
    .min(1, "변형명은 필수입니다")
    .max(100, "변형명은 100자 이내여야 합니다"),
  servings: z.number().int().min(1, "인분 수는 1 이상이어야 합니다").default(1),
  baseWeightG: z.number().min(0.1).nullable().optional(),   // ← 추가
  description: z.string().max(500, "설명은 500자 이내여야 합니다").optional(),
});

// ── RecipeVariant 수정 ──
export const updateRecipeVariantSchema = createRecipeVariantSchema.partial();

// ── SemiProduct 생성 ──
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

// ── SemiProduct 수정 ──
export const updateSemiProductSchema = createSemiProductSchema.partial();

// ── BOM 생성 ──
export const createBOMSchema = z.object({
  ownerType: z.enum(ownerTypeValues).transform((v) => v as OwnerType),
  recipeVariantId: z.string().optional(),
  semiProductId: z.string().optional(),
  version: z.number().int().min(1).default(1),
  status: z
    .enum(bomStatusValues)
    .transform((v) => v as BOMStatus)
    .default("DRAFT"),
});

// ── BOM 상태 변경 ──
export const updateBOMStatusSchema = z.object({
  status: z.enum(bomStatusValues).transform((v) => v as BOMStatus),
});

// ── BOMItem 생성 ──
export const createBOMItemSchema = z.object({
  itemType: z.enum(itemTypeValues).transform((v) => v as ItemType),
  materialMasterId: z.string().optional(),
  subsidiaryMasterId: z.string().optional(),
  quantity: z.number().min(0.001, "수량은 0보다 커야 합니다"),
  unit: z
    .string()
    .min(1, "단위는 필수입니다")
    .max(20, "단위는 20자 이내여야 합니다"),
  sortOrder: z.number().int().min(0).default(0),
});

// ── BOMItem 수정 ──
export const updateBOMItemSchema = z.object({
  quantity: z.number().min(0.001, "수량은 0보다 커야 합니다").optional(),
  unit: z
    .string()
    .min(1, "단위는 필수입니다")
    .max(20, "단위는 20자 이내여야 합니다")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ── 목록 조회용 필터 스키마 ──
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

// ── ServingSet 생성 ──
export const createServingSetSchema = z.object({
  recipeVariantId: z.string().min(1, "변형 ID는 필수입니다"),
  version: z.number().int().min(1).default(1),
  status: z
    .enum(bomStatusValues)
    .transform((v) => v as BOMStatus)
    .default("DRAFT"),
});

// ── ServingSet 상태 변경 ──
export const updateServingSetStatusSchema = z.object({
  status: z.enum(bomStatusValues).transform((v) => v as BOMStatus),
});

// ── ServingSetItem 생성 ──
export const createServingSetItemSchema = z.object({
  containerGroupId: z.string().min(1, "용기 그룹은 필수입니다"),
  slotIndex: z.number().int().min(0, "슬롯 인덱스는 0 이상이어야 합니다"),
  servingWeightG: z.number().min(0.1, "서빙 중량은 0.1g 이상이어야 합니다"),
  note: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

// ── ServingSetItem 수정 ──
export const updateServingSetItemSchema = z.object({
  servingWeightG: z.number().min(0.1, "서빙 중량은 0.1g 이상이어야 합니다").optional(),
  note: z.string().max(200).optional(),
});

// ── RecipeVariant baseWeightG 수정 ──
export const updateBaseWeightSchema = z.object({
  baseWeightG: z.number().min(0.1, "기준 중량은 0.1g 이상이어야 합니다").nullable(),
});

// ── 타입 추출 ──
export type CreateRecipeInput = z.output<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.output<typeof updateRecipeSchema>;
export type CreateRecipeVariantInput = z.output<typeof createRecipeVariantSchema>;
export type UpdateRecipeVariantInput = z.output<typeof updateRecipeVariantSchema>;
export type CreateSemiProductInput = z.output<typeof createSemiProductSchema>;
export type UpdateSemiProductInput = z.output<typeof updateSemiProductSchema>;
export type CreateBOMInput = z.output<typeof createBOMSchema>;
export type UpdateBOMStatusInput = z.output<typeof updateBOMStatusSchema>;
export type CreateBOMItemInput = z.output<typeof createBOMItemSchema>;
export type UpdateBOMItemInput = z.output<typeof updateBOMItemSchema>;
export type RecipeListQuery = z.output<typeof recipeListQuerySchema>;
export type SemiProductListQuery = z.output<typeof semiProductListQuerySchema>;
export type CreateServingSetInput = z.output<typeof createServingSetSchema>;
export type UpdateServingSetStatusInput = z.output<typeof updateServingSetStatusSchema>;
export type CreateServingSetItemInput = z.output<typeof createServingSetItemSchema>;
export type UpdateServingSetItemInput = z.output<typeof updateServingSetItemSchema>;
export type UpdateBaseWeightInput = z.output<typeof updateBaseWeightSchema>;

