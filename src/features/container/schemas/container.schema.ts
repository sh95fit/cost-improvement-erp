// src/features/container/schemas/container.schema.ts — 전체 코드
import { z } from "zod";

// ── 목록 조회 ──
export const containerGroupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// ── 용기 그룹 생성/수정 ──
export const createContainerGroupSchema = z.object({
  name: z.string().min(1, "용기 그룹명은 필수입니다").max(100),
});

export const updateContainerGroupSchema = createContainerGroupSchema.partial();

// ── 슬롯 생성/수정 ──
// ★ 변경: slotIndex를 optional로 (서버에서 자동 채번)
export const createContainerSlotSchema = z.object({
  slotIndex: z.number().int().min(1).optional(),
  label: z.string().min(1, "슬롯명은 필수입니다").max(50),
  volumeMl: z.number().min(0).optional(),
});

export const updateContainerSlotSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  volumeMl: z.number().min(0).nullable().optional(),
});

// ── 부속품 생성/수정 (DB 무결성 유지용) ──
export const createContainerAccessorySchema = z.object({
  name: z.string().min(1, "부속품명은 필수입니다").max(100),
  description: z.string().max(200).optional(),
});

export const updateContainerAccessorySchema = createContainerAccessorySchema.partial();

// ── 타입 추출 ──
export type ContainerGroupListQuery = z.output<typeof containerGroupListQuerySchema>;
export type CreateContainerGroupInput = z.output<typeof createContainerGroupSchema>;
export type UpdateContainerGroupInput = z.output<typeof updateContainerGroupSchema>;
export type CreateContainerSlotInput = z.output<typeof createContainerSlotSchema>;
export type UpdateContainerSlotInput = z.output<typeof updateContainerSlotSchema>;
export type CreateContainerAccessoryInput = z.output<typeof createContainerAccessorySchema>;
export type UpdateContainerAccessoryInput = z.output<typeof updateContainerAccessorySchema>;
