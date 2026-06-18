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
  loadPOWizardDataSchema, // ★ 4-B'-5a 추가
} from "../schemas/purchase-order.schema";
import * as purchaseOrderService from "../services/purchase-order.service";
import {
  createPurchaseOrdersBatch,
  createPurchaseOrdersBatchSchema,
  type CreatePurchaseOrdersBatchResult,
} from "../services/purchase-order-batch.service"; // ★ 4-B'-5a 추가
import { buildPOItemsFromMR } from "../lib/build-po-items-from-mr"; // ★ 4-B'-5a 추가
import type { PurchaseOrder, POStatus, POBatchMode } from "@prisma/client";

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
    return handleActionError(error, "발주 생성에 실패했습니다", {
      LOCATION_NOT_FOUND: "지정한 공장/창고를 찾을 수 없습니다",
      PRODUCTION_LINE_NOT_FOUND: "지정한 생산 라인을 찾을 수 없습니다",
      LINE_LOCATION_MISMATCH: "생산 라인의 공장과 발주의 공장이 일치하지 않습니다",
    });
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


// ════════════════════════════════════════
// ★ Phase 4-B'-5a: 위저드 전용 액션
// ════════════════════════════════════════

/**
 * Step 1: 위저드에서 선택 가능한 식단 그룹 목록 조회
 * - 정책: status가 IN_PROGRESS 또는 COMPLETED인 그룹만 (산출 가능 상태)
 * - 최근 30일 + planDate 최신순
 */
export async function getMealPlanGroupsForOrderAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      planDate: Date;
      status: string;
      mealPlanCount: number;
    }>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "READ");

    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Prisma 직접 호출 (얇은 액션 — 별도 서비스 필요 없음)
    const { prisma } = await import("@/lib/prisma");
    const groups = await prisma.mealPlanGroup.findMany({
      where: {
        companyId: session.companyId,
        deletedAt: null,
        status: { in: ["IN_PROGRESS", "COMPLETED"] },
        planDate: { gte: since },
      },
      select: {
        id: true,
        planDate: true,
        status: true,
        _count: { select: { mealPlans: true } },
      },
      orderBy: { planDate: "desc" },
      take: 100,
    });

    return actionOk(
      groups.map((g) => ({
        id: g.id,
        planDate: g.planDate,
        status: g.status,
        mealPlanCount: g._count.mealPlans,
      })),
    );
  } catch (error) {
    return handleActionError(error, "식단 그룹 목록 조회에 실패했습니다");
  }
}

/**
 * Step 2: 선택한 식단 그룹의 MR을 조회하고 발주 후보 항목으로 변환
 * - MR 조회 (countSource 필터)
 * - buildPOItemsFromMR() 호출 → mapped/unmapped/noOrderNeeded 분류
 * - 재고는 noopInventoryAdapter 사용 (Phase 6에서 실 서비스로 교체)
 */
export async function loadPOWizardDataAction(
  rawInput: Record<string, unknown>,
): Promise<
  ActionResult<Awaited<ReturnType<typeof buildPOItemsFromMR>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "CREATE");

    const input = loadPOWizardDataSchema.parse(rawInput);

    // MR 직접 조회 (build-po-items-from-mr가 요구하는 최소 필드만)
    const { prisma } = await import("@/lib/prisma");
    const mrs = await prisma.materialRequirement.findMany({
      where: {
        companyId: session.companyId,
        mealPlanGroupId: input.mealPlanGroupId,
        countSource: input.countSource,
        deletedAt: null,
      },
      select: {
        id: true,
        materialMasterId: true,
        productionLineId: true,
        locationId: true,
        requiredQty: true,
        unit: true,
      },
    });

    const result = await buildPOItemsFromMR({
      companyId: session.companyId,
      materialRequirements: mrs,
    });

    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "발주 후보 자재 로드에 실패했습니다");
  }
}

/**
 * Step 5: 위저드 확정 항목으로 N개 PO 일괄 생성
 * - createPurchaseOrdersBatch 호출 (트랜잭션 + 그룹핑)
 * - 각 PO에 대해 개별 감사 로그 생성
 */
export async function createPurchaseOrdersBatchAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<CreatePurchaseOrdersBatchResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "CREATE");

    // companyId/createdByUserId는 세션에서 강제 주입
    const input = createPurchaseOrdersBatchSchema.parse({
      ...rawInput,
      companyId: session.companyId,
      createdByUserId: session.userId,
    });

    const result = await createPurchaseOrdersBatch(input);

    // 감사 로그: 생성된 PO 1건당 1개
    for (const po of result.createdPurchaseOrders) {
      await createAuditLog({
        session,
        action: "CREATE",
        entityType: "PurchaseOrder",
        entityId: po.id,
        after: {
          orderNumber: po.orderNumber,
          supplierId: po.supplierId,
          locationId: po.locationId,
          productionLineId: po.productionLineId,
          itemCount: po.itemCount,
          totalAmount: po.totalAmount,
          source: "WIZARD_BATCH",
        } as unknown as Record<string, unknown>,
      });
    }

    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "발주서 일괄 생성에 실패했습니다", {
      EMPTY_ITEMS: "발주 항목이 없습니다",
      LOCATION_NOT_FOUND: "지정한 공장/창고를 찾을 수 없습니다",
      PRODUCTION_LINE_NOT_FOUND: "지정한 생산 라인을 찾을 수 없습니다",
      LINE_LOCATION_MISMATCH: "생산 라인의 공장과 발주의 공장이 일치하지 않습니다",
      SUPPLIER_NOT_FOUND: "공급업체를 찾을 수 없습니다",
      SUPPLIER_ITEM_NOT_FOUND: "공급업체 품목 정보가 올바르지 않습니다",
      REPLACE_BLOCKED_BY_NON_DRAFT_PO:
        "발주등록 이상 상태의 PO가 있어 덮어쓸 수 없습니다. 차분 발주(DELTA)로 진행하거나 해당 PO를 먼저 취소하세요",
      // ★ R1-b3
      DELTA_BLOCKED_BY_APPROVED_PO:
        "발주확정 이상 상태의 PO가 포함되어 변경할 수 없습니다. 부족분은 신규 발주로, 오배송·과다는 재고 실사로 처리하세요",
      DELTA_MISSING_BASED_ON_POS:
        "차분 발주 대상 PO가 지정되지 않았습니다",
    });
  }
}

// ============================================================
// ★ R1-b1: 위저드 사전 안내 — 기존 활성 PO 조회
// ============================================================
//
// Step 1 (식단그룹 선택 직후) 및 Step 5 (생성 직전) 에서 호출.
// 동일 식단그룹에 이미 생성된 활성 PO 들을 표시해 사용자가 신규/차분/덮어쓰기 결정 가능.

export interface ExistingPOSummary {
  id: string;
  orderNumber: string;
  status: POStatus;
  supplierName: string;
  locationName: string;
  productionLineName: string | null;
  totalAmount: number;
  itemCount: number;
  createdByName: string | null;
  createdAt: Date;
  batchId: string | null;
  batchMode: POBatchMode | null;
}

export interface ExistingPOsSummaryResult {
  pos: ExistingPOSummary[];
  counts: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    received: number;
  };
}

export async function getExistingPOsForMealPlanGroupAction(
  mealPlanGroupId: string,
): Promise<ActionResult<ExistingPOsSummaryResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "READ");

    const { prisma } = await import("@/lib/prisma");
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        companyId: session.companyId,
        mealPlanGroupId,
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        supplier: { select: { name: true } },
        location: { select: { name: true } },
        productionLine: { select: { name: true } },
        createdByUser: { select: { name: true } },
        batch: { select: { id: true, mode: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const summaries: ExistingPOSummary[] = pos.map((po) => ({
      id: po.id,
      orderNumber: po.orderNumber,
      status: po.status,
      supplierName: po.supplier.name,
      locationName: po.location.name,
      productionLineName: po.productionLine?.name ?? null,
      totalAmount: po.totalAmount ?? 0,
      itemCount: po._count.items,
      createdByName: po.createdByUser?.name ?? null,
      createdAt: po.createdAt,
      batchId: po.batch?.id ?? null,
      batchMode: po.batch?.mode ?? null,
    }));

    const counts = {
      total: summaries.length,
      draft: summaries.filter((p) => p.status === "DRAFT").length,
      submitted: summaries.filter((p) => p.status === "SUBMITTED").length,
      approved: summaries.filter((p) => p.status === "APPROVED").length,
      received: summaries.filter((p) => p.status === "RECEIVED").length,
    };

    return actionOk({ pos: summaries, counts });
  } catch (error) {
    return handleActionError(error, "기존 발주서 조회에 실패했습니다");
  }
}
