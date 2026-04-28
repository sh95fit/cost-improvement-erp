"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import {
  createMaterialSchema,
  updateMaterialSchema,
  materialListQuerySchema,
  createSubsidiarySchema,
  updateSubsidiarySchema,
} from "../schemas/material.schema";
import * as materialService from "../services/material.service";
import * as subsidiaryService from "../services/subsidiary.service";
import type { MaterialMaster, SubsidiaryMaster } from "@prisma/client";

// ════════════════════════════════════════
// MaterialMaster Actions
// ════════════════════════════════════════

// ── 자재 목록 조회 ──
export async function getMaterialsAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof materialService.getMaterials>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "READ");

    const query = materialListQuerySchema.parse(rawQuery);
    const result = await materialService.getMaterials(session.companyId, query);

    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "자재 목록 조회에 실패했습니다");
  }
}

// ── 자재 단건 조회 ──
export async function getMaterialByIdAction(
  id: string
): Promise<ActionResult<MaterialMaster | null>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "READ");

    const material = await materialService.getMaterialById(session.companyId, id);
    return actionOk(material);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "자재 조회에 실패했습니다");
  }
}

// ── 자재 생성 (코드 자동 채번) ──
export async function createMaterialAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<MaterialMaster>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "CREATE");

    const input = createMaterialSchema.parse(rawInput);
    const material = await materialService.createMaterial(session.companyId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MaterialMaster",
      entityId: material.id,
      after: material as unknown as Record<string, unknown>,
    });

    return actionOk(material);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "자재 생성에 실패했습니다");
  }
}

// ── 자재 수정 ──
export async function updateMaterialAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<MaterialMaster>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "UPDATE");

    const input = updateMaterialSchema.parse(rawInput);

    const existing = await materialService.getMaterialById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "자재를 찾을 수 없습니다");
    }

    const before = existing as unknown as Record<string, unknown>;
    const material = await materialService.updateMaterial(session.companyId, id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MaterialMaster",
      entityId: material.id,
      before,
      after: material as unknown as Record<string, unknown>,
    });

    return actionOk(material);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "자재 수정에 실패했습니다");
  }
}

// ── 자재 삭제 ──
export async function deleteMaterialAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "DELETE");

    const existing = await materialService.getMaterialById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "자재를 찾을 수 없습니다");
    }

    await materialService.deleteMaterial(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "MaterialMaster",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "자재 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// SubsidiaryMaster Actions
// ════════════════════════════════════════

// ── 부자재 목록 조회 ──
export async function getSubsidiariesAction(
  rawQuery: Record<string, unknown>
): Promise<ActionResult<{
  items: Awaited<ReturnType<typeof subsidiaryService.getSubsidiaries>>["items"];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "subsidiary", "READ");

    const query = materialListQuerySchema.parse(rawQuery);
    const result = await subsidiaryService.getSubsidiaries(session.companyId, query);

    return actionOk(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "부자재 목록 조회에 실패했습니다");
  }
}

// ── 부자재 생성 (코드 자동 채번) ──
export async function createSubsidiaryAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<SubsidiaryMaster>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "subsidiary", "CREATE");

    const input = createSubsidiarySchema.parse(rawInput);
    const subsidiary = await subsidiaryService.createSubsidiary(session.companyId, input);

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "SubsidiaryMaster",
      entityId: subsidiary.id,
      after: subsidiary as unknown as Record<string, unknown>,
    });

    return actionOk(subsidiary);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "부자재 생성에 실패했습니다");
  }
}

// ── 부자재 수정 ──
export async function updateSubsidiaryAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<SubsidiaryMaster>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "subsidiary", "UPDATE");

    const input = updateSubsidiarySchema.parse(rawInput);

    const existing = await subsidiaryService.getSubsidiaryById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "부자재를 찾을 수 없습니다");
    }

    const before = existing as unknown as Record<string, unknown>;
    const subsidiary = await subsidiaryService.updateSubsidiary(session.companyId, id, input);

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "SubsidiaryMaster",
      entityId: subsidiary.id,
      before,
      after: subsidiary as unknown as Record<string, unknown>,
    });

    return actionOk(subsidiary);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "부자재 수정에 실패했습니다");
  }
}

// ── 부자재 삭제 ──
export async function deleteSubsidiaryAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "subsidiary", "DELETE");

    const existing = await subsidiaryService.getSubsidiaryById(session.companyId, id);
    if (!existing) {
      return actionFail("NOT_FOUND", "부자재를 찾을 수 없습니다");
    }

    await subsidiaryService.deleteSubsidiary(session.companyId, id);

    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "SubsidiaryMaster",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });

    return actionOk({ id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "부자재 삭제에 실패했습니다");
  }
}

// ════════════════════════════════════════
// Default SupplierItem Actions
// ════════════════════════════════════════

// ── 자재 기본 공급 품목 설정 ──
export async function setMaterialDefaultSupplierItemAction(
  materialId: string,
  supplierItemId: string | null
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "material", "UPDATE");

    const material = await materialService.setDefaultSupplierItem(
      session.companyId,
      materialId,
      supplierItemId
    );

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MaterialMaster",
      entityId: materialId,
      after: { defaultSupplierItemId: supplierItemId } as unknown as Record<string, unknown>,
    });

    return actionOk(material);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "기본 공급 품목 설정에 실패했습니다");
  }
}

// ── 부자재 기본 공급 품목 설정 ──
export async function setSubsidiaryDefaultSupplierItemAction(
  subsidiaryId: string,
  supplierItemId: string | null
): Promise<ActionResult<unknown>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "subsidiary", "UPDATE");

    const subsidiary = await subsidiaryService.setDefaultSupplierItem(
      session.companyId,
      subsidiaryId,
      supplierItemId
    );

    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "SubsidiaryMaster",
      entityId: subsidiaryId,
      after: { defaultSupplierItemId: supplierItemId } as unknown as Record<string, unknown>,
    });

    return actionOk(subsidiary);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return actionFail("UNAUTHORIZED", "로그인이 필요합니다");
      if (error.message === "COMPANY_NOT_ASSIGNED") return actionFail("COMPANY_NOT_ASSIGNED", "회사가 지정되지 않았습니다");
      if (error.message === "FORBIDDEN") return actionFail("FORBIDDEN", "권한이 없습니다");
    }
    return actionFail("INTERNAL_ERROR", "기본 공급 품목 설정에 실패했습니다");
  }
}
