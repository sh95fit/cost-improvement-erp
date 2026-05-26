// src/features/lineup/schemas/lineup.schema.ts
import { z } from "zod";

// ── 라인업 목록 조회 쿼리 ──
export const lineupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
export type LineupListQuery = z.output<typeof lineupListQuerySchema>;
