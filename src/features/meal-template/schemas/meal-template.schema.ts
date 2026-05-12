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

export const createMealTemplateSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100),
  containerGroupId: z.string().min(1, "용기 그룹을 선택하세요"),
});
export type CreateMealTemplateInput = z.infer<typeof createMealTemplateSchema>;

export const updateMealTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  containerGroupId: z.string().min(1).optional(),
});
export type UpdateMealTemplateInput = z.infer<typeof updateMealTemplateSchema>;

// ── MealTemplateSlot ──

export const createMealTemplateSlotSchema = z.object({
  slotIndex: z.coerce.number().int().min(0),
  label: z.string().min(1, "슬롯 이름을 입력하세요").max(50),
  isRequired: z.boolean().default(true),
});
export type CreateMealTemplateSlotInput = z.infer<typeof createMealTemplateSlotSchema>;

export const updateMealTemplateSlotSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  isRequired: z.boolean().optional(),
});
export type UpdateMealTemplateSlotInput = z.infer<typeof updateMealTemplateSlotSchema>;

// ── MealTemplateAccessory ──

export const createMealTemplateAccessorySchema = z.object({
  name: z.string().min(1, "부속품 이름을 입력하세요").max(100),
  isRequired: z.boolean().default(false),
});
export type CreateMealTemplateAccessoryInput = z.infer<typeof createMealTemplateAccessorySchema>;

export const updateMealTemplateAccessorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isRequired: z.boolean().optional(),
});
export type UpdateMealTemplateAccessoryInput = z.infer<typeof updateMealTemplateAccessorySchema>;
