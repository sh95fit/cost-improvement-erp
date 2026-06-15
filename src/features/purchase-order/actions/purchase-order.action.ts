// src/features/purchase-order/actions/purchase-order.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  transitionPurchaseOrderStatusSchema,
  purchaseOrderListQuerySchema,
} from "../schemas/purchase-order.schema";
import * as purchaseOrderService from "../services/purchase-order.service";
import type { PurchaseOrder } from "@prisma/client";

// ════════════════════════════════════════
// 공통 도메인 에러 메시지
// ════════════════════════════════════════
const PO_DOMAIN_ERRORS = {
  NOT_FOUND: "발주서를 찾을 수 없습니다",
  PO_LOCKED: "확정 입고 또는 취소된 발주서는 수정할 수 없습니다",
  PO_NOT_DRAFT: "작성중 상태의 발주서만 삭제할 수 있습니다. 그 외 상태는 취소 전이를 사용하세요",
  INVALID_TRANSITION: "허용되지 않는 상태 전이입니다",
} as const;

// ════════════════════════════════════════
// PurchaseOrder Actions
// ════════════════════════════════════════

export async function getPurchaseOrdersAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof purchaseOrderService.getPurchaseOrders>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "READ");
    const query = purchaseOrderListQuerySchema.parse(rawQuery);
    const result = await purchaseOrderService.getPurchaseOrders(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "발주서 목록 조회에 실패했습니다");
  }
}

export async function getPurchaseOrderByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof purchaseOrderService.getPurchaseOrderById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "READ");
    const po = await purchaseOrderService.getPurchaseOrderById(session.companyId, id);
    return actionOk(po);
  } catch (error) {
    return handleActionError(error, "발주서 조회에 실패했습니다");
  }
}

export async function createPurchaseOrderAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "CREATE");

    // companyId/createdByUserId는 세션에서 강제 주입 (입력 무시)
    const input = createPurchaseOrderSchema.parse({
      ...rawInput,
      companyId: session.companyId,
      createdByUserId: session.userId,
    });

    const po = await purchaseOrderService.createPurchaseOrder(session.companyId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "PurchaseOrder",
      entityId: po.id,
      after: po as unknown as Record<string, unknown>,
    });

    return actionOk(po);
  } catch (error) {
    return handleActionError(error, "발주서 생성에 실패했습니다");
  }
}

export async function updatePurchaseOrderAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "UPDATE");

    const input = updatePurchaseOrderSchema.parse(rawInput);

    const existing = await purchaseOrderService.getPurchaseOrderById(session.companyId, id);
    if (!existing) {
      return handleActionError(new Error("NOT_FOUND"), "발주서 수정에 실패했습니다", PO_DOMAIN_ERRORS);
    }

    const before = existing as unknown as Record<string, unknown>;
    const po = await purchaseOrderService.updatePurchaseOrder(session.companyId, id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "PurchaseOrder",
      entityId: po.id,
      before,
      after: po as unknown as Record<string, unknown>,
    });

    return actionOk(po);
  } catch (error) {
    return handleActionError(error, "발주서 수정에 실패했습니다", PO_DOMAIN_ERRORS);
  }
}

export async function transitionPurchaseOrderStatusAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const session = await requireCompanySession();
    // 상태 전이는 UPDATE 권한과 동일 권한으로 처리 (확정/취소는 동일 도메인 운영자 권한)
    assertPermission(session, "purchase-order", "UPDATE");

    // actorUserId는 세션에서 강제 주입
    const input = transitionPurchaseOrderStatusSchema.parse({
      ...rawInput,
      actorUserId: session.userId,
    });

    const existing = await purchaseOrderService.getPurchaseOrderById(session.companyId, id);
    if (!existing) {
      return handleActionError(new Error("NOT_FOUND"), "발주서 상태 변경에 실패했습니다", PO_DOMAIN_ERRORS);
    }

    const before = { status: existing.status } as unknown as Record<string, unknown>;
    const po = await purchaseOrderService.transitionPurchaseOrderStatus(
      session.companyId,
      id,
      input
    );

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "PurchaseOrder",
      entityId: po.id,
      before,
      after: {
        status: po.status,
        submittedAt: po.submittedAt,
        approvedAt: po.approvedAt,
        approvedByUserId: po.approvedByUserId,
        cancelledAt: po.cancelledAt,
        cancelledByUserId: po.cancelledByUserId,
        cancelReason: po.cancelReason,
      } as unknown as Record<string, unknown>,
    });

    return actionOk(po);
  } catch (error) {
    return handleActionError(error, "발주서 상태 변경에 실패했습니다", PO_DOMAIN_ERRORS);
  }
}

export async function deletePurchaseOrderAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "DELETE");

    const existing = await purchaseOrderService.getPurchaseOrderById(session.companyId, id);
    if (!existing) {
      return handleActionError(new Error("NOT_FOUND"), "발주서 삭제에 실패했습니다", PO_DOMAIN_ERRORS);
    }

    await purchaseOrderService.deletePurchaseOrder(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "PurchaseOrder",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "발주서 삭제에 실패했습니다", PO_DOMAIN_ERRORS);
  }
}