// src/features/lineup/schemas/lineup.schema.ts
import { z } from "zod";

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
  isActive: z
    .union([z.boolean(), z.enum(["true", "false", "all"])])
    .transform((v) => {
      if (v === "all") return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    })
    .optional(),
  sortBy: z
    .enum(["name", "code", "createdAt", "sortOrder"])
    .default("sortOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// ============================================================
// 2. LineupLocationMap — 코드 레벨 배제 (이전 결정 유지)
// ============================================================

// (이전 주석 그대로 유지)

// ============================================================
// 3. LineupMealTemplateMap — 폐기 (Phase 5-R Step 2 정정)
//    사유: 슬롯-템플릿 매핑은 식단(MealPlan) 작성 단계에서 결정됨.
//    마이그레이션: 20260527020000_phase5r_step2_drop_lineup_template_map
// ============================================================

// ============================================================
// 4. 타입 추출
// ============================================================

export type CreateLineupInput = z.infer<typeof createLineupSchema>;
export type UpdateLineupInput = z.infer<typeof updateLineupSchema>;
export type LineupListQuery = z.output<typeof lineupListQuerySchema>;
