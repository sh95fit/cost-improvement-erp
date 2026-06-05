import { z } from "zod";

export const ProductionLineStatusEnum = z.enum([
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
]);
export type ProductionLineStatusValue = z.infer<
  typeof ProductionLineStatusEnum
>;

// ── 생성 ──
export const createProductionLineSchema = z.object({
  locationId: z.string().min(1, "위치(공장)는 필수입니다"),
  name: z
    .string()
    .min(1, "라인명은 필수입니다")
    .max(100, "라인명은 100자 이내여야 합니다"),
  status: ProductionLineStatusEnum.default("ACTIVE"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  note: z
    .string()
    .max(500, "비고는 500자 이내여야 합니다")
    .optional()
    .nullable(),
});

// ── 수정 ──
export const updateProductionLineSchema = z.object({
  locationId: z.string().min(1).optional(),
  name: z
    .string()
    .min(1, "라인명은 필수입니다")
    .max(100, "라인명은 100자 이내여야 합니다")
    .optional(),
  status: ProductionLineStatusEnum.optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  note: z.string().max(500).optional().nullable(),
});

// ── 목록 조회 쿼리 ──
export const productionLineListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  locationId: z.string().optional(),
  status: ProductionLineStatusEnum.optional(),
  sortBy: z
    .enum(["name", "code", "status", "createdAt", "sortOrder"])
    .default("sortOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type CreateProductionLineInput = z.infer<
  typeof createProductionLineSchema
>;
export type UpdateProductionLineInput = z.infer<
  typeof updateProductionLineSchema
>;
export type ProductionLineListQuery = z.output<
  typeof productionLineListQuerySchema
>;
