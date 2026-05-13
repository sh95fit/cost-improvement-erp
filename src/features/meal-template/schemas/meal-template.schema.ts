// src/features/meal-template/schemas/meal-template.schema.ts
import { z } from "zod";

// ── MealTemplate ──

export const mealTemplateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type MealTemplateListQuery = z.infer<typeof mealTemplateListQuerySchema>;

// ★ v5: containerGroupId 제거 — MealTemplate는 name만
export const createMealTemplateSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100),
});
export type CreateMealTemplateInput = z.infer<typeof createMealTemplateSchema>;

export const updateMealTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
export type UpdateMealTemplateInput = z.infer<typeof updateMealTemplateSchema>;

// ── MealTemplateContainer (★ v5 신규: MealTemplateSlot 대체) ──

export const createMealTemplateContainerSchema = z.object({
  subsidiaryMasterId: z.string().min(1, "용기를 선택하세요"),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateMealTemplateContainerInput = z.infer<typeof createMealTemplateContainerSchema>;

export const updateMealTemplateContainerSchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateMealTemplateContainerInput = z.infer<typeof updateMealTemplateContainerSchema>;

// ── MealTemplateAccessory (★ v5: name 제거, subsidiaryMasterId 추가) ──

export const createMealTemplateAccessorySchema = z.object({
  subsidiaryMasterId: z.string().min(1, "부자재를 선택하세요"),
  consumptionType: z.enum(["PER_MEAL_COUNT", "FIXED_QUANTITY"]).default("PER_MEAL_COUNT"),
  fixedQuantity: z.number().min(0).optional(),
  isRequired: z.boolean().default(false),
});
export type CreateMealTemplateAccessoryInput = z.infer<typeof createMealTemplateAccessorySchema>;

export const updateMealTemplateAccessorySchema = z.object({
  consumptionType: z.enum(["PER_MEAL_COUNT", "FIXED_QUANTITY"]).optional(),
  fixedQuantity: z.number().min(0).optional(),
  isRequired: z.boolean().optional(),
});
export type UpdateMealTemplateAccessoryInput = z.infer<typeof updateMealTemplateAccessorySchema>;
