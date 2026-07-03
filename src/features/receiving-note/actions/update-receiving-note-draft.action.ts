"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { updateReceivingNoteDraftSchema } from "../schemas/receiving-note.schema";
import {
  updateReceivingNoteDraft,
  ReceivingNoteNotDraftError,
} from "../services/receiving-note.service";

export async function updateReceivingNoteDraftAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<{ id: string; receiveNumber: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "UPDATE");

    const input = updateReceivingNoteDraftSchema.parse(rawInput);

    // 스코프 체크: 노트의 PO locationId
    const noteMeta = await prisma.receivingNote.findFirst({
      where: { id: input.receivingNoteId, companyId: session.companyId },
      select: {
        id: true,
        purchaseOrderId: true,
        purchaseOrder: { select: { locationId: true } },
      },
    });
    if (!noteMeta) throw new Error("NOT_FOUND");
    assertScope(session, "LOCATION", noteMeta.purchaseOrder.locationId);

    let updated: Awaited<ReturnType<typeof updateReceivingNoteDraft>>;
    try {
      updated = await updateReceivingNoteDraft(session.companyId, input);
    } catch (err) {
      if (err instanceof ReceivingNoteNotDraftError) throw new Error("NOT_DRAFT");
      throw err;
    }

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "ReceivingNote",
      entityId: updated.id,
      after: {
        receivedDate: updated.receivedDate,
        note: updated.note,
        itemsCount: updated.items.length,
      } as unknown as Record<string, unknown>,
    });

    revalidatePath("/receiving");
    revalidatePath("/receiving/notes");
    revalidatePath(`/receiving/notes/${updated.id}`);
    revalidatePath(`/purchase-orders/${noteMeta.purchaseOrderId}`);

    return actionOk({ id: updated.id, receiveNumber: updated.receiveNumber });
  } catch (error) {
    return handleActionError(error, "입고서 수정에 실패했습니다", {
      NOT_FOUND: "입고서를 찾을 수 없습니다",
      NOT_DRAFT: "초안(DRAFT) 상태의 입고서만 수정할 수 있습니다",
    });
  }
}
