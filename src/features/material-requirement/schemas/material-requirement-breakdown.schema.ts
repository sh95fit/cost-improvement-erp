// src/features/material-requirement/schemas/material-requirement-breakdown.schema.ts
import { z } from "zod";
import { MealCountSource } from "@prisma/client";

// ============================================================
// Phase 4-C2 (D29) / DC5: Lineup Breakdown
// ------------------------------------------------------------
// 읽기 전용 집계 액션의 입출력 계약.
//   - 입력: mealPlanGroupId + countSource (필수 2종)
//   - 출력: lineup × {materials, suppliers, orders}
//     * S5 본 단계에서는 materials만 채우고 suppliers/orders는 빈 배열 반환
//     * S5-A에서 suppliers/orders 채움 (PO ↔ MR 역추적 검증 후)
//
// 본 액션은 PO 생성/재고 차감 등 쓰기 경로에 일절 관여하지 않는다 (PC2/DC4).
// ============================================================

export const lineupBreakdownInputSchema = z.object({
  mealPlanGroupId: z.string().min(1, "식단 그룹 ID가 필요합니다"),
  countSource: z.enum(MealCountSource).default(MealCountSource.ESTIMATED),
});

export type LineupBreakdownInput = z.infer<typeof lineupBreakdownInputSchema>;

// ── 라인업 × 자재 집계 단건 ─────────────────────────────────────
const breakdownMaterialRowSchema = z.object({
  materialMasterId: z.string(),
  materialCode: z.string(),
  materialName: z.string(),
  requiredQty: z.number().nonnegative(), // grams
  unit: z.literal("g"),
});

// ── 라인업 단위 그룹 ────────────────────────────────────────────
const lineupBreakdownGroupSchema = z.object({
  lineupId: z.string().nullable(),
  lineupCode: z.string().nullable(),
  lineupName: z.string().nullable(),
  materials: z.array(breakdownMaterialRowSchema),
  // S5-A에서 채움. 현재는 항상 빈 배열.
  suppliers: z.array(z.unknown()).default([]),
  orders: z.array(z.unknown()).default([]),
});

export const lineupBreakdownResultSchema = z.object({
  mealPlanGroupId: z.string(),
  countSource: z.enum(MealCountSource),
  groups: z.array(lineupBreakdownGroupSchema),
});

export type LineupBreakdownResult = z.infer<typeof lineupBreakdownResultSchema>;
export type LineupBreakdownGroup = z.infer<typeof lineupBreakdownGroupSchema>;
export type LineupBreakdownMaterialRow = z.infer<
  typeof breakdownMaterialRowSchema
>;
