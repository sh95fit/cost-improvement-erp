import { z } from "zod";

/**
 * ════════════════════════════════════════
 * S4-3-c-3: 사용 이력 리스트 조회 쿼리 스키마
 * ════════════════════════════════════════
 *
 * 필터
 *  - startDate / endDate: 사용일(consumedDate) 범위 (YYYY-MM-DD)
 *  - locationId: 사업장 (선택 — 미지정 시 세션 회사 전체)
 *  - itemType: MATERIAL | SUBSIDIARY | all
 *  - sourceType: MEAL_PLAN_AUTO | MANUAL_ADDITION | all
 *  - disposition: USED | RETURNED | DISPOSED | all
 *
 * 정렬
 *  - 기본: consumedDate desc, createdAt desc (컴포지트, 서비스에서 하드코딩)
 */
export const consumptionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // 사용일 범위 (YYYY-MM-DD)
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // 사업장 (선택)
  locationId: z.string().min(1).optional(),

  // 품목 유형
  itemType: z
    .enum(["MATERIAL", "SUBSIDIARY", "all"])
    .transform((v) => (v === "all" ? undefined : v))
    .optional(),

  // 출처
  sourceType: z
    .enum(["MEAL_PLAN_AUTO", "MANUAL_ADDITION", "all"])
    .transform((v) => (v === "all" ? undefined : v))
    .optional(),

  // 처분
  disposition: z
    .enum(["USED", "RETURNED", "DISPOSED", "all"])
    .transform((v) => (v === "all" ? undefined : v))
    .optional(),
});

export type ConsumptionListQuery = z.output<typeof consumptionListQuerySchema>;
