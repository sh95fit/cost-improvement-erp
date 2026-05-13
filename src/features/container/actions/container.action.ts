// src/features/container/actions/container.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createContainerSlotSchema,
  updateContainerSlotSchema,
} from "../schemas/container.schema";
import * as containerService from "../services/container.service";

// ════════════════════════════════════════
// 용기(SubsidiaryMaster type=CONTAINER) 조회
// ════════════════════════════════════════

export async function getContainerGroupsAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof containerService.getContainerSubsidiaries>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const query = {
      page: Number(rawQuery.page) || 1,
      limit: Number(rawQuery.limit) || 20,
      search: rawQuery.search as string | undefined,
      sortBy: (rawQuery.sortBy as string) || "name",
      sortOrder: (rawQuery.sortOrder as string) || "asc",
    };
    const result = await containerService.getContainerSubsidiaries(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "용기 목록 조회에 실패했습니다");
  }
}

export async function getContainerGroupByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof containerService.getContainerSubsidiaryById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const group = await containerService.getContainerSubsidiaryById(session.companyId, id);
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "용기 조회에 실패했습니다", {
      NOT_FOUND: "용기를 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// 의존성 확인
// ════════════════════════════════════════

export async function checkContainerGroupDependencyAction(
  id: string
): Promise<ActionResult<{ hasDependency: boolean; details: string[] }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const result = await containerService.checkContainerDependency(id);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "의존성 확인에 실패했습니다");
  }
}

// ════════════════════════════════════════
// ContainerSlot
// ════════════════════════════════════════

export async function addContainerSlotAction(
  subsidiaryMasterId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createContainerSlotSchema.parse(rawInput);
    const slot = await containerService.addContainerSlot(subsidiaryMasterId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ContainerSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 추가에 실패했습니다");
  }
}

export async function updateContainerSlotAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateContainerSlotSchema.parse(rawInput);
    const slot = await containerService.updateContainerSlot(id, input);
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 수정에 실패했습니다");
  }
}

export async function deleteContainerSlotAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await containerService.deleteContainerSlot(id);
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "슬롯 삭제에 실패했습니다");
  }
}

export const getSubsidiariesAction = getContainerGroupsAction;
export const getSlotsBySubsidiaryIdAction = getContainerGroupByIdAction;