import { z } from "zod";
import { UnitCategory } from "@prisma/client";

const unitCategoryValues = Object.values(UnitCategory) as [string, ...string[]];

export const createUnitConversionSchema = z.object({
  materialMasterId: z.string().nullable().default(null),
  subsidiaryMasterId: z.string().nullable().default(null),
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
  subsidiaryId: z.string().optional(),
  scope: z.enum(["all", "global", "material", "subsidiary"]).default("all"),
});

export type CreateUnitConversionInput = z.output<typeof createUnitConversionSchema>;
export type UpdateUnitConversionInput = z.output<typeof updateUnitConversionSchema>;
export type UnitConversionListQuery = z.output<typeof unitConversionListQuerySchema>;
