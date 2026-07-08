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
import type {
  ExistingPOItemForDelta,
  NewItemForDelta,
} from "@/features/purchase-order/services/po-delta.service";

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
      // ★ Sprint 3.5 Phase S3.5-1 — 라인업 에러
      LINEUP_REQUIRED_FOR_MANUAL: "수동 발주는 라인업 지정이 필수입니다",
      LINEUP_NOT_FOUND: "지정한 라인업을 찾을 수 없습니다",
      LINEUP_COMPANY_MISMATCH: "라인업이 현재 회사에 속하지 않습니다",
      LINEUP_INACTIVE: "비활성 라인업은 사용할 수 없습니다",
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
    return handleActionError(error, "발주서 수정에 실패했습니다", {
      ...PO_DOMAIN_ERRORS,
      LOCATION_NOT_FOUND: "지정한 공장/창고를 찾을 수 없습니다",
      PRODUCTION_LINE_NOT_FOUND: "지정한 생산 라인을 찾을 수 없습니다",
      LINE_LOCATION_MISMATCH: "생산 라인의 공장과 발주의 공장이 일치하지 않습니다",
      // ★ Sprint 3.5 Phase S3.5-1 — 라인업 에러
      LINEUP_REQUIRED_FOR_MANUAL: "수동 발주는 라인업 지정이 필수입니다",
      LINEUP_NOT_FOUND: "지정한 라인업을 찾을 수 없습니다",
      LINEUP_COMPANY_MISMATCH: "라인업이 현재 회사에 속하지 않습니다",
      LINEUP_INACTIVE: "비활성 라인업은 사용할 수 없습니다",
    });
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
 * - ★ Phase 4-G G-2: 각 그룹의 활성 MR 개수 반환 → 미산출 그룹 disabled 처리용
 */
export async function getMealPlanGroupsForOrderAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      planDate: Date;
      status: string;
      mealPlanCount: number;
      materialRequirementCount: number;
    }>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "READ");

    const since = new Date();
    since.setDate(since.getDate() - 30);

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
        _count: {
          select: {
            mealPlans: true,
            // ★ Phase 4-G G-2: 활성 MR 개수 (soft-delete 제외)
            materialRequirements: { where: { deletedAt: null } },
          },
        },
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
        materialRequirementCount: g._count.materialRequirements,
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
        // ★ Phase 4-C2 (UI): lineup 차원 전파 (DC5 다축 뷰용, 쓰기 경로 무영향)
        lineupId: true,
        lineup: { select: { name: true } },
      },
    });

    // ★ Phase 4-G G-2: MR 미산출 그룹에 대한 서버측 이중 방어
    //   Step 1 UI 가드가 우회되거나 (직접 액션 호출 / 상태 stale) status는
    //   IN_PROGRESS/COMPLETED 이지만 MR이 없는 이례 상황을 명확한 에러로 처리.
    if (mrs.length === 0) {
      return handleActionError(
        new Error("MR_NOT_GENERATED"),
        "선택한 식단 그룹에 자재 소요량이 산출되지 않았습니다. 식단 화면에서 그룹을 진행중 상태로 전환한 후 다시 시도해주세요.",
      );
    }

    const result = await buildPOItemsFromMR({
      companyId: session.companyId,
      // ★ Phase 4-C2 (UI): lineupId/lineupName 평탄화 후 전달
      materialRequirements: mrs.map((mr) => ({
        id: mr.id,
        materialMasterId: mr.materialMasterId,
        productionLineId: mr.productionLineId,
        locationId: mr.locationId,
        requiredQty: mr.requiredQty,
        unit: mr.unit,
        lineupId: mr.lineupId,
        lineupName: mr.lineup?.name ?? null,
      })),
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

    // ★ D19: MaterialMaster.defaultSupplierItemId 변경 감사 로그
    if (result.defaultSupplierUpdates && result.defaultSupplierUpdates.length > 0) {
      for (const upd of result.defaultSupplierUpdates) {
        await createAuditLog({
          session,
          action: "UPDATE",
          entityType: "MaterialMaster",
          entityId: upd.materialMasterId,
          after: {
            defaultSupplierItemId: upd.supplierItemId,
            reason: "D19 default 자동/사용자동의 설정 (위저드 배치)",
          } as unknown as Record<string, unknown>,
        });
      }
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
      REPLACE_BLOCKED_BY_LOCKED_PO:
        "결재 승인 이상 상태의 PO가 포함되어 덮어쓸 수 없습니다. 차분 발주(DELTA)로 진행하거나 해당 PO를 먼저 취소하세요",
      REPLACE_MISSING_BASED_ON_POS:
        "덮어쓰기 대상 발주서가 지정되지 않았습니다",
      // ★ R1-b3
      DELTA_BLOCKED_BY_APPROVED_PO:
        "결재 승인 이상 상태의 PO가 포함되어 변경할 수 없습니다. 부족분은 신규 발주로, 오배송·과다는 재고 실사로 처리하세요",
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

// ============================================================
// ★ R1-b3: DELTA 프리뷰 — DB 부수효과 없음
// ============================================================
//
// Step 2 (자동 산출 직후) 및 Step 5 (확정 직전) 에서 호출.
// 동일 식단그룹의 기존 PO 와 위저드 후보를 받아 차분 계산 결과만 반환한다.
// 호출 시 DB 변경 일절 없음 — 트랜잭션·로그 적층 모두 executeDeltaMode 의 책임.
//
// 입력 candidate items 의 출처:
//   Step 2 → loadPOWizardDataAction 의 mapped + mappedPartialStock
//   Step 5 → 사용자 편집이 반영된 state.mapped + state.mappedPartialStock

import type { POAdjustmentAction as POAdjActionEnum } from "@prisma/client";

export interface DeltaPreviewItemChange {
  /** 행 유형 */
  kind: "UPDATE_QUANTITY" | "UPDATE_UNIT_PRICE" | "UPDATE_BOTH" | "ADD" | "UNCHANGED";
  /** 영향 PO id (UPDATE/ADD 의 기존 PO 부착) — newGroup 이면 null */
  purchaseOrderId: string | null;
  /** PO 번호 — newGroup 이면 null */
  purchaseOrderNumber: string | null;
  /** 표시용 자재명 */
  materialMasterId: string;
  materialName: string;
  materialCode: string;
  /** 자재별 공장/라인 */
  locationId: string;
  locationName: string;
  productionLineId: string | null;
  productionLineName: string | null;
  /** 공급사 */
  supplierId: string;
  supplierName: string;
  /** 수량 차이 (박스) — UNCHANGED/UPDATE_UNIT_PRICE 면 0 */
  beforeQuantity: number | null;
  afterQuantity: number;
  deltaQuantity: number;
  /** 단가 (변경 있을 때만 의미) */
  beforeUnitPrice: number | null;
  afterUnitPrice: number;
  unitPriceChanged: boolean;
  /** 금액 영향 (afterQty × afterPrice − beforeQty × beforePrice). ADD 는 +afterQty × afterPrice */
  amountDelta: number;
}

export interface DeltaPreviewNewGroup {
  /** 새 그룹의 식별 (supplier × location × line) — 표시용 */
  supplierId: string;
  supplierName: string;
  locationId: string;
  locationName: string;
  productionLineId: string | null;
  productionLineName: string | null;
  items: Array<{
    materialMasterId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  /** 그룹 총 금액 */
  groupAmount: number;
}

export interface PreviewDeltaPlanResult {
  /** 기존 PO 갱신·추가 행 (UPDATE_*, ADD, UNCHANGED) */
  itemChanges: DeltaPreviewItemChange[];
  /** 매칭되는 기존 PO 가 없는 신규 그룹 (새 PO 로 생성될 그룹) */
  newGroups: DeltaPreviewNewGroup[];
  /** 요약 카운트 + 합계 차액 */
  summary: {
    increased: number;
    decreased: number;
    priceChanged: number;
    added: number;       // additions + newGroups item count 합
    unchanged: number;
    totalDeltaAmount: number;
  };
  /** APPROVED+ 가 섞여 있어 실제 실행은 차단되는 경우 — preview 만 보여주고 실행은 불가 */
  blocked: {
    hasApprovedOrLocked: boolean;
    lockedPOIds: string[];
  };
}

/** previewDeltaPlanAction 입력 — Step 2/5 위저드에서 산출된 candidate */
export interface PreviewDeltaPlanInput {
  mealPlanGroupId: string;
  basedOnPOIds: string[];
  candidates: Array<{
    materialMasterId: string;
    locationId: string;
    productionLineId: string | null;
    supplierId: string;
    supplierItemId: string;
    quantity: number;
    unitPrice: number;
    netRequiredG?: number | null;
  }>;
}

export async function previewDeltaPlanAction(
  input: PreviewDeltaPlanInput,
): Promise<ActionResult<PreviewDeltaPlanResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "READ");

    if (input.basedOnPOIds.length === 0) {
      // 기존 PO 없으면 모두 newGroups 으로 처리할 수 있도록 빈 배열로 진행
      // (단, 통상 호출자가 DELTA 모드에서만 호출하므로 거의 도달 안 함)
    }

    const { prisma } = await import("@/lib/prisma");
    const { computeDeltaPlan } = await import(
      "@/features/purchase-order/services/po-delta.service"
    );

    // 1) 기존 PO + items + 표시용 관계 일괄 조회
    const existingPOs =
      input.basedOnPOIds.length > 0
        ? await prisma.purchaseOrder.findMany({
            where: {
              id: { in: input.basedOnPOIds },
              companyId: session.companyId,
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              supplierId: true,
              locationId: true,
              productionLineId: true,
              supplier: { select: { name: true } },
              location: { select: { name: true } },
              productionLine: { select: { name: true } },
              items: {
                select: {
                  id: true,
                  materialMasterId: true,
                  supplierItemId: true,
                  quantity: true,
                  unitPrice: true,
                  systemQuantity: true,
                  materialMaster: { select: { name: true, code: true } },
                },
              },
            },
          })
        : [];

    const lockedPOIds = existingPOs
      .filter((po) => po.status !== "DRAFT" && po.status !== "SUBMITTED")
      .map((po) => po.id);
    const hasApprovedOrLocked = lockedPOIds.length > 0;

    // 2) 표시용 마스터 일괄 조회 (자재명·공급사명·공장명·라인명)
    //    candidates 측의 ID 들과 newGroups 표시용
    const candMaterialIds = Array.from(
      new Set(input.candidates.map((c) => c.materialMasterId)),
    );
    const candSupplierIds = Array.from(
      new Set(input.candidates.map((c) => c.supplierId)),
    );
    const candLocationIds = Array.from(
      new Set(input.candidates.map((c) => c.locationId)),
    );
    const candLineIds = Array.from(
      new Set(
        input.candidates
          .map((c) => c.productionLineId)
          .filter((v): v is string => !!v),
      ),
    );

    const [matMap, supMap, locMap, lineMap] = await Promise.all([
      prisma.materialMaster
        .findMany({
          where: {
            id: { in: candMaterialIds },
            companyId: session.companyId,
          },
          select: { id: true, name: true, code: true },
        })
        .then((rows) => new Map(rows.map((r) => [r.id, r]))),
      prisma.supplier
        .findMany({
          where: { id: { in: candSupplierIds }, companyId: session.companyId },
          select: { id: true, name: true },
        })
        .then((rows) => new Map(rows.map((r) => [r.id, r.name]))),
      prisma.location
        .findMany({
          where: { id: { in: candLocationIds }, companyId: session.companyId },
          select: { id: true, name: true },
        })
        .then((rows) => new Map(rows.map((r) => [r.id, r.name]))),
      candLineIds.length === 0
        ? Promise.resolve(new Map<string, string>())
        : prisma.productionLine
            .findMany({
              where: {
                id: { in: candLineIds },
                companyId: session.companyId,
              },
              select: { id: true, name: true },
            })
            .then((rows) => new Map(rows.map((r) => [r.id, r.name]))),
    ]);

    // 3) computeDeltaPlan 입력 구성 (MATERIAL 행만 — 위저드 본 흐름과 일치)
    const existingItems: ExistingPOItemForDelta[] = [];
    for (const po of existingPOs) {
      if (po.status !== "DRAFT" && po.status !== "SUBMITTED") continue;
      for (const it of po.items) {
        if (!it.materialMasterId) continue;
        existingItems.push({
          purchaseOrderId: po.id,
          purchaseOrderStatus: po.status as "DRAFT" | "SUBMITTED",
          purchaseOrderItemId: it.id,
          materialMasterId: it.materialMasterId,
          locationId: po.locationId,
          productionLineId: po.productionLineId,
          supplierId: po.supplierId,
          supplierItemId: it.supplierItemId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          systemQuantity: it.systemQuantity,
        });
      }
    }

    const newCandidates: NewItemForDelta[] = input.candidates.map((c) => ({
      materialMasterId: c.materialMasterId,
      locationId: c.locationId,
      productionLineId: c.productionLineId,
      supplierId: c.supplierId,
      supplierItemId: c.supplierItemId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      netRequiredG: c.netRequiredG ?? null,
    }));

    const plan = computeDeltaPlan({ existingItems, newCandidates });

    // 4) PO id → (orderNumber, supplier·location·line 표시명) 매핑
    const poDisplayMap = new Map(
      existingPOs.map((po) => [
        po.id,
        {
          orderNumber: po.orderNumber,
          supplierName: po.supplier.name,
          locationName: po.location.name,
          productionLineName: po.productionLine?.name ?? null,
        },
      ]),
    );
    // PO id → item id → 자재명 (UPDATE 행에서 사용)
    const poItemDisplayMap = new Map<
      string,
      Map<string, { materialName: string; materialCode: string }>
    >();
    for (const po of existingPOs) {
      const m = new Map<string, { materialName: string; materialCode: string }>();
      for (const it of po.items) {
        m.set(it.id, {
          materialName: it.materialMaster?.name ?? "(자재명 없음)",
          materialCode: it.materialMaster?.code ?? "-",
        });
      }
      poItemDisplayMap.set(po.id, m);
    }

    // 5) itemChanges 변환
    const itemChanges: DeltaPreviewItemChange[] = [];

    for (const u of plan.updates) {
      const poDisp = poDisplayMap.get(u.purchaseOrderId);
      const itemDisp = poItemDisplayMap
        .get(u.purchaseOrderId)
        ?.get(u.purchaseOrderItemId);
      const kind: DeltaPreviewItemChange["kind"] =
        u.quantityReason && u.priceReason
          ? "UPDATE_BOTH"
          : u.quantityReason
            ? "UPDATE_QUANTITY"
            : "UPDATE_UNIT_PRICE";
      itemChanges.push({
        kind,
        purchaseOrderId: u.purchaseOrderId,
        purchaseOrderNumber: poDisp?.orderNumber ?? null,
        materialMasterId: existingItemMaterialId(existingItems, u.purchaseOrderItemId),
        materialName: itemDisp?.materialName ?? "(자재명 없음)",
        materialCode: itemDisp?.materialCode ?? "-",
        locationId: poLocationId(existingPOs, u.purchaseOrderId),
        locationName: poDisp?.locationName ?? "",
        productionLineId: poLineId(existingPOs, u.purchaseOrderId),
        productionLineName: poDisp?.productionLineName ?? null,
        supplierId: poSupplierId(existingPOs, u.purchaseOrderId),
        supplierName: poDisp?.supplierName ?? "",
        beforeQuantity: u.beforeQuantity,
        afterQuantity: u.afterQuantity,
        deltaQuantity: u.deltaQuantity,
        beforeUnitPrice: u.beforeUnitPrice,
        afterUnitPrice: u.afterUnitPrice,
        unitPriceChanged: u.unitPriceChanged,
        amountDelta: Math.round(
          u.afterQuantity * u.afterUnitPrice -
            u.beforeQuantity * u.beforeUnitPrice,
        ),
      });
    }

    for (const a of plan.additions) {
      const poDisp = poDisplayMap.get(a.purchaseOrderId);
      const mat = matMap.get(a.candidate.materialMasterId);
      itemChanges.push({
        kind: "ADD",
        purchaseOrderId: a.purchaseOrderId,
        purchaseOrderNumber: poDisp?.orderNumber ?? null,
        materialMasterId: a.candidate.materialMasterId,
        materialName: mat?.name ?? "(자재명 없음)",
        materialCode: mat?.code ?? "-",
        locationId: a.candidate.locationId,
        locationName:
          locMap.get(a.candidate.locationId) ?? poDisp?.locationName ?? "",
        productionLineId: a.candidate.productionLineId,
        productionLineName: a.candidate.productionLineId
          ? lineMap.get(a.candidate.productionLineId) ?? null
          : null,
        supplierId: a.candidate.supplierId,
        supplierName:
          supMap.get(a.candidate.supplierId) ?? poDisp?.supplierName ?? "",
        beforeQuantity: null,
        afterQuantity: a.candidate.quantity,
        deltaQuantity: a.candidate.quantity,
        beforeUnitPrice: null,
        afterUnitPrice: a.candidate.unitPrice,
        unitPriceChanged: false,
        amountDelta: Math.round(a.candidate.quantity * a.candidate.unitPrice),
      });
    }

    for (const un of plan.unchanged) {
      const poDisp = poDisplayMap.get(un.purchaseOrderId);
      const itemDisp = poItemDisplayMap
        .get(un.purchaseOrderId)
        ?.get(un.purchaseOrderItemId);
      itemChanges.push({
        kind: "UNCHANGED",
        purchaseOrderId: un.purchaseOrderId,
        purchaseOrderNumber: poDisp?.orderNumber ?? null,
        materialMasterId: un.candidate.materialMasterId,
        materialName: itemDisp?.materialName ?? "(자재명 없음)",
        materialCode: itemDisp?.materialCode ?? "-",
        locationId: un.candidate.locationId,
        locationName: poDisp?.locationName ?? "",
        productionLineId: un.candidate.productionLineId,
        productionLineName: poDisp?.productionLineName ?? null,
        supplierId: un.candidate.supplierId,
        supplierName: poDisp?.supplierName ?? "",
        beforeQuantity: un.candidate.quantity,
        afterQuantity: un.candidate.quantity,
        deltaQuantity: 0,
        beforeUnitPrice: un.candidate.unitPrice,
        afterUnitPrice: un.candidate.unitPrice,
        unitPriceChanged: false,
        amountDelta: 0,
      });
    }

    // 6) newGroups → 그룹키별로 묶어서 표시용 변환
    const newGroupsMap = new Map<
      string,
      DeltaPreviewNewGroup
    >();
    for (const ng of plan.newGroups) {
      const key = `${ng.candidate.supplierId}|${ng.candidate.locationId}|${ng.candidate.productionLineId ?? "_"}`;
      let entry = newGroupsMap.get(key);
      if (!entry) {
        entry = {
          supplierId: ng.candidate.supplierId,
          supplierName: supMap.get(ng.candidate.supplierId) ?? "",
          locationId: ng.candidate.locationId,
          locationName: locMap.get(ng.candidate.locationId) ?? "",
          productionLineId: ng.candidate.productionLineId,
          productionLineName: ng.candidate.productionLineId
            ? lineMap.get(ng.candidate.productionLineId) ?? null
            : null,
          items: [],
          groupAmount: 0,
        };
        newGroupsMap.set(key, entry);
      }
      const mat = matMap.get(ng.candidate.materialMasterId);
      const amount = Math.round(ng.candidate.quantity * ng.candidate.unitPrice);
      entry.items.push({
        materialMasterId: ng.candidate.materialMasterId,
        materialName: mat?.name ?? "(자재명 없음)",
        materialCode: mat?.code ?? "-",
        quantity: ng.candidate.quantity,
        unitPrice: ng.candidate.unitPrice,
        amount,
      });
      entry.groupAmount += amount;
    }

    return actionOk({
      itemChanges,
      newGroups: Array.from(newGroupsMap.values()),
      summary: {
        increased: plan.summary.increased,
        decreased: plan.summary.decreased,
        priceChanged: plan.summary.priceChanged,
        added: plan.summary.added,
        unchanged: plan.summary.unchanged,
        totalDeltaAmount: plan.summary.totalDeltaAmount,
      },
      blocked: { hasApprovedOrLocked, lockedPOIds },
    });
  } catch (error) {
    return handleActionError(error, "차분 프리뷰 산출에 실패했습니다");
  }
}

// ── 내부 헬퍼 (UPDATE 행에서 기존 PO/Item 의 부속 정보 조회) ──
function existingItemMaterialId(
  existingItems: Array<{ purchaseOrderItemId: string; materialMasterId: string }>,
  itemId: string,
): string {
  return existingItems.find((i) => i.purchaseOrderItemId === itemId)
    ?.materialMasterId ?? "";
}
function poLocationId(
  existingPOs: Array<{ id: string; locationId: string }>,
  poId: string,
): string {
  return existingPOs.find((p) => p.id === poId)?.locationId ?? "";
}
function poLineId(
  existingPOs: Array<{ id: string; productionLineId: string | null }>,
  poId: string,
): string | null {
  return existingPOs.find((p) => p.id === poId)?.productionLineId ?? null;
}
function poSupplierId(
  existingPOs: Array<{ id: string; supplierId: string }>,
  poId: string,
): string {
  return existingPOs.find((p) => p.id === poId)?.supplierId ?? "";
}
// POAdjustmentAction 은 직접 사용 안 하지만, kind enum 의 의도(액션 매핑) 표현용
type _UnusedPOAdj = POAdjActionEnum;