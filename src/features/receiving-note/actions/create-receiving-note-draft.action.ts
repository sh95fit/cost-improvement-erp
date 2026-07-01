"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { createReceivingNoteDraftSchema } from "../schemas/receiving-note.schema";
import {
  createReceivingNoteDraft,
  ReceivingNoteAlreadyExistsError,
  PurchaseOrderNotEligibleForReceivingError,
} from "../services/receiving-note.service";

export async function createReceivingNoteDraftAction(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<{ id: string; receiveNumber: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "receiving-note", "CREATE");

    const input = createReceivingNoteDraftSchema.parse(rawInput);

    // 스코프 체크: PO 의 locationId 확보 후 검증
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId: session.companyId },
      select: { id: true, locationId: true, status: true },
    });
    if (!po) throw new Error("NOT_FOUND");
    assertScope(session, "LOCATION", po.locationId);

    let created: Awaited<ReturnType<typeof createReceivingNoteDraft>>;
    try {
      created = await createReceivingNoteDraft(session.companyId, input);
    } catch (err) {
      if (err instanceof ReceivingNoteAlreadyExistsError) throw new Error("ALREADY_EXISTS");
      if (err instanceof PurchaseOrderNotEligibleForReceivingError) throw new Error("PO_NOT_ELIGIBLE");
      throw err;
    }

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ReceivingNote",
      entityId: created.id,
      after: created as unknown as Record<string, unknown>,
    });

    revalidatePath("/receiving/pending");
    revalidatePath(`/purchase-orders/${input.purchaseOrderId}`);

    return actionOk({ id: created.id, receiveNumber: created.receiveNumber });
  } catch (error) {
    return handleActionError(error, "입고서 생성에 실패했습니다", {
      NOT_FOUND: "발주서를 찾을 수 없습니다",
      ALREADY_EXISTS: "이 발주에 대한 입고서가 이미 존재합니다",
      PO_NOT_ELIGIBLE: "SUBMITTED 상태의 발주만 입고서를 작성할 수 있습니다",
    });
  }
}
