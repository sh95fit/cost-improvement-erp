// src/features/meal-plan/actions/meal-plan.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  mealPlanGroupListQuerySchema,
  createMealPlanGroupSchema,
  updateMealPlanGroupSchema,
  createMealPlanSchema,
  updateMealPlanSchema,
  createMealPlanSlotSchema,
  updateMealPlanSlotSchema,
} from "../schemas/meal-plan.schema";
import * as mealPlanService from "../services/meal-plan.service";

// ════════════════════════════════════════
// MealPlanGroup
// ════════════════════════════════════════

export async function getMealPlanGroupsAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof mealPlanService.getMealPlanGroups>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const query = mealPlanGroupListQuerySchema.parse(rawQuery);
    const result = await mealPlanService.getMealPlanGroups(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "식단 그룹 목록 조회에 실패했습니다");
  }
}

export async function getMealPlanGroupByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanGroupById>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const group = await mealPlanService.getMealPlanGroupById(session.companyId, id);
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 조회에 실패했습니다");
  }
}

export async function createMealPlanGroupAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = createMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.createMealPlanGroup(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanGroup",
      entityId: group.id,
      after: group as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 생성에 실패했습니다", {
      P2002: "동일 날짜/라인업의 식단 그룹이 이미 존재합니다",
    });
  }
}

export async function updateMealPlanGroupAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanGroupSchema.parse(rawInput);
    const group = await mealPlanService.updateMealPlanGroup(session.companyId, id, input);
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MealPlanGroup",
      entityId: id,
      after: group as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 그룹 수정에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanGroupAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlanGroup(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlanGroup",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "식단 그룹 삭제에 실패했습니다", {
      NOT_FOUND: "식단 그룹을 찾을 수 없습니다",
    });
  }
}

export async function copyMealPlanGroupAction(
  sourceId: string,
  targetDate: string,
  targetLineupId?: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const group = await mealPlanService.copyMealPlanGroup(
      session.companyId,
      sourceId,
      targetDate,
      targetLineupId
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanGroup",
      entityId: group?.id ?? "",
      after: { copiedFrom: sourceId, targetDate } as unknown as Record<string, unknown>,
    });
    return actionOk(group);
  } catch (error) {
    return handleActionError(error, "식단 복사에 실패했습니다", {
      NOT_FOUND: "원본 식단 그룹을 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// MealPlan
// ════════════════════════════════════════

export async function getMealPlansByGroupAction(
  mealPlanGroupId: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlansByGroup>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const plans = await mealPlanService.getMealPlansByGroup(mealPlanGroupId);
    return actionOk(plans);
  } catch (error) {
    return handleActionError(error, "식단 목록 조회에 실패했습니다");
  }
}

export async function createMealPlanAction(
  mealPlanGroupId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "CREATE");
    const input = createMealPlanSchema.parse(rawInput);
    const plan = await mealPlanService.createMealPlan(mealPlanGroupId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlan",
      entityId: plan.id,
      after: plan as unknown as Record<string, unknown>,
    });
    return actionOk(plan);
  } catch (error) {
    return handleActionError(error, "식단 생성에 실패했습니다");
  }
}

export async function updateMealPlanAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanSchema.parse(rawInput);
    const plan = await mealPlanService.updateMealPlan(id, input);
    return actionOk(plan);
  } catch (error) {
    return handleActionError(error, "식단 수정에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlan(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlan",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "식단 삭제에 실패했습니다", {
      NOT_FOUND: "식단을 찾을 수 없습니다",
    });
  }
}

// ════════════════════════════════════════
// MealPlanSlot
// ════════════════════════════════════════

export async function getMealPlanSlotsAction(
  mealPlanId: string
): Promise<ActionResult<Awaited<ReturnType<typeof mealPlanService.getMealPlanSlots>>>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "READ");
    const slots = await mealPlanService.getMealPlanSlots(mealPlanId);
    return actionOk(slots);
  } catch (error) {
    return handleActionError(error, "슬롯 목록 조회에 실패했습니다");
  }
}

export async function createMealPlanSlotAction(
  mealPlanId: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = createMealPlanSlotSchema.parse(rawInput);
    const slot = await mealPlanService.createMealPlanSlot(mealPlanId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MealPlanSlot",
      entityId: slot.id,
      after: slot as unknown as Record<string, unknown>,
    });
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 추가에 실패했습니다");
  }
}

export async function updateMealPlanSlotAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "UPDATE");
    const input = updateMealPlanSlotSchema.parse(rawInput);
    const slot = await mealPlanService.updateMealPlanSlot(id, input);
    return actionOk(slot);
  } catch (error) {
    return handleActionError(error, "슬롯 수정에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
    });
  }
}

export async function deleteMealPlanSlotAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "mealPlan", "DELETE");
    await mealPlanService.deleteMealPlanSlot(id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MealPlanSlot",
      entityId: id,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "슬롯 삭제에 실패했습니다", {
      NOT_FOUND: "슬롯을 찾을 수 없습니다",
    });
  }
}

// ══════════════════════════════════════════════════════════════
// MealPlan CRUD (식사타입 × 라인업 카드)
// ══════════════════════════════════════════════════════════════

export async function getMealPlansByGroup(companyId: string, mealPlanGroupId: string) {
  // 그룹 소속 검증
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  return prisma.mealPlan.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    include: MEAL_PLAN_INCLUDE,
    orderBy: [
      { slotType: "asc" },
      { lineup: { name: "asc" } },
    ],
  });
}

export async function createMealPlan(
  companyId: string,
  mealPlanGroupId: string,
  input: CreateMealPlanInput
) {
  // 그룹 소속 검증
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  // 라인업이 같은 Company에 속하는지 검증
  await assertLineupBelongsToCompany(prisma, companyId, input.lineupId);

  try {
    return await prisma.mealPlan.create({
      data: {
        mealPlanGroupId,
        slotType: input.slotType,
        lineupId: input.lineupId,
        mealTemplateId: input.mealTemplateId,
        note: input.note,
      },
      include: MEAL_PLAN_INCLUDE,
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      // unique(mealPlanGroupId, slotType, lineupId)
      throw new Error("DUPLICATE_MEAL_PLAN");
    }
    throw e;
  }
}

export async function updateMealPlan(
  companyId: string,
  id: string,
  input: UpdateMealPlanInput
) {
  // 회사 소속 검증
  await assertMealPlanInCompany(prisma, companyId, id);

  return prisma.mealPlan.update({
    where: { id },
    data: {
      mealTemplateId: input.mealTemplateId,
      note: input.note,
    },
    include: MEAL_PLAN_INCLUDE,
  });
}

/**
 * Soft delete: MealPlan + 하위 Slot/Accessory 일괄 deletedAt 설정
 */
export async function deleteMealPlan(companyId: string, id: string) {
  await assertMealPlanInCompany(prisma, companyId, id);

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.mealPlanSlot.updateMany({
      where: { mealPlanId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.mealPlanAccessory.updateMany({
      where: { mealPlanId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    return tx.mealPlan.update({
      where: { id },
      data: { deletedAt: now },
    });
  });
}

// ══════════════════════════════════════════════════════════════
// MealPlanSlot CRUD (SlotKind 분기 검증)
// ══════════════════════════════════════════════════════════════

export async function getMealPlanSlots(companyId: string, mealPlanId: string) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  return prisma.mealPlanSlot.findMany({
    where: { mealPlanId, deletedAt: null },
    include: SLOT_INCLUDE,
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Slot 생성 — Zod discriminatedUnion("kind")가 이미 필수 필드 검증함.
 * 서비스에서는 추가로 ProductionLine·SubsidiaryMaster·SupplierItem 소속 검증.
 */
export async function createMealPlanSlot(
  companyId: string,
  mealPlanId: string,
  input: CreateMealPlanSlotInput
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  // ProductionLine companyId 검증 (선택 필드)
  if (input.productionLineId) {
    const line = await prisma.productionLine.findFirst({
      where: { id: input.productionLineId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!line) throw new Error("PRODUCTION_LINE_NOT_FOUND");
  }

  if (input.kind === "CONTAINER") {
    // SubsidiaryMaster + Recipe companyId 검증
    const [sub, recipe] = await Promise.all([
      prisma.subsidiaryMaster.findFirst({
        where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
        select: { id: true },
      }),
      prisma.recipe.findFirst({
        where: { id: input.recipeId, companyId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!sub) throw new Error("SUBSIDIARY_NOT_FOUND");
    if (!recipe) throw new Error("RECIPE_NOT_FOUND");

    return prisma.mealPlanSlot.create({
      data: {
        mealPlanId,
        kind: "CONTAINER",
        sortOrder: input.sortOrder,
        quantity: input.quantity,
        note: input.note,
        productionLineId: input.productionLineId,
        subsidiaryMasterId: input.subsidiaryMasterId,
        containerSlotIndex: input.containerSlotIndex,
        recipeId: input.recipeId,
        recipeBomId: input.recipeBomId,
      },
      include: SLOT_INCLUDE,
    });
  }

  // input.kind === "DIRECT"
  const supplierItem = await prisma.supplierItem.findFirst({
    where: {
      id: input.supplierItemId,
      supplier: { companyId, deletedAt: null },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!supplierItem) throw new Error("SUPPLIER_ITEM_NOT_FOUND");

  return prisma.mealPlanSlot.create({
    data: {
      mealPlanId,
      kind: "DIRECT",
      sortOrder: input.sortOrder,
      quantity: input.quantity,
      note: input.note,
      productionLineId: input.productionLineId,
      supplierItemId: input.supplierItemId,
    },
    include: SLOT_INCLUDE,
  });
}

/**
 * Slot 업데이트 — kind 변경 불가(삭제 후 재생성). 동일 kind 내에서만 부분 갱신.
 */
export async function updateMealPlanSlot(
  companyId: string,
  id: string,
  input: UpdateMealPlanSlotInput
) {
  const existing = await prisma.mealPlanSlot.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true, kind: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  // kind 미스매치 방지
  if (existing.kind !== input.kind) {
    throw new Error("SLOT_KIND_MISMATCH");
  }

  // ProductionLine 검증 (선택 갱신)
  if (input.productionLineId) {
    const line = await prisma.productionLine.findFirst({
      where: { id: input.productionLineId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!line) throw new Error("PRODUCTION_LINE_NOT_FOUND");
  }

  const data: Prisma.MealPlanSlotUpdateInput = {
    sortOrder: input.sortOrder,
    quantity: input.quantity,
    note: input.note,
    productionLine:
      input.productionLineId === null
        ? { disconnect: true }
        : input.productionLineId
        ? { connect: { id: input.productionLineId } }
        : undefined,
  };

  if (input.kind === "CONTAINER") {
    if (input.subsidiaryMasterId) {
      const sub = await prisma.subsidiaryMaster.findFirst({
        where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!sub) throw new Error("SUBSIDIARY_NOT_FOUND");
      data.subsidiaryMaster = { connect: { id: input.subsidiaryMasterId } };
    }
    if (input.containerSlotIndex !== undefined) {
      data.containerSlotIndex = input.containerSlotIndex;
    }
    if (input.recipeId !== undefined) {
      if (input.recipeId === null) {
        data.recipe = { disconnect: true };
      } else {
        const recipe = await prisma.recipe.findFirst({
          where: { id: input.recipeId, companyId, deletedAt: null },
          select: { id: true },
        });
        if (!recipe) throw new Error("RECIPE_NOT_FOUND");
        data.recipe = { connect: { id: input.recipeId } };
      }
    }
    if (input.recipeBomId !== undefined) {
      data.recipeBom =
        input.recipeBomId === null
          ? { disconnect: true }
          : { connect: { id: input.recipeBomId } };
    }
  } else {
    // DIRECT
    if (input.supplierItemId) {
      const supplierItem = await prisma.supplierItem.findFirst({
        where: {
          id: input.supplierItemId,
          supplier: { companyId, deletedAt: null },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!supplierItem) throw new Error("SUPPLIER_ITEM_NOT_FOUND");
      data.supplierItem = { connect: { id: input.supplierItemId } };
    }
  }

  return prisma.mealPlanSlot.update({
    where: { id },
    data,
    include: SLOT_INCLUDE,
  });
}

export async function deleteMealPlanSlot(companyId: string, id: string) {
  const existing = await prisma.mealPlanSlot.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanSlot.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * 슬롯 일괄 재정렬 — drag&drop 후 sortOrder 업데이트
 */
export async function reorderMealPlanSlots(
  companyId: string,
  mealPlanId: string,
  input: ReorderMealPlanSlotsInput
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  // 모든 슬롯이 해당 MealPlan에 속하는지 검증
  const ids = input.items.map((it) => it.id);
  const existingSlots = await prisma.mealPlanSlot.findMany({
    where: { id: { in: ids }, mealPlanId, deletedAt: null },
    select: { id: true },
  });
  if (existingSlots.length !== ids.length) {
    throw new Error("SLOT_NOT_FOUND");
  }

  return prisma.$transaction(
    input.items.map((it) =>
      prisma.mealPlanSlot.update({
        where: { id: it.id },
        data: { sortOrder: it.sortOrder },
      })
    )
  );
}

// ══════════════════════════════════════════════════════════════
// MealCount (라인업별 식수)
// ══════════════════════════════════════════════════════════════

export async function getMealCounts(companyId: string, mealPlanGroupId: string) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  return prisma.mealCount.findMany({
    where: { mealPlanGroupId, deletedAt: null },
    include: {
      lineup: { select: { id: true, name: true, code: true } },
    },
    orderBy: [
      { slotType: "asc" },
      { lineup: { name: "asc" } },
    ],
  });
}

/**
 * MealCount upsert — (slotType, lineupId) 조합 기준
 * 동일 조합 존재 시 갱신, 없으면 생성
 */
export async function upsertMealCount(
  companyId: string,
  mealPlanGroupId: string,
  input: UpsertMealCountInput
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  await assertLineupBelongsToCompany(prisma, companyId, input.lineupId);

  return prisma.mealCount.upsert({
    where: {
      mealPlanGroupId_slotType_lineupId: {
        mealPlanGroupId,
        slotType: input.slotType,
        lineupId: input.lineupId,
      },
    },
    create: {
      mealPlanGroupId,
      slotType: input.slotType,
      lineupId: input.lineupId,
      estimatedCount: input.estimatedCount,
      finalCount: input.finalCount,
    },
    update: {
      estimatedCount: input.estimatedCount,
      finalCount: input.finalCount,
      deletedAt: null, // 재활성화
    },
    include: {
      lineup: { select: { id: true, name: true, code: true } },
    },
  });
}

/**
 * MealCount 일괄 upsert — UI에서 그룹 단위로 모든 라인업 식수를 한 번에 저장
 */
export async function bulkUpsertMealCount(
  companyId: string,
  mealPlanGroupId: string,
  input: BulkUpsertMealCountInput
) {
  const group = await prisma.mealPlanGroup.findFirst({
    where: { id: mealPlanGroupId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw new Error("NOT_FOUND");

  // 모든 lineupId가 같은 Company 소속인지 사전 검증 (set으로 dedup)
  const lineupIds = Array.from(new Set(input.items.map((it) => it.lineupId)));
  const validLineups = await prisma.lineup.findMany({
    where: { id: { in: lineupIds }, companyId, deletedAt: null },
    select: { id: true },
  });
  if (validLineups.length !== lineupIds.length) {
    throw new Error("LINEUP_NOT_FOUND");
  }

  return prisma.$transaction(
    input.items.map((it) =>
      prisma.mealCount.upsert({
        where: {
          mealPlanGroupId_slotType_lineupId: {
            mealPlanGroupId,
            slotType: it.slotType,
            lineupId: it.lineupId,
          },
        },
        create: {
          mealPlanGroupId,
          slotType: it.slotType,
          lineupId: it.lineupId,
          estimatedCount: it.estimatedCount,
          finalCount: it.finalCount,
        },
        update: {
          estimatedCount: it.estimatedCount,
          finalCount: it.finalCount,
          deletedAt: null,
        },
      })
    )
  );
}

export async function deleteMealCount(companyId: string, id: string) {
  const existing = await prisma.mealCount.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlanGroup: { companyId, deletedAt: null },
    },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealCount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ══════════════════════════════════════════════════════════════
// MealPlanAccessory CRUD (식단별 부자재)
// ══════════════════════════════════════════════════════════════

export async function getMealPlanAccessories(companyId: string, mealPlanId: string) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  return prisma.mealPlanAccessory.findMany({
    where: { mealPlanId, deletedAt: null },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMealPlanAccessory(
  companyId: string,
  mealPlanId: string,
  input: CreateMealPlanAccessoryInput
) {
  await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  const subsidiary = await prisma.subsidiaryMaster.findFirst({
    where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!subsidiary) throw new Error("SUBSIDIARY_NOT_FOUND");

  // FIXED_QUANTITY 모드에서는 fixedQuantity 필수
  if (input.consumptionMode === "FIXED_QUANTITY" && input.fixedQuantity == null) {
    throw new Error("FIXED_QUANTITY_REQUIRED");
  }

  const computedQuantity =
    input.consumptionMode === "FIXED_QUANTITY"
      ? input.fixedQuantity ?? 0
      : 0; // PER_MEAL_COUNT는 식수 변경 시 자동 재계산 (현재는 캐시 초기값 0)

  return prisma.mealPlanAccessory.create({
    data: {
      mealPlanId,
      subsidiaryMasterId: input.subsidiaryMasterId,
      consumptionMode: input.consumptionMode,
      fixedQuantity: input.fixedQuantity,
      required: input.required,
      note: input.note,
      quantity: computedQuantity,
    },
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateMealPlanAccessory(
  companyId: string,
  id: string,
  input: UpdateMealPlanAccessoryInput
) {
  const existing = await prisma.mealPlanAccessory.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true, consumptionMode: true, fixedQuantity: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  // 모드 / 고정수량 정합성 검증
  const finalMode = input.consumptionMode ?? existing.consumptionMode;
  const finalFixed =
    input.fixedQuantity !== undefined ? input.fixedQuantity : existing.fixedQuantity;
  if (finalMode === "FIXED_QUANTITY" && finalFixed == null) {
    throw new Error("FIXED_QUANTITY_REQUIRED");
  }

  const data: Prisma.MealPlanAccessoryUpdateInput = {
    consumptionMode: input.consumptionMode,
    fixedQuantity: input.fixedQuantity,
    required: input.required,
    note: input.note,
  };

  // 부자재 변경 시 검증
  if (input.subsidiaryMasterId) {
    const subsidiary = await prisma.subsidiaryMaster.findFirst({
      where: { id: input.subsidiaryMasterId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!subsidiary) throw new Error("SUBSIDIARY_NOT_FOUND");
    data.subsidiaryMaster = { connect: { id: input.subsidiaryMasterId } };
  }

  // FIXED_QUANTITY 모드면 quantity 캐시도 동기화
  if (finalMode === "FIXED_QUANTITY" && finalFixed != null) {
    data.quantity = finalFixed;
  }

  return prisma.mealPlanAccessory.update({
    where: { id },
    data,
    include: {
      subsidiaryMaster: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteMealPlanAccessory(companyId: string, id: string) {
  const existing = await prisma.mealPlanAccessory.findFirst({
    where: {
      id,
      deletedAt: null,
      mealPlan: {
        deletedAt: null,
        mealPlanGroup: { companyId, deletedAt: null },
      },
    },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  return prisma.mealPlanAccessory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ══════════════════════════════════════════════════════════════
// applyMealTemplate (식단 템플릿 → MealPlan 슬롯/부자재 자동 적용)
// ══════════════════════════════════════════════════════════════

/**
 * MealTemplate 의 Container/Accessory 정의를 MealPlan 의 Slot/Accessory 로 일괄 생성.
 *  - replaceExisting=true : 기존 슬롯/부자재 soft delete 후 신규 생성
 *  - replaceExisting=false: 기존 유지 + 템플릿 내용을 append (sortOrder는 기존 max+1 부터)
 *
 * Container 의 각 slot index는 MealPlanSlot.containerSlotIndex로 보존되며,
 * 레시피는 이 단계에서 미배정(recipeId=null) 상태로 생성되어 사용자가 후속 단계에서 채움.
 */
export async function applyMealTemplate(
  companyId: string,
  mealPlanId: string,
  input: ApplyMealTemplateInput
) {
  const plan = await assertMealPlanInCompany(prisma, companyId, mealPlanId);

  const template = await prisma.mealTemplate.findFirst({
    where: { id: input.mealTemplateId, companyId, deletedAt: null },
    include: {
      containers: {
        include: {
          subsidiaryMaster: {
            include: {
              containerSlots: { orderBy: { slotIndex: "asc" } },
            },
          },
        },
      },
      accessories: true,
    },
  });
  if (!template) throw new Error("MEAL_TEMPLATE_NOT_FOUND");

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    if (input.replaceExisting) {
      await tx.mealPlanSlot.updateMany({
        where: { mealPlanId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.mealPlanAccessory.updateMany({
        where: { mealPlanId, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    // append 시 sortOrder 시작 위치 계산
    const lastSlot = await tx.mealPlanSlot.findFirst({
      where: { mealPlanId, deletedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let nextSortOrder = (lastSlot?.sortOrder ?? -1) + 1;

    // 1. Container × ContainerSlot 조합 → MealPlanSlot 생성
    const slotData: Prisma.MealPlanSlotCreateManyInput[] = [];
    for (const container of template.containers) {
      const containerSlots = container.subsidiaryMaster.containerSlots;
      for (const cs of containerSlots) {
        slotData.push({
          mealPlanId,
          kind: "CONTAINER",
          sortOrder: nextSortOrder++,
          subsidiaryMasterId: container.subsidiaryMasterId,
          containerSlotIndex: cs.slotIndex,
          recipeId: null,
          recipeBomId: null,
          quantity: 0,
        });
      }
    }
    if (slotData.length > 0) {
      await tx.mealPlanSlot.createMany({ data: slotData });
    }

    // 2. Accessory → MealPlanAccessory 생성
    const accessoryData: Prisma.MealPlanAccessoryCreateManyInput[] = template.accessories.map(
      (a) => ({
        mealPlanId,
        subsidiaryMasterId: a.subsidiaryMasterId,
        consumptionMode: a.consumptionMode,
        fixedQuantity: a.fixedQuantity,
        required: a.required,
        quantity:
          a.consumptionMode === "FIXED_QUANTITY" ? a.fixedQuantity ?? 0 : 0,
      })
    );
    if (accessoryData.length > 0) {
      await tx.mealPlanAccessory.createMany({ data: accessoryData });
    }

    // 3. MealPlan.mealTemplateId 갱신
    await tx.mealPlan.update({
      where: { id: mealPlanId },
      data: { mealTemplateId: input.mealTemplateId },
    });

    return tx.mealPlan.findFirst({
      where: { id: mealPlanId },
      include: MEAL_PLAN_INCLUDE,
    });
  });
}

