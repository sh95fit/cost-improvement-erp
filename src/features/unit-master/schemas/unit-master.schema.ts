import { z } from "zod";
import { ItemType, UnitCategory } from "@prisma/client";

const itemTypeValues = Object.values(ItemType) as [string, ...string[]];
const unitCategoryValues = Object.values(UnitCategory) as [string, ...string[]];

export const createUnitMasterSchema = z.object({
  itemType: z.enum(itemTypeValues).transform((v) => v as ItemType),
  unitCategory: z.enum(unitCategoryValues).transform((v) => v as UnitCategory),
  code: z.string().min(1, "단위 코드는 필수입니다").max(20, "단위 코드는 20자 이내여야 합니다"),
  name: z.string().min(1, "단위명은 필수입니다").max(50, "단위명은 50자 이내여야 합니다"),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateUnitMasterSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  unitCategory: z
    .enum(unitCategoryValues)
    .transform((v) => v as UnitCategory)
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const unitMasterListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  itemType: z.enum(itemTypeValues).transform((v) => v as ItemType),
  unitCategory: z.enum(unitCategoryValues).transform((v) => v as UnitCategory).optional(),
});

export type CreateUnitMasterInput = z.output<typeof createUnitMasterSchema>;
export type UpdateUnitMasterInput = z.output<typeof updateUnitMasterSchema>;
export type UnitMasterListQuery = z.output<typeof unitMasterListQuerySchema>;
