"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierListQuerySchema,
  createSupplierItemSchema,
  updateSupplierItemSchema,
} from "../schemas/supplier.schema";
import * as supplierService from "../services/supplier.service";
import * as supplierItemService from "../services/supplier-item.service";
import type { Supplier, SupplierItem } from "@prisma/client";

// ════════════════════════════════════════
// Supplier Actions
// ════════════════════════════════════════

// ── 업체 목록 조회 ──
export async function getSuppliersAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: (Supplier & { _count: { supplierItems: number } })[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");

    const query = supplierListQuerySchema.parse(rawQuery);
    const result = await supplierService.getSuppliers(session.companyId, query);

    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "업체 목록 조회에 실패했습니다");
  }
}

// ── 업체 단건 조회 ──
export async function getSupplierByIdAction(
  id: string
): Promise<ActionResult<Supplier | null>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");

    const supplier = await supplierService.getSupplierById(session.companyId, id);
    return actionOk(supplier);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "업체 조회에 실패했습니다");
  }
}

// ── 업체 생성 ──
export async function createSupplierAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<Supplier>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "CREATE");

    const input = createSupplierSchema.parse(rawInput);
    const supplier = await supplierService.createSupplier(session.companyId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "Supplier",
      entityId: supplier.id,
      after: supplier as unknown as Record<string, unknown>,
    });

    return actionOk(supplier);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "업체 생성에 실패했습니다");
  }
}

// ── 업체 수정 ──
export async function updateSupplierAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<Supplier>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "UPDATE");

    const input = updateSupplierSchema.parse(rawInput);

    const existing = await supplierService.getSupplierById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "업체를 찾을 수 없습니다");
    }

    const before = existing as unknown as Record<string, unknown>;
    const supplier = await supplierService.updateSupplier(session.companyId, id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "Supplier",
      entityId: supplier.id,
      before,
      after: supplier as unknown as Record<string, unknown>,
    });

    return actionOk(supplier);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "업체 수정에 실패했습니다");
  }
}

// ── 업체 삭제 ──
export async function deleteSupplierAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "DELETE");

    const existing = await supplierService.getSupplierById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "업체를 찾을 수 없습니다");
    }

    await supplierService.deleteSupplier(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "Supplier",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "업체 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// SupplierItem Actions
// ════════════════════════════════════════

// ── 공급 품목 목록 조회 ──
export async function getSupplierItemsAction(
  supplierId: string
): Promise<ActionResult<SupplierItem[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");

    const supplier = await supplierService.getSupplierById(session.companyId, supplierId);
    if (!supplier) {
      return actionFail("NOT_FOUND", "업체를 찾을 수 없습니다");
    }

    const items = await supplierItemService.getSupplierItems(supplierId);
    return actionOk(items);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "공급 품목 조회에 실패했습니다");
  }
}

// ── 공급 품목 생성 ──
export async function createSupplierItemAction(
  supplierId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SupplierItem>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "CREATE");

    const supplier = await supplierService.getSupplierById(session.companyId, supplierId);
    if (!supplier) {
      return actionFail("NOT_FOUND", "업체를 찾을 수 없습니다");
    }

    const input = createSupplierItemSchema.parse(rawInput);

    // 중복 확인 (같은 업체 + 같은 자재/부자재 + 같은 제품명)
    const duplicate = await supplierItemService.findDuplicateSupplierItem(
      supplierId,
      input.itemType,
      input.productName,
      input.materialMasterId,
      input.subsidiaryMasterId
    );
    if (duplicate) {
      return actionFail("DUPLICATE_ITEM", "동일한 제품명의 공급 품목이 이미 등록되어 있습니다");
    }

    const item = await supplierItemService.createSupplierItem(supplierId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "SupplierItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });

    return actionOk(item);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "공급 품목 생성에 실패했습니다");
  }
}

// ── 공급 품목 수정 ──
export async function updateSupplierItemAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SupplierItem>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "UPDATE");

    const input = updateSupplierItemSchema.parse(rawInput);

    const existing = await supplierItemService.getSupplierItemById(id);
    if (!existing) {
      return actionFail("NOT_FOUND", "공급 품목을 찾을 수 없습니다");
    }

    const before = existing as unknown as Record<string, unknown>;
    const item = await supplierItemService.updateSupplierItem(id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "SupplierItem",
      entityId: item.id,
      before,
      after: item as unknown as Record<string, unknown>,
    });

    return actionOk(item);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "공급 품목 수정에 실패했습니다");
  }
}

// ── 공급 품목 삭제 ──
export async function deleteSupplierItemAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "DELETE");

    const existing = await supplierItemService.getSupplierItemById(id);
    if (!existing) {
      return actionFail("NOT_FOUND", "공급 품목을 찾을 수 없습니다");
    }

    await supplierItemService.deleteSupplierItem(id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "SupplierItem",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "공급 품목 삭제에 실패했습니다");
  }
}

// ── 단가 이력 조회 ──
export async function getPriceHistoryAction(
  supplierItemId: string
): Promise<ActionResult<{ id: string; supplierItemId: string; price: number; effectiveFrom: Date; createdAt: Date }[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");

    const history = await supplierItemService.getPriceHistory(supplierItemId);
    return actionOk(history);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "단가 이력 조회에 실패했습니다");
  }
}
