import { z } from "zod";
import { ItemType, SupplierType } from "@prisma/client";

const itemTypeValues = Object.values(ItemType) as [string, ...string[]];
const supplierTypeValues = Object.values(SupplierType) as [string, ...string[]];

// ── Supplier 생성 스키마 ──
export const createSupplierSchema = z.object({
  name: z
    .string()
    .min(1, "업체명은 필수입니다")
    .max(100, "업체명은 100자 이내여야 합니다"),
  supplierType: z
    .enum(supplierTypeValues)
    .transform((v) => v as SupplierType)
    .optional()
    .default("MATERIAL"),
  contactName: z.string().max(50).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.email("올바른 이메일 형식이 아닙니다").optional().or(z.literal("")),
  address: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});

// ── Supplier 수정 스키마 ──
export const updateSupplierSchema = createSupplierSchema.partial();

// ── Supplier 목록 조회 스키마 ──
export const supplierListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  supplierType: z
    .enum(supplierTypeValues)
    .transform((v) => v as SupplierType)
    .optional(),
  sortBy: z.enum(["name", "code", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── SupplierItem 생성 스키마 ──
export const createSupplierItemSchema = z.object({
  itemType: z.enum(itemTypeValues).transform((v) => v as ItemType),
  materialMasterId: z.string().optional(),
  subsidiaryMasterId: z.string().optional(),
  productName: z
    .string()
    .min(1, "제품명은 필수입니다")
    .max(100, "제품명은 100자 이내여야 합니다"),
  spec: z.string().max(50, "규격은 50자 이내여야 합니다").optional(),
  supplyUnit: z
    .string()
    .min(1, "공급 단위는 필수입니다")
    .max(30, "공급 단위는 30자 이내여야 합니다"),
  supplyUnitQty: z
    .number()
    .positive("공급 단위 수량은 0보다 커야 합니다"),
  currentPrice: z
    .number()
    .min(0, "단가는 0 이상이어야 합니다"),
  leadTimeDays: z
    .number()
    .int()
    .min(0, "리드타임은 0일 이상이어야 합니다")
    .optional(),
}).refine(
  (data) => {
    if (data.itemType === "MATERIAL") return !!data.materialMasterId;
    if (data.itemType === "SUBSIDIARY") return !!data.subsidiaryMasterId;
    return false;
  },
  { message: "자재 또는 부자재를 선택해야 합니다", path: ["materialMasterId"] }
);

// ── SupplierItem 수정 스키마 ──
export const updateSupplierItemSchema = z.object({
  productName: z.string().min(1).max(100).optional(),
  spec: z.string().max(50).optional(),
  supplyUnit: z.string().min(1).max(30).optional(),
  supplyUnitQty: z.number().positive().optional(),
  currentPrice: z.number().min(0).optional(),
  leadTimeDays: z.number().int().min(0).optional(),
});

// ── 타입 추출 ──
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierListQuery = z.output<typeof supplierListQuerySchema>;
export type CreateSupplierItemInput = z.output<typeof createSupplierItemSchema>;
export type UpdateSupplierItemInput = z.output<typeof updateSupplierItemSchema>;
