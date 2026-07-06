"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { bulkCreateOrUpdateReceivingNoteDraftsSchema } from "../schemas/receiving-note.schema";
import { bulkCreateOrUpdateReceivingNoteDrafts } from "../services/daily-receiving.service";

// ════════════════════════════════════════
// D30 Ex1: 일괄 초안 저장 Server Action
// ════════════════════════════════════════

export type BulkDraftResultRow = {
  purchaseOrderId: string;
  receivingNoteId: string;
};

/**
 * 여러 PO 에 대해 ReceivingNote(DRAFT) 를 한 번에 생성/갱신.
 *
 * 흐름:
 *  1) 세션·권한(CREATE, UPDATE) 확인
 *  2) 모든 PO 의 locationId 를 미리 조회해 회사 소속·스코프 일괄 검증
 *     (개별 PO 검증은 서비스가 tx 안에서도 수행하지만, 액션 계층에서 미리
 *      스코프 위반을 걸러 tx 진입 자체를 막는다)
 *  3) 서비스 호출 (단일 tx, all-or-nothing)
 *  4) 노트마다 CREATE 또는 UPDATE 감사로그 1건씩 (정책 B)
 *  5) revalidatePath: /receiving/daily, /receiving, /receiving/pending
 */
export async function bulkCreateOrUpdateReceivingNoteDraftsAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<BulkDraftResultRow[]>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "CREATE");
    assertPermission(session, "receiving-note", "UPDATE");

    const { inputs } = bulkCreateOrUpdateReceivingNoteDraftsSchema.parse(
      rawInput,
    );

    // PO 회사 소속·스코프 일괄 검증 (액션 계층 조기 차단)
    const poIds = inputs.map((i) => i.purchaseOrderId);
    const pos = await prisma.purchaseOrder.findMany({
      where: { id: { in: poIds }, companyId: session.companyId },
      select: { id: true, locationId: true },
    });
    const poById = new Map(pos.map((p) => [p.id, p]));
    for (const id of poIds) {
      const po = poById.get(id);
      if (!po) throw new Error("NOT_FOUND");
      assertScope(session, "LOCATION", po.locationId);
    }

    // 사전에 기존 DRAFT 존재 여부 조회 (CREATE vs UPDATE 감사로그 구분용)
    const existingDrafts = await prisma.receivingNote.findMany({
      where: {
        purchaseOrderId: { in: poIds },
        status: "DRAFT",
        companyId: session.companyId,
      },
      select: { purchaseOrderId: true },
    });
    const wasExistingByPO = new Set(
      existingDrafts.map((d) => d.purchaseOrderId),
    );

    // 서비스 호출 (단일 tx)
    const results = await bulkCreateOrUpdateReceivingNoteDrafts(
      session.companyId,
      inputs.map((i) => ({
        purchaseOrderId: i.purchaseOrderId,
        receivedDate: i.receivedDate,
        note: i.note ?? null,
        items: i.items,
      })),
      session.userId,
    );

    // 감사로그 (정책 B: 노트마다 1건)
    for (const row of results) {
      const wasExisting = wasExistingByPO.has(row.purchaseOrderId);
      await createAuditLog({
        session,
        action: wasExisting ? "UPDATE" : "CREATE",
        entityType: "ReceivingNote",
        entityId: row.receivingNoteId,
        after: {
          purchaseOrderId: row.purchaseOrderId,
          status: "DRAFT",
          source: "BULK_UPSERT",
        } as unknown as Record<string, unknown>,
      });
    }

    // 관련 페이지 캐시 무효화
    revalidatePath("/receiving/daily");
    revalidatePath("/receiving");
    revalidatePath("/receiving/pending");
    for (const row of results) {
      revalidatePath(`/purchase-orders/${row.purchaseOrderId}`);
    }

    return actionOk(results);
  } catch (error) {
    return handleActionError(error, "일괄 입고서 저장에 실패했습니다", {
      NOT_FOUND: "발주서를 찾을 수 없습니다",
    });
  }
}
