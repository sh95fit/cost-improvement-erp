"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  containerGroupListQuerySchema,
  createContainerGroupSchema,
  updateContainerGroupSchema,
  createContainerSlotSchema,
  updateContainerSlotSchema,
  createContainerAccessorySchema,
  updateContainerAccessorySchema,
} from "../schemas/container.schema";
import * as containerService from "../services/container.service";

// ════════════════════════════════════════
// ContainerGroup
// ════════════════════════════════════════

export async function getContainerGroupsAction(
  rawQuery: Record<string, unknown>
): Promise<
  ActionResult<{
    items: Awaited<ReturnType<typeof containerService.getContainerGroups>>["items"];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const query = containerGroupListQuerySchema.parse(rawQuery);
    const result = await containerService.getContainerGroups(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 조회에 실패했습니다");
  }
}

export async function getContainerGroupByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof containerService.getContainerGroupById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const group = await containerService.getContainerGroupById(session.companyId, id);
    return actionOk(group);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "용기 그룹을 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 조회에 실패했습니다");
  }
}

export async function createContainerGroupAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");
    const input = createContainerGroupSchema.parse(rawInput);
    const group = await containerService.createContainerGroup(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ContainerGroup",
      entityId: group.id,
      after: group as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 생성에 실패했습니다");
  }
}

export async function updateContainerGroupAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = updateContainerGroupSchema.parse(rawInput);
    const group = await containerService.updateContainerGroup(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "ContainerGroup",
      entityId: id,
      after: group as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "용기 그룹을 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 수정에 실패했습니다");
  }
}

export async function deleteContainerGroupAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await containerService.deleteContainerGroup(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "ContainerGroup",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "용기 그룹을 찾을 수 없습니다");
      // ★ 의존성 에러 처리
      if (error.message.startsWith("DEPENDENCY:")) {
        const reason = error.message.replace("DEPENDENCY:", "");
        return actionFail("DEPENDENCY", `삭제할 수 없습니다: ${reason}`);
      }
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 삭제에 실패했습니다");
  }
}

// ★ 신규: 의존성 사전 확인 액션 (UI에서 삭제 전 호출)
export async function checkContainerGroupDependencyAction(
  id: string
): Promise<ActionResult<{ hasDependency: boolean; details: string[] }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");
    const result = await containerService.checkContainerGroupDependency(id);
    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "의존성 확인에 실패했습니다");
  }
}

// ════════════════════════════════════════
// ContainerSlot
// ════════════════════════════════════════

export async function addContainerSlotAction(
  containerGroupId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createContainerSlotSchema.parse(rawInput);
    const slot = await containerService.addContainerSlot(containerGroupId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ContainerSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 추가에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "슬롯 수정에 실패했습니다");
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
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      // ★ 의존성 에러 처리
      if (error.message.startsWith("DEPENDENCY:")) {
        const reason = error.message.replace("DEPENDENCY:", "");
        return actionFail("DEPENDENCY", `삭제할 수 없습니다: ${reason}`);
      }
    }
    return actionFail("INTERNAL_ERROR", "슬롯 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// ContainerAccessory
// ════════════════════════════════════════

export async function addContainerAccessoryAction(
  containerGroupId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");
    const input = createContainerAccessorySchema.parse(rawInput);
    const acc = await containerService.addContainerAccessory(containerGroupId, input);
    return actionOk(acc);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "부속품 추가에 실패했습니다");
  }
}

export async function deleteContainerAccessoryAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");
    await containerService.deleteContainerAccessory(id);
    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "부속품 삭제에 실패했습니다");
  }
}
