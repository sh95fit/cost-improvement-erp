// src/features/meal-plan/schemas/meal-plan.schema.ts
import { z } from "zod";

// ══════════════════════════════════════════
// MealPlanGroup
// ══════════════════════════════════════════

export const mealPlanGroupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  lineupId: z.string().optional(),
  dateFrom: z.string().optional(),   // ISO date string "2026-05-14"
  dateTo: z.string().optional(),
  sortBy: z.enum(["planDate", "createdAt", "status"]).default("planDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type MealPlanGroupListQuery = z.infer<typeof mealPlanGroupListQuerySchema>;

export const createMealPlanGroupSchema = z.object({
  lineupId: z.string().min(1, "라인업을 선택하세요"),
  planDate: z.string().min(1, "날짜를 입력하세요"),  // ISO date string → 서비스에서 Date 변환
});
export type CreateMealPlanGroupInput = z.infer<typeof createMealPlanGroupSchema>;

export const updateMealPlanGroupSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});
export type UpdateMealPlanGroupInput = z.infer<typeof updateMealPlanGroupSchema>;

// ══════════════════════════════════════════
// MealPlan
// ══════════════════════════════════════════

export const createMealPlanSchema = z.object({
  slotType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  mealTemplateId: z.string().optional(),
});
export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;

export const updateMealPlanSchema = z.object({
  mealTemplateId: z.string().nullable().optional(),
});
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;

// ══════════════════════════════════════════
// MealPlanSlot
// ══════════════════════════════════════════

export const createMealPlanSlotSchema = z.object({
  slotIndex: z.number().int().min(0),
  recipeId: z.string().optional(),
  recipeBomId: z.string().optional(),
  quantity: z.number().int().min(0).default(0),
  note: z.string().optional(),
});
export type CreateMealPlanSlotInput = z.infer<typeof createMealPlanSlotSchema>;

export const updateMealPlanSlotSchema = z.object({
  recipeId: z.string().nullable().optional(),
  recipeBomId: z.string().nullable().optional(),
  quantity: z.number().int().min(0).optional(),
  note: z.string().nullable().optional(),
});
export type UpdateMealPlanSlotInput = z.infer<typeof updateMealPlanSlotSchema>;
