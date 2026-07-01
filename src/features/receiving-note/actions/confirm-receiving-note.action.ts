"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
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
 * 서비스가 단일 트랜잭션 안에서 다음을 수행한다:
 *   1) ReceivingNote → CONFIRMED (confirmedAt / confirmedByUserId 기록)
 *   2) InventoryLot / InventoryTransaction 생성 (P9: PO 단가 고정)
 *   3) PurchaseOrderItem.receivedQty 누적
 *   4) ReceivingDiscrepancy 스냅샷 (수량/단가/누락)
 *   5) PurchaseOrder → RECEIVED 자동 전이 (P5 재정정 2026-06-30)
 *
 * 도메인 에러 → ActionFailure 매핑 (RECEIVING_INVENTORY_POLICY §5, §6):
 *   - ReceivingNoteNotFoundError            → NOT_FOUND
 *   - ReceivingNoteAlreadyConfirmedError    → ALREADY_CONFIRMED
 *   - ReceivingNoteCompanyMismatchError     → FORBIDDEN (공용 매핑 사용)
 *   - UnsupportedSubsidiaryReceivingError   → UNSUPPORTED_SUBSIDIARY
 */
export async function confirmReceivingNoteAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<ConfirmReceivingNoteResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "UPDATE");

    const { receivingNoteId } = confirmReceivingNoteSchema.parse(rawInput);

    let updated: Awaited<ReturnType<typeof confirmReceivingNote>>;
    try {
      updated = await confirmReceivingNote(
        session.companyId,
        receivingNoteId,
        session.userId,
      );
    } catch (err) {
      // 서비스 계층 커스텀 에러를 handleActionError 매핑 규약(error.message === key)에 맞춰 재던짐.
      // 서비스 테스트는 클래스 그대로 검증하므로 서비스 코드 변경 없음.
      if (err instanceof ReceivingNoteNotFoundError) throw new Error("NOT_FOUND");
      if (err instanceof ReceivingNoteAlreadyConfirmedError) throw new Error("ALREADY_CONFIRMED");
      if (err instanceof ReceivingNoteCompanyMismatchError) throw new Error("FORBIDDEN");
      if (err instanceof UnsupportedSubsidiaryReceivingError) throw new Error("UNSUPPORTED_SUBSIDIARY");
      throw err;
    }

    // 감사 로그 (실패해도 결과에 영향 없음)
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "ReceivingNote",
      entityId: updated.id,
      after: { status: "CONFIRMED" } as unknown as Record<string, unknown>,
    });

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
