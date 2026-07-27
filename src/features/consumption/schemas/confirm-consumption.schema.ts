import { z } from "zod";
import { ItemType, DisposalReason } from "@prisma/client";

/**
 * ════════════════════════════════════════
 * S4-3-c-R6-B-3 — 사용 처리 확정 액션 입력 스키마 (audit §10-14)
 * 호출부 실측 (consumption-draft-form.tsx:207-229) 기준으로 필드 정합.
 * ════════════════════════════════════════
 */

/**
 * Layer A: buildConsumptionDraft 로부터 파생된 확정 소요 항목.
 *   - lineupId/productionLineId 는 R6-B-1 에서 이미 non-null 보장.
 *   - suggestedQty/totalAvailable 은 drift 재검증에 사용.
 *   - disposalReason/disposalNote 는 폐기 발생 시에만 존재.
 */
export const layerAItemSchema = z.object({
  itemType: z.nativeEnum(ItemType),
  itemId: z.string().min(1),
  lineupId: z.string().min(1, "Layer A 항목의 라인업 정보가 누락되었습니다"),
  productionLineId: z.string().min(1, "Layer A 항목의 생산라인 정보가 누락되었습니다"),
  suggestedQty: z.number(),
  totalAvailable: z.number(),
  finalUsedQty: z.number(),
  remainingToStock: z.number(),
  disposalReason: z.nativeEnum(DisposalReason).optional(),
  disposalNote: z.string().optional(),
});

/**
 * Layer B: 사용자가 추가한 수동 사용 항목.
 *   - §10-14: lineupId/productionLineId 필수 (UI 선택 강제).
 *   - clientId 는 UI 임시 키로 서버에는 넘어오지 않음 (호출부 실측 기준).
 */
export const layerBItemSchema = z.object({
  itemType: z.nativeEnum(ItemType),
  itemId: z.string().min(1),
  quantity: z.number().positive("수량은 0보다 커야 합니다"),
  lineupId: z.string().min(1, "라인업을 선택해야 합니다"),
  productionLineId: z.string().min(1, "생산라인이 매핑되지 않았습니다"),
  note: z.string().max(500).optional(),
});

export const confirmConsumptionSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "targetDate 형식이 올바르지 않습니다"),
  locationId: z.string().min(1),
  layerAItems: z.array(layerAItemSchema),
  layerBItems: z.array(layerBItemSchema),
});

export type LayerAItemInput = z.output<typeof layerAItemSchema>;
export type LayerBItemInput = z.output<typeof layerBItemSchema>;
export type ConfirmConsumptionInput = z.output<typeof confirmConsumptionSchema>;
