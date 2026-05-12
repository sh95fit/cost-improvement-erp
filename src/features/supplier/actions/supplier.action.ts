// src/features/supplier/actions/supplier.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
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
    return handleActionError(error, "업체 목록 조회에 실패했습니다");
  }
}

export async function getSupplierByIdAction(
  id: string
): Promise<ActionResult<Supplier | null>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");
    const supplier = await supplierService.getSupplierById(session.companyId, id);
    return actionOk(supplier);
  } catch (error) {
    return handleActionError(error, "업체 조회에 실패했습니다");
  }
}

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
    return handleActionError(error, "업체 생성에 실패했습니다");
  }
}

export async function updateSupplierAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<Supplier>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "UPDATE");
    const input = updateSupplierSchema.parse(rawInput);
    const existing = await supplierService.getSupplierById(session.companyId, id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "업체 수정에 실패했습니다", { NOT_FOUND: "업체를 찾을 수 없습니다" });
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
    return handleActionError(error, "업체 수정에 실패했습니다");
  }
}

export async function deleteSupplierAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "DELETE");
    const existing = await supplierService.getSupplierById(session.companyId, id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "업체 삭제에 실패했습니다", { NOT_FOUND: "업체를 찾을 수 없습니다" });
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
    return handleActionError(error, "업체 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// SupplierItem Actions
// ════════════════════════════════════════

export async function getSupplierItemsAction(
  supplierId: string
): Promise<ActionResult<SupplierItem[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");
    const supplier = await supplierService.getSupplierById(session.companyId, supplierId);
    if (!supplier) return handleActionError(new Error("NOT_FOUND"), "공급 품목 조회에 실패했습니다", { NOT_FOUND: "업체를 찾을 수 없습니다" });
    const items = await supplierItemService.getSupplierItems(supplierId);
    return actionOk(items);
  } catch (error) {
    return handleActionError(error, "공급 품목 조회에 실패했습니다");
  }
}

export async function createSupplierItemAction(
  supplierId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SupplierItem>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "CREATE");
    const supplier = await supplierService.getSupplierById(session.companyId, supplierId);
    if (!supplier) return handleActionError(new Error("NOT_FOUND"), "공급 품목 생성에 실패했습니다", { NOT_FOUND: "업체를 찾을 수 없습니다" });
    const input = createSupplierItemSchema.parse(rawInput);
    const duplicate = await supplierItemService.findDuplicateSupplierItem(
      supplierId,
      input.itemType,
      input.productName,
      input.materialMasterId,
      input.subsidiaryMasterId
    );
    if (duplicate) return handleActionError(new Error("DUPLICATE_ITEM"), "공급 품목 생성에 실패했습니다", { DUPLICATE_ITEM: "동일한 제품명의 공급 품목이 이미 등록되어 있습니다" });
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
    return handleActionError(error, "공급 품목 생성에 실패했습니다");
  }
}

export async function updateSupplierItemAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SupplierItem>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "UPDATE");
    const input = updateSupplierItemSchema.parse(rawInput);
    const existing = await supplierItemService.getSupplierItemById(id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "공급 품목 수정에 실패했습니다", { NOT_FOUND: "공급 품목을 찾을 수 없습니다" });
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
    return handleActionError(error, "공급 품목 수정에 실패했습니다");
  }
}

export async function deleteSupplierItemAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "DELETE");
    const existing = await supplierItemService.getSupplierItemById(id);
    if (!existing) return handleActionError(new Error("NOT_FOUND"), "공급 품목 삭제에 실패했습니다", { NOT_FOUND: "공급 품목을 찾을 수 없습니다" });
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
    return handleActionError(error, "공급 품목 삭제에 실패했습니다");
  }
}

export async function getPriceHistoryAction(
  supplierItemId: string
): Promise<ActionResult<{ id: string; supplierItemId: string; price: number; effectiveFrom: Date; createdAt: Date }[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");
    const history = await supplierItemService.getPriceHistory(supplierItemId);
    return actionOk(history);
  } catch (error) {
    return handleActionError(error, "단가 이력 조회에 실패했습니다");
  }
}

export async function getSupplierItemsByMaterialAction(
  materialMasterId: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");
    const items = await supplierItemService.getSupplierItemsByMaterialId(materialMasterId);
    return actionOk(items);
  } catch (error) {
    return handleActionError(error, "자재별 공급 품목 조회에 실패했습니다");
  }
}

export async function getSupplierItemsBySubsidiaryAction(
  subsidiaryMasterId: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "supplier", "READ");
    const items = await supplierItemService.getSupplierItemsBySubsidiaryId(subsidiaryMasterId);
    return actionOk(items);
  } catch (error) {
    return handleActionError(error, "부자재별 공급 품목 조회에 실패했습니다");
  }
}
