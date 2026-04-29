"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  createServingSetSchema,
  updateServingSetStatusSchema,
  createServingSetItemSchema,
  updateServingSetItemSchema,
  updateBaseWeightSchema,
} from "../schemas/recipe.schema";
import * as servingSetService from "../services/serving-set.service";

// ── ServingSet 목록 조회 ──
export async function getServingSetsByVariantAction(
  recipeVariantId: string
): Promise<ActionResult<Awaited<ReturnType<typeof servingSetService.getServingSetsByVariant>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const sets = await servingSetService.getServingSetsByVariant(
      session.companyId,
      recipeVariantId
    );
    return actionOk(sets);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 세트 조회에 실패했습니다");
  }
}

// ── ServingSet 자동 버전 생성 ──
export async function createServingSetWithAutoVersionAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "CREATE");

    const input = createServingSetSchema.parse(rawInput);
    const nextVersion = await servingSetService.getNextServingSetVersion(
      session.companyId,
      input.recipeVariantId
    );

    const set = await servingSetService.createServingSet(session.companyId, {
      ...input,
      version: nextVersion,
    });

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ServingSet",
      entityId: set.id,
      after: set as unknown as Record<string, unknown>,
    });

    return actionOk(set);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 세트 생성에 실패했습니다");
  }
}

// ── ServingSet 상태 변경 ──
export async function updateServingSetStatusAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = updateServingSetStatusSchema.parse(rawInput);
    const set = await servingSetService.updateServingSetStatus(
      session.companyId,
      id,
      input
    );

    await createAuditLog({
      session,
      action: "STATUS_CHANGE",
      entityType: "ServingSet",
      entityId: set.id,
      after: { status: set.status } as unknown as Record<string, unknown>,
    });

    return actionOk(set);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
      if (error.message === "NOT_FOUND") return actionFail("NOT_FOUND", "서빙 중량 세트를 찾을 수 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 세트 상태 변경에 실패했습니다");
  }
}

// ── ServingSet 삭제 ──
export async function deleteServingSetAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");

    const existing = await servingSetService.getServingSetById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "서빙 중량 세트를 찾을 수 없습니다");
    }

    await servingSetService.deleteServingSet(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "ServingSet",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 세트 삭제에 실패했습니다");
  }
}

// ── ServingSetItem 추가 ──
export async function addServingSetItemAction(
  servingSetId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = createServingSetItemSchema.parse(rawInput);
    const item = await servingSetService.addServingSetItem(servingSetId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ServingSetItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });

    return actionOk(item);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 항목 추가에 실패했습니다");
  }
}

// ── ServingSetItem 수정 ──
export async function updateServingSetItemAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = updateServingSetItemSchema.parse(rawInput);
    const item = await servingSetService.updateServingSetItem(id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "ServingSetItem",
      entityId: item.id,
      after: item as unknown as Record<string, unknown>,
    });

    return actionOk(item);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 수정에 실패했습니다");
  }
}

// ── ServingSetItem 삭제 ──
export async function deleteServingSetItemAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "DELETE");

    await servingSetService.deleteServingSetItem(id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "ServingSetItem",
      entityId: id,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "서빙 중량 항목 삭제에 실패했습니다");
  }
}

// ── RecipeVariant 기준 중량 수정 ──
export async function updateBaseWeightAction(
  variantId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "UPDATE");

    const input = updateBaseWeightSchema.parse(rawInput);
    const variant = await servingSetService.updateVariantBaseWeight(
      variantId,
      input.baseWeightG
    );

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "RecipeVariant",
      entityId: variantId,
      after: { baseWeightG: variant.baseWeightG } as unknown as Record<string, unknown>,
    });

    return actionOk(variant);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "기준 중량 수정에 실패했습니다");
  }
}

// ── 용기 그룹 목록 조회 (서빙 중량 설정 시 선택용) ──
export async function getContainerGroupsAction(): Promise<
  ActionResult<{ id: string; name: string; code: string; slots: { slotIndex: number; label: string }[] }[]>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "recipe", "READ");

    const { prisma } = await import("@/lib/prisma");
    const groups = await prisma.containerGroup.findMany({
      where: { companyId: session.companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        slots: {
          select: { slotIndex: true, label: true },
          orderBy: { slotIndex: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return actionOk(groups);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "용기 그룹 조회에 실패했습니다");
  }
}
