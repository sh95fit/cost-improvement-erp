// src/features/purchase-order/actions/bulk-transition-po-status.action.ts
"use server";

import { z } from "zod";
import { POStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  canTransitionPOStatus,
  PO_STATUS_LABELS,
} from "../schemas/purchase-order.schema";
import * as purchaseOrderService from "../services/purchase-order.service";

// ════════════════════════════════════════
// Phase 4-F-1: 발주 일괄 상태 전이
// ════════════════════════════════════════

const bulkTransitionInputSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "1건 이상 선택하세요").max(200, "한 번에 최대 200건까지 처리할 수 있습니다"),
  // Phase 4-F-1 범위: 일괄 액션 허용 대상은 SUBMITTED(발주 확정) / CANCELLED(취소) 만.
  // RECEIVED 는 입고서 확정 시 단일 트랜잭션 내 자동 전이로만 도달 (P5 재정정 2026-06-30).
  // APPROVED 는 결재 도입 전까지 단건 처리만 허용.
  toStatus: z.enum([POStatus.SUBMITTED, POStatus.CANCELLED]),
  cancelReason: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.toStatus === "CANCELLED" && !data.cancelReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["cancelReason"],
      message: "CANCELLED 전이 시 취소 사유는 필수입니다",
    });
  }
});

export type BulkTransitionInput = z.infer<typeof bulkTransitionInputSchema>;

export type BulkTransitionFailure = {
  id: string;
  code: "NOT_FOUND" | "INVALID_TRANSITION" | "UNKNOWN";
  message: string;
};

export type BulkTransitionResult = {
  successCount: number;
  skippedCount: number;
  failedCount: number;
  failures: BulkTransitionFailure[];
  successIds: string[];
};

/**
 * 발주 일괄 상태 전이.
 *
 * 정책:
 *   - 이미 toStatus 인 PO 는 skip (skippedCount 에 집계, 실패 아님).
 *   - 전이 매트릭스 위반 시 INVALID_TRANSITION 으로 집계.
 *   - 하나라도 실패하면 전체 롤백 (트랜잭션).
 *   - 단가 이력 적층(P9') 은 단건 transitionPurchaseOrderStatus 가 자동 위임 처리.
 *   - 감사 로그는 성공 건에 대해서만 적층.
 *
 * 사용 예:
 *   - DRAFT → SUBMITTED 일괄 (선택 발주 확정)
 *   - DRAFT → SUBMITTED 일괄 (선택 발주 확정)
 *   - * → CANCELLED 일괄 (선택 취소, cancelReason 필수)
 *
 * 제외 (P5 재정정 2026-06-30):
 *   - SUBMITTED → RECEIVED 는 ReceivingNoteService.confirm 단일 트랜잭션 내에서만 도달
 *   - APPROVED 전이는 결재 도입 전까지 단건만 허용
 *   - * → CANCELLED 일괄 (선택 취소)
 */
export async function bulkTransitionPOStatusAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<BulkTransitionResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "purchase-order", "UPDATE");

    const { ids, toStatus, cancelReason } = bulkTransitionInputSchema.parse(rawInput);

    // 트랜잭션 안에서 단건 transition 함수를 순회 호출.
    // 실패가 있으면 throw BulkAggregateError → catch 에서 결과만 추출해 반환.
    let aggregateResult: BulkTransitionResult | null = null;

    try {
      aggregateResult = await prisma.$transaction(async (tx) => {
        const targets = await tx.purchaseOrder.findMany({
          where: { id: { in: ids }, companyId: session.companyId },
          select: { id: true, status: true },
        });
        const foundMap = new Map(targets.map((p) => [p.id, p]));

        const failures: BulkTransitionFailure[] = [];
        const successIds: string[] = [];
        let skippedCount = 0;

        for (const id of ids) {
          const target = foundMap.get(id);

          if (!target) {
            failures.push({
              id,
              code: "NOT_FOUND",
              message: "발주서를 찾을 수 없습니다.",
            });
            continue;
          }

          if (target.status === toStatus) {
            skippedCount++;
            continue;
          }

          if (!canTransitionPOStatus(target.status, toStatus)) {
            failures.push({
              id,
              code: "INVALID_TRANSITION",
              message: `${PO_STATUS_LABELS[target.status]} → ${PO_STATUS_LABELS[toStatus]} 전이는 허용되지 않습니다.`,
            });
            continue;
          }

          try {
            await purchaseOrderService.transitionPurchaseOrderStatus(
              session.companyId,
              id,
              {
                toStatus,
                actorUserId: session.userId,
                cancelReason,
              },
            );
            successIds.push(id);
          } catch (err) {
            failures.push({
              id,
              code: "UNKNOWN",
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (failures.length > 0) {
          // 부분 실패 시 전체 롤백 — 결과는 throw 로 catch 에 전달
          throw new BulkAggregateError({
            successCount: successIds.length,
            skippedCount,
            failedCount: failures.length,
            failures,
            successIds,
          });
        }

        return {
          successCount: successIds.length,
          skippedCount,
          failedCount: 0,
          failures: [],
          successIds,
        };
      });
    } catch (err) {
      if (err instanceof BulkAggregateError) {
        // 부분 실패 — 실행 결과를 사용자에게 노출 (롤백된 상태)
        return actionOk(err.result);
      }
      throw err;
    }

    // 전체 성공 — 감사 로그 적층 (트랜잭션 외부, 실패해도 본 결과에 영향 없음)
    if (aggregateResult && aggregateResult.successIds.length > 0) {
      await Promise.allSettled(
        aggregateResult.successIds.map((id) =>
          createAuditLog({
            session,
            action: "UPDATE",
            entityType: "PurchaseOrder",
            entityId: id,
            after: { status: toStatus, bulk: true } as unknown as Record<string, unknown>,
          }),
        ),
      );
    }

    return actionOk(aggregateResult!);
  } catch (error) {
    return handleActionError(error, "발주 일괄 상태 변경에 실패했습니다");
  }
}

class BulkAggregateError extends Error {
  result: BulkTransitionResult;
  constructor(result: BulkTransitionResult) {
    super(`BULK_TRANSITION_PARTIAL_FAILURE: ${result.failedCount}건 실패`);
    this.result = result;
  }
}
