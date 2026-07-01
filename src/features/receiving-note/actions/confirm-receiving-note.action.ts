"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  confirmReceivingNote,
  ReceivingNoteNotFoundError,
  ReceivingNoteAlreadyConfirmedError,
  ReceivingNoteCompanyMismatchError,
  UnsupportedSubsidiaryReceivingError,
} from "../services/receiving-note.service";
import { confirmReceivingNoteSchema } from "../schemas/receiving-note.schema";

// ════════════════════════════════════════
// D30 C-3-a: 입고서 확정 Server Action
// ════════════════════════════════════════

export type ConfirmReceivingNoteResult = {
  id: string;
  status: "CONFIRMED";
};

/**
 * 입고서 확정 Server Action.
 *
 * 권한 체크 순서 (PROGRESS.md D30 C-3 A2-min):
 *   1) assertPermission(receiving-note, UPDATE)
 *   2) assertScope(LOCATION, po.locationId) — 자기 공장 PO 만 확정 가능
 *
 * 서비스가 단일 트랜잭션 안에서:
 *   1) ReceivingNote → CONFIRMED (confirmedAt / confirmedByUserId 기록)
 *   2) InventoryLot / InventoryTransaction 생성 (P9: PO 단가 고정)
 *   3) PurchaseOrderItem.receivedQty 누적
 *   4) ReceivingDiscrepancy 스냅샷 (수량/단가/누락)
 *   5) PurchaseOrder → RECEIVED 자동 전이 (P5 재정정 2026-06-30)
 *
 * 성공 시 revalidatePath 3곳: 대기 목록, 노트 상세, PO 상세.
 */
export async function confirmReceivingNoteAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<ConfirmReceivingNoteResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "UPDATE");

    const { receivingNoteId } = confirmReceivingNoteSchema.parse(rawInput);

    // 스코프 체크를 위해 노트의 PO locationId 얕게 조회
    const noteMeta = await prisma.receivingNote.findFirst({
      where: { id: receivingNoteId, companyId: session.companyId },
      select: {
        id: true,
        purchaseOrder: { select: { id: true, locationId: true } },
      },
    });
    if (!noteMeta) throw new Error("NOT_FOUND");
    assertScope(session, "LOCATION", noteMeta.purchaseOrder.locationId);

    let updated: Awaited<ReturnType<typeof confirmReceivingNote>>;
    try {
      updated = await confirmReceivingNote(
        session.companyId,
        receivingNoteId,
        session.userId,
      );
    } catch (err) {
      // 서비스 계층 커스텀 에러를 handleActionError 매핑 규약에 맞춰 재던짐.
      if (err instanceof ReceivingNoteNotFoundError) throw new Error("NOT_FOUND");
      if (err instanceof ReceivingNoteAlreadyConfirmedError) throw new Error("ALREADY_CONFIRMED");
      if (err instanceof ReceivingNoteCompanyMismatchError) throw new Error("FORBIDDEN");
      if (err instanceof UnsupportedSubsidiaryReceivingError) throw new Error("UNSUPPORTED_SUBSIDIARY");
      throw err;
    }

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "ReceivingNote",
      entityId: updated.id,
      after: { status: "CONFIRMED" } as unknown as Record<string, unknown>,
    });

    // 관련 페이지 캐시 무효화
    revalidatePath("/receiving/pending");
    revalidatePath(`/receiving/notes/${receivingNoteId}`);
    revalidatePath(`/purchase-orders/${noteMeta.purchaseOrder.id}`);

    return actionOk({ id: updated.id, status: "CONFIRMED" });
  } catch (error) {
    return handleActionError(error, "입고서 확정에 실패했습니다", {
      NOT_FOUND: "입고서를 찾을 수 없습니다",
      ALREADY_CONFIRMED: "이미 확정된 입고서입니다",
      UNSUPPORTED_SUBSIDIARY:
        "부자재 입고 확정은 현재 지원되지 않습니다 (Sprint 4 Phase 10 예정)",
    });
  }
}
