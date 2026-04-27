import { z } from "zod";
import { UnitCategory } from "@prisma/client";

const unitCategoryValues = Object.values(UnitCategory) as [string, ...string[]];

export const createUnitConversionSchema = z.object({
  fromMaterialId: z.string().min(1, "변환 전 자재를 선택해야 합니다"),
  toMaterialId: z.string().min(1, "변환 후 자재를 선택해야 합니다"),
  fromUnit: z.string().min(1, "변환 전 단위는 필수입니다").max(20),
  toUnit: z.string().min(1, "변환 후 단위는 필수입니다").max(20),
  factor: z.number().positive("환산 계수는 0보다 커야 합니다"),
  unitCategory: z
    .enum(unitCategoryValues)
    .transform((v) => v as UnitCategory),
});

export const updateUnitConversionSchema = z.object({
  fromUnit: z.string().min(1).max(20).optional(),
  toUnit: z.string().min(1).max(20).optional(),
  factor: z.number().positive().optional(),
  unitCategory: z
    .enum(unitCategoryValues)
    .transform((v) => v as UnitCategory)
    .optional(),
});

export const unitConversionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  materialId: z.string().optional(),
});

export type CreateUnitConversionInput = z.output<typeof createUnitConversionSchema>;
export type UpdateUnitConversionInput = z.output<typeof updateUnitConversionSchema>;
export type UnitConversionListQuery = z.output<typeof unitConversionListQuerySchema>;
