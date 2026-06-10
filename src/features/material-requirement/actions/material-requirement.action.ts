// src/features/material-requirement/actions/material-requirement.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";

import {
  generateMaterialRequirementsSchema,
  listMaterialRequirementsSchema,
  getMaterialRequirementByIdSchema,
  MATERIAL_REQUIREMENT_ERRORS,
} from "../schemas/material-requirement.schema";
import * as materialRequirementService from "../services/material-requirement.service";

import { formatSlotQuantityError } from "@/features/meal-plan/utils/slot-quantity-error-formatter";

// UI에서 사용할 List 응답 타입 re-export
export type { MaterialRequirementListItem } from "../services/material-requirement.service";

// ══════════════════════════════════════════════════════════════
// Phase 9-A-4: MaterialRequirement Server Actions
// ------------------------------------------------------------
// 책임:
//   - 세션·권한 가드
//   - Zod 입력 검증
//   - 서비스 호출 (companyId 첫 인자로 전달)
//   - 도메인 에러 → ActionFailure(메시지) 변환
//   - 산출 트리거(generate)에 대한 감사 로그 기록
//
// 권한 키: "materialRequirement" (신규)
//   ※ permissions.ts의 assertPermission이 string을 받으므로 자유롭게 사용 가능
//   ※ SYSTEM_ADMIN / COMPANY_ADMIN은 무조건 통과
//   ※ MEMBER는 PermissionSetItem에 해당 키 부여 필요 (9-B/시드 단계)
// ══════════════════════════════════════════════════════════════

// ── 도메인 에러 → 사용자 메시지 매핑 ─────────────────────────────
const MR_DOMAIN_ERRORS: Record<string, string> = {
  [MATERIAL_REQUIREMENT_ERRORS.GROUP_NOT_FOUND]:
    "식단 그룹을 찾을 수 없습니다",
  [MATERIAL_REQUIREMENT_ERRORS.GROUP_EMPTY]:
    "산출할 슬롯이 없습니다. CONTAINER 슬롯과 식수, 레시피 BOM을 확인해주세요",
  [MATERIAL_REQUIREMENT_ERRORS.MISSING_PRODUCTION_LINE]:
    "생산라인이 지정되지 않은 슬롯이 있습니다. 모든 CONTAINER 슬롯에 생산라인을 배정해주세요",
  [MATERIAL_REQUIREMENT_ERRORS.MISSING_LOCATION]:
    "생산라인에 위치(공장/창고)가 연결되어 있지 않습니다",
  [MATERIAL_REQUIREMENT_ERRORS.MISSING_RECIPE_BOM]:
    "CONTAINER 슬롯에 사용중(ACTIVE) BOM이 연결되어 있지 않습니다",
  [MATERIAL_REQUIREMENT_ERRORS.MISSING_SEMI_PRODUCT_BOM]:
    "반제품의 사용중(ACTIVE) BOM이 등록되어 있지 않습니다",
  [MATERIAL_REQUIREMENT_ERRORS.MISSING_MEAL_COUNT]:
    "식수(예상/확정)가 입력되지 않은 슬롯이 있습니다",
  [MATERIAL_REQUIREMENT_ERRORS.INVALID_UNIT]:
    "단위 환산표가 등록되지 않아 산출할 수 없는 단위가 있습니다",
};

// ══════════════════════════════════════════════════════════════
// 1. 산출 트리거 (CREATE 권한)
// ══════════════════════════════════════════════════════════════

export async function generateMaterialRequirementsAction(
  rawInput: Record<string, unknown>,
): Promise<
  ActionResult<
    Awaited<
      ReturnType<
        typeof materialRequirementService.generateMaterialRequirements
      >
    >
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "materialRequirement", "CREATE");
    const input = generateMaterialRequirementsSchema.parse(rawInput);

    const result = await materialRequirementService.generateMaterialRequirements(
      session.companyId,
      input,
    );

    // 감사 로그 — 산출은 데이터 다량 변경이므로 stats를 after에 기록
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "MaterialRequirement",
      entityId: input.mealPlanGroupId,
      after: {
        countSource: result.countSource,
        generationVersion: result.generationVersion,
        ...result.stats,
      } as unknown as Record<string, unknown>,
    });

    return actionOk(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";

    // ★ Phase 9-C-Fix-R1-4: 슬롯 수량 검증 실패 (K1 + R1-3 통합)
    const formatted = await formatSlotQuantityError(
      msg,
      {
        partial: MATERIAL_REQUIREMENT_ERRORS.SLOT_QTY_PARTIAL_INPUT,
        sumMismatch: MATERIAL_REQUIREMENT_ERRORS.SLOT_QTY_SUM_MISMATCH,
        multiLine: MATERIAL_REQUIREMENT_ERRORS.MULTI_LINE_REQUIRES_QUANTITY,
      },
      "소요량 산출에 실패했습니다. ",
    );
    if (formatted) {
      return handleActionError(error, formatted);
    }

    // ★ R1-4: MISSING_MEAL_COUNT도 mealPlanId 포함된 새 포맷 처리
    if (msg.startsWith(`${MATERIAL_REQUIREMENT_ERRORS.MISSING_MEAL_COUNT}::`)) {
      return handleActionError(
        error,
        "예상식수가 입력되지 않은 식단이 있습니다. 모든 식단에 예상식수를 입력 후 다시 산출하세요.",
      );
    }

    return handleActionError(
      error,
      "소요량 산출에 실패했습니다",
      MR_DOMAIN_ERRORS,
    );
  }
}

// ══════════════════════════════════════════════════════════════
// 2. 목록 조회 (READ 권한)
// ══════════════════════════════════════════════════════════════

export async function listMaterialRequirementsAction(
  rawQuery: Record<string, unknown>,
): Promise<
  ActionResult<
    Awaited<
      ReturnType<typeof materialRequirementService.listMaterialRequirements>
    >
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "materialRequirement", "READ");
    const query = listMaterialRequirementsSchema.parse(rawQuery);

    const result = await materialRequirementService.listMaterialRequirements(
      session.companyId,
      query,
    );

    return actionOk(result);
  } catch (error) {
    return handleActionError(
      error,
      "소요량 목록 조회에 실패했습니다",
      MR_DOMAIN_ERRORS,
    );
  }
}

// ══════════════════════════════════════════════════════════════
// 3. 단건 조회 (READ 권한)
// ══════════════════════════════════════════════════════════════

export async function getMaterialRequirementByIdAction(
  rawInput: Record<string, unknown>,
): Promise<
  ActionResult<
    Awaited<
      ReturnType<typeof materialRequirementService.getMaterialRequirementById>
    >
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "materialRequirement", "READ");
    const input = getMaterialRequirementByIdSchema.parse(rawInput);

    const result = await materialRequirementService.getMaterialRequirementById(
      session.companyId,
      input,
    );

    return actionOk(result);
  } catch (error) {
    return handleActionError(
      error,
      "소요량 단건 조회에 실패했습니다",
      MR_DOMAIN_ERRORS,
    );
  }
}
