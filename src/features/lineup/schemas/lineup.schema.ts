// src/features/lineup/schemas/lineup.schema.ts
import { z } from "zod";
import { MealSlotType } from "@prisma/client";

const mealSlotTypeValues = Object.values(MealSlotType) as [string, ...string[]];

// ============================================================
// 1. Lineup (라인업) CRUD
// ============================================================

// ── 생성 ──
export const createLineupSchema = z.object({
  name: z
    .string()
    .min(1, "라인업명은 필수입니다")
    .max(100, "라인업명은 100자 이내여야 합니다"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  description: z
    .string()
    .max(500, "설명은 500자 이내여야 합니다")
    .optional()
    .nullable(),
});

// ── 수정 ──
export const updateLineupSchema = z.object({
  name: z
    .string()
    .min(1, "라인업명은 필수입니다")
    .max(100, "라인업명은 100자 이내여야 합니다")
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  description: z
    .string()
    .max(500, "설명은 500자 이내여야 합니다")
    .optional()
    .nullable(),
});

// ── 목록 조회 쿼리 ──
export const lineupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  // ★ 활성 필터 추가 — UI 기본값은 "활성만"
  isActive: z
    .union([z.boolean(), z.enum(["true", "false", "all"])])
    .transform((v) => {
      if (v === "all") return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    })
    .optional(),
  // ★ 정렬에 sortOrder 추가
  sortBy: z
    .enum(["name", "code", "createdAt", "sortOrder"])
    .default("sortOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// ============================================================
// 2. LineupLocationMap — 현재 비즈니스 모델상 쓰임이 명확하지 않아 코드 배제
//    원가 산출은 lineupId 기반 group by로 충분.
//    향후 명확한 쓰임이 정의되면 주석 해제하여 복원.
// ============================================================

// export const createLineupLocationMapSchema = z.object({
//   locationId: z.string().min(1, "공장을 선택해야 합니다"),
// });

// export const syncLineupLocationsSchema = z.object({
//   locationIds: z
//     .array(z.string().min(1))
//     .max(500, "공장은 한 번에 500개까지 매핑 가능합니다"),
// });

// ============================================================
// 3. LineupMealTemplateMap (라인업 × 슬롯타입 → 기본 식단 템플릿)
// ============================================================

export const upsertLineupTemplateMapSchema = z.object({
  slotType: z
    .enum(mealSlotTypeValues)
    .transform((v) => v as MealSlotType),
  mealTemplateId: z.string().min(1, "식단 템플릿을 선택해야 합니다"),
});

export const bulkUpsertLineupTemplateMapsSchema = z.object({
  items: z
    .array(upsertLineupTemplateMapSchema)
    .max(20, "한 번에 최대 20개까지 매핑 가능합니다"),
});

export const lineupTemplateMapListQuerySchema = z.object({
  lineupId: z.string().min(1),
});

// ============================================================
// 4. 타입 추출
// ============================================================

export type CreateLineupInput = z.infer<typeof createLineupSchema>;
export type UpdateLineupInput = z.infer<typeof updateLineupSchema>;
export type LineupListQuery = z.output<typeof lineupListQuerySchema>;

// LocationMap 타입도 주석 처리
// export type CreateLineupLocationMapInput = z.infer<typeof createLineupLocationMapSchema>;
// export type SyncLineupLocationsInput = z.infer<typeof syncLineupLocationsSchema>;

export type UpsertLineupTemplateMapInput = z.output<
  typeof upsertLineupTemplateMapSchema
>;
export type BulkUpsertLineupTemplateMapsInput = z.output<
  typeof bulkUpsertLineupTemplateMapsSchema
>;
export type LineupTemplateMapListQuery = z.output<
  typeof lineupTemplateMapListQuerySchema
>;
