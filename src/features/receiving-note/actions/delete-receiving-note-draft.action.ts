"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { deleteReceivingNoteDraftSchema } from "../schemas/receiving-note.schema";
import {
  deleteReceivingNoteDraft,
  ReceivingNoteNotDraftError,
} from "../services/receiving-note.service";

export async function deleteReceivingNoteDraftAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<{ id: string; receiveNumber: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "DELETE");

    const { receivingNoteId } = deleteReceivingNoteDraftSchema.parse(rawInput);

    // 스코프 체크
    const noteMeta = await prisma.receivingNote.findFirst({
      where: { id: receivingNoteId, companyId: session.companyId },
      select: {
        id: true,
        receiveNumber: true,
        purchaseOrderId: true,
        purchaseOrder: { select: { locationId: true } },
      },
    });
    if (!noteMeta) throw new Error("NOT_FOUND");
    assertScope(session, "LOCATION", noteMeta.purchaseOrder.locationId);

    let deleted: Awaited<ReturnType<typeof deleteReceivingNoteDraft>>;
    try {
      deleted = await deleteReceivingNoteDraft(session.companyId, receivingNoteId);
    } catch (err) {
      if (err instanceof ReceivingNoteNotDraftError) throw new Error("NOT_DRAFT");
      throw err;
    }

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "ReceivingNote",
      entityId: deleted.id,
      before: {
        receiveNumber: deleted.receiveNumber,
        purchaseOrderId: deleted.purchaseOrderId,
      } as unknown as Record<string, unknown>,
    });

    revalidatePath("/receiving");
    revalidatePath("/receiving/notes");
    revalidatePath(`/purchase-orders/${deleted.purchaseOrderId}`);

    return actionOk({
      id: deleted.id,
      receiveNumber: deleted.receiveNumber,
    });
  } catch (error) {
    return handleActionError(error, "입고서 삭제에 실패했습니다", {
      NOT_FOUND: "입고서를 찾을 수 없습니다",
      NOT_DRAFT: "초안(DRAFT) 상태의 입고서만 삭제할 수 있습니다",
    });
  }
}
