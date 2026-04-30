"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { containerGroupListQuerySchema } from "../schemas/container.schema";
import * as containerService from "../services/container.service";

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
      if (error.message === "UNAUTHORIZED")
        return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED")
        return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN")
        return actionFail("FORBIDDEN", "권한이 없습니다");
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
      if (error.message === "UNAUTHORIZED")
        return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN")
        return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND")
        return actionFail("NOT_FOUND", "용기 그룹을 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 조회에 실패했습니다");
  }
}
