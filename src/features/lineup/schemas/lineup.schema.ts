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
});

// ── 수정 ──
export const updateLineupSchema = z.object({
  name: z
    .string()
    .min(1, "라인업명은 필수입니다")
    .max(100, "라인업명은 100자 이내여야 합니다")
    .optional(),
});

// ── 목록 조회 쿼리 ──
export const lineupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// ============================================================
// 2. LineupLocationMap (라인업 ↔ 배송지)
// ============================================================

// ── 단건 생성 (드물게 사용) ──
export const createLineupLocationMapSchema = z.object({
  locationId: z.string().min(1, "배송지를 선택해야 합니다"),
});

// ── 일괄 동기화 (UI에서 체크박스 다중 선택 후 저장) ──
//   - locationIds 배열을 받아 현재 매핑을 해당 배열과 동일하게 만듦
//   - 빠진 매핑은 hard delete (이 매핑 자체는 audit 가치가 낮음)
export const syncLineupLocationsSchema = z.object({
  locationIds: z
    .array(z.string().min(1))
    .max(500, "배송지는 한 번에 500개까지 매핑 가능합니다"),
});

// ============================================================
// 3. LineupMealTemplateMap (라인업 × 슬롯타입 → 기본 식단 템플릿)
// ============================================================

// ── 단건 생성/업서트 ──
//   - 같은 (lineupId, slotType) 조합이 활성 상태로 존재하면 update,
//     soft-deleted 상태면 복원 + update, 없으면 create
export const upsertLineupTemplateMapSchema = z.object({
  slotType: z
    .enum(mealSlotTypeValues)
    .transform((v) => v as MealSlotType),
  mealTemplateId: z.string().min(1, "식단 템플릿을 선택해야 합니다"),
});

// ── 일괄 업서트 ──
//   - UI에서 슬롯타입별 셀렉트박스 묶음으로 한 번에 저장할 때 사용
export const bulkUpsertLineupTemplateMapsSchema = z.object({
  items: z
    .array(upsertLineupTemplateMapSchema)
    .max(20, "한 번에 최대 20개까지 매핑 가능합니다"),
});

// ── 목록 조회 (라인업 단위) ──
//   - 별도 페이지네이션 없음 (슬롯타입 5개 한정)
export const lineupTemplateMapListQuerySchema = z.object({
  lineupId: z.string().min(1),
});

// ============================================================
// 4. 타입 추출
// ============================================================

export type CreateLineupInput = z.infer<typeof createLineupSchema>;
export type UpdateLineupInput = z.infer<typeof updateLineupSchema>;
export type LineupListQuery = z.output<typeof lineupListQuerySchema>;

export type CreateLineupLocationMapInput = z.infer<
  typeof createLineupLocationMapSchema
>;
export type SyncLineupLocationsInput = z.infer<
  typeof syncLineupLocationsSchema
>;

export type UpsertLineupTemplateMapInput = z.output<
  typeof upsertLineupTemplateMapSchema
>;
export type BulkUpsertLineupTemplateMapsInput = z.output<
  typeof bulkUpsertLineupTemplateMapsSchema
>;
export type LineupTemplateMapListQuery = z.output<
  typeof lineupTemplateMapListQuerySchema
>;