"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { bulkConfirmReceivingNotesSchema } from "../schemas/receiving-note.schema";
import {
  bulkConfirmReceivingNotes,
  BulkConfirmValidationError,
  BulkConfirmExecutionError,
} from "../services/daily-receiving.service";

// ════════════════════════════════════════
// D30 Ex1: 일괄 확정 실행 Server Action (All-or-Nothing)
// ════════════════════════════════════════

export type BulkConfirmResultRow = {
  receivingNoteId: string;
  status: "CONFIRMED";
};

/**
 * 여러 ReceivingNote 를 한 트랜잭션 안에서 순차 확정.
 * 하나라도 실패하면 전체 롤백 (Q4 정책).
 *
 * 흐름:
 *  1) 세션·권한(UPDATE) 확인
 *  2) 각 노트의 PO locationId 를 미리 로드해 스코프 일괄 검증
 *  3) 서비스 호출 → 실패 시 BulkConfirmValidationError / BulkConfirmExecutionError 매핑
 *  4) 성공한 노트마다 UPDATE 감사로그 1건 (정책 B, 기존 confirm 액션과 동일)
 *  5) revalidatePath: /receiving/daily, /receiving, /receiving/pending,
 *     노트/PO 상세 각각
 */
export async function bulkConfirmReceivingNotesAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<BulkConfirmResultRow[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "UPDATE");

    const input = bulkConfirmReceivingNotesSchema.parse(rawInput);

    // 각 노트의 PO locationId 로드 → 스코프 일괄 검증
    const notes = await prisma.receivingNote.findMany({
      where: {
        id: { in: input.receivingNoteIds },
        companyId: session.companyId,
      },
      select: {
        id: true,
        purchaseOrder: { select: { id: true, locationId: true } },
      },
    });
    if (notes.length !== input.receivingNoteIds.length) {
      throw new Error("NOT_FOUND");
    }
    for (const n of notes) {
      assertScope(session, "LOCATION", n.purchaseOrder.locationId);
    }

    let results: BulkConfirmResultRow[];
    try {
      results = await bulkConfirmReceivingNotes(
        session.companyId,
        input.receivingNoteIds,
        session.userId,
        {
          discrepancyReasonsMap: input.discrepancyReasonsMap,
          unifiedReasonMap: input.unifiedReasonMap,
          noteMap: input.noteMap,
        },
      );
    } catch (err) {
      if (err instanceof BulkConfirmValidationError) {
        // 사전 검증 단계 실패 — 상세 사유를 오류 메시지에 담아 전달
        const summary = err.failures
          .map((f) => `${f.receivingNoteId}: ${f.reason}`)
          .join(" / ");
        throw new Error(`VALIDATION_FAILED: ${summary}`);
      }
      if (err instanceof BulkConfirmExecutionError) {
        throw new Error(
          `EXECUTION_FAILED: 노트 ${err.failedNoteId} 확정 중 실패, 전체 롤백됨`,
        );
      }
      throw err;
    }

    // 감사로그 (정책 B: 노트마다 1건, 기존 confirm 액션과 동일)
    for (const row of results) {
      await createAuditLog({
        session,
        action: "UPDATE",
        entityType: "ReceivingNote",
        entityId: row.receivingNoteId,
        after: {
          status: "CONFIRMED",
          source: "BULK_CONFIRM",
        } as unknown as Record<string, unknown>,
      });
    }

    // 관련 페이지 캐시 무효화
    revalidatePath("/receiving/daily");
    revalidatePath("/receiving");
    revalidatePath("/receiving/pending");
    for (const n of notes) {
      revalidatePath(`/receiving/notes/${n.id}`);
      revalidatePath(`/purchase-orders/${n.purchaseOrder.id}`);
    }

    return actionOk(results);
  } catch (error) {
    return handleActionError(error, "일괄 확정에 실패했습니다", {
      NOT_FOUND: "입고서를 찾을 수 없습니다",
    });
  }
}
