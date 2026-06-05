import { z } from "zod";

// ============================================================
// 1. Location (공장/창고) CRUD
// ============================================================

export const LocationTypeEnum = z.enum(["FACTORY", "WAREHOUSE", "HYBRID"]);
export type LocationTypeValue = z.infer<typeof LocationTypeEnum>;

// ── 생성 ──
export const createLocationSchema = z.object({
  name: z
    .string()
    .min(1, "위치명은 필수입니다")
    .max(100, "위치명은 100자 이내여야 합니다"),
  type: LocationTypeEnum.default("FACTORY"),
  address: z
    .string()
    .max(255, "주소는 255자 이내여야 합니다")
    .optional()
    .nullable(),
  note: z
    .string()
    .max(500, "비고는 500자 이내여야 합니다")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ── 수정 ──
export const updateLocationSchema = z.object({
  name: z
    .string()
    .min(1, "위치명은 필수입니다")
    .max(100, "위치명은 100자 이내여야 합니다")
    .optional(),
  type: LocationTypeEnum.optional(),
  address: z.string().max(255).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

// ── 목록 조회 쿼리 ──
export const locationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  type: LocationTypeEnum.optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false", "all"])])
    .transform((v) => {
      if (v === "all") return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    })
    .optional(),
  sortBy: z
    .enum(["name", "code", "type", "createdAt", "sortOrder"])
    .default("sortOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// ============================================================
// 2. 타입 추출
// ============================================================

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type LocationListQuery = z.output<typeof locationListQuerySchema>;
