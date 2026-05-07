import { z } from "zod";
import { MaterialType, UnitCategory, StockGrade } from "@prisma/client";

// Prisma enum → Zod enum 변환
const materialTypeValues = Object.values(MaterialType) as [string, ...string[]];
const unitCategoryValues = Object.values(UnitCategory) as [string, ...string[]];
const stockGradeValues = Object.values(StockGrade) as [string, ...string[]];

// ── MaterialMaster 생성 스키마 ──
export const createMaterialSchema = z.object({
  name: z
    .string()
    .min(1, "자재명은 필수입니다")
    .max(100, "자재명은 100자 이내여야 합니다"),
  materialType: z.enum(materialTypeValues).transform((v) => v as MaterialType),
  unit: z
    .string()
    .min(1, "단위는 필수입니다")
    .max(20, "단위는 20자 이내여야 합니다"),
  unitCategory: z.enum(unitCategoryValues).transform((v) => v as UnitCategory),
  shelfLifeDays: z
    .number()
    .int()
    .min(0, "유통기한은 0일 이상이어야 합니다")
    .optional(),
  stockGrade: z
    .enum(stockGradeValues)
    .transform((v) => v as StockGrade)
    .optional(),
  minStock: z
    .number()
    .min(0, "최소 재고량은 0 이상이어야 합니다")
    .optional(),
  maxStock: z
    .number()
    .min(0, "최대 재고량은 0 이상이어야 합니다")
    .optional(),
});

// ── MaterialMaster 수정 스키마 (모든 필드 optional) ──
export const updateMaterialSchema = createMaterialSchema.partial();

// ── SubsidiaryMaster 생성 스키마 ──
export const createSubsidiarySchema = z.object({
  name: z
    .string()
    .min(1, "부자재명은 필수입니다")
    .max(100, "부자재명은 100자 이내여야 합니다"),
  unit: z
    .string()
    .min(1, "단위는 필수입니다")
    .max(20, "단위는 20자 이내여야 합니다"),
  unitCategory: z.enum(unitCategoryValues).transform((v) => v as UnitCategory),
  stockGrade: z
    .enum(stockGradeValues)
    .transform((v) => v as StockGrade)
    .optional(),
});

// ── SubsidiaryMaster 수정 스키마 ──
export const updateSubsidiarySchema = createSubsidiarySchema.partial();

// ── 목록 조회용 필터 스키마 ──
export const materialListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  materialType: z
    .enum(materialTypeValues)
    .transform((v) => v as MaterialType)
    .optional(),
  stockGrade: z
    .enum(stockGradeValues)
    .transform((v) => v as StockGrade)
    .optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── 타입 추출 ──
export type CreateMaterialInput = z.output<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.output<typeof updateMaterialSchema>;
export type CreateSubsidiaryInput = z.output<typeof createSubsidiarySchema>;
export type UpdateSubsidiaryInput = z.output<typeof updateSubsidiarySchema>;
export type MaterialListQuery = z.output<typeof materialListQuerySchema>;
