// src/features/container/schemas/container.schema.ts
import { z } from "zod";

// ── 용기(SubsidiaryMaster) 목록 조회 ──
// → containers 페이지에서 사용. subsidiary 서비스로 위임하므로 여기서는 슬롯 관리만
export const containerSlotListQuerySchema = z.object({
  subsidiaryMasterId: z.string().min(1, "용기 ID는 필수입니다"),
});
export type ContainerSlotListQuery = z.output<typeof containerSlotListQuerySchema>;

// ── 슬롯 생성/수정 ──
export const createContainerSlotSchema = z.object({
  label: z.string().min(1, "슬롯명은 필수입니다").max(50),
  volumeMl: z.number().min(0).optional(),
});
export type CreateContainerSlotInput = z.output<typeof createContainerSlotSchema>;

export const updateContainerSlotSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  volumeMl: z.number().min(0).nullable().optional(),
});
export type UpdateContainerSlotInput = z.output<typeof updateContainerSlotSchema>;
