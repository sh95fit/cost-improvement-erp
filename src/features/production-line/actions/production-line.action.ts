// src/features/production-line/actions/production-line.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createProductionLineSchema,
  updateProductionLineSchema,
  productionLineListQuerySchema,
} from "../schemas/production-line.schema";
import * as plService from "../services/production-line.service";

// 에러 코드 → 사용자 메시지 매핑
const COMMON_ERROR_MAP = {
  NOT_FOUND: "생산라인을 찾을 수 없습니다",
  LOCATION_NOT_FOUND: "선택한 위치를 찾을 수 없습니다",
  LOCATION_NOT_FACTORY: "창고 유형 위치에는 생산라인을 등록할 수 없습니다",
  LOCATION_INACTIVE: "선택한 위치가 비활성화 상태입니다",
} as const;

// ════════════════════════════════════════
// Read
// ════════════════════════════════════════

export async function getProductionLinesAction(
  rawQuery: Record<string, unknown>
): Promise<
  ActionResult<Awaited<ReturnType<typeof plService.getProductionLines>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "READ");
    const query = productionLineListQuerySchema.parse(rawQuery);
    const result = await plService.getProductionLines(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "생산라인 목록 조회에 실패했습니다");
  }
}

export async function getProductionLineByIdAction(id: string) {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "READ");
    const line = await plService.getProductionLineById(session.companyId, id);
    if (!line) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "생산라인 조회에 실패했습니다",
        COMMON_ERROR_MAP
      );
    }
    return actionOk(line);
  } catch (error) {
    return handleActionError(error, "생산라인 조회에 실패했습니다");
  }
}

export async function getFactoryLocationOptionsAction() {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "READ");
    const options = await plService.getFactoryLocationOptions(
      session.companyId
    );
    return actionOk(options);
  } catch (error) {
    return handleActionError(error, "위치 옵션 조회에 실패했습니다");
  }
}

// ════════════════════════════════════════
// Write
// ════════════════════════════════════════

export async function createProductionLineAction(
  rawInput: Record<string, unknown>
) {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "CREATE");
    const input = createProductionLineSchema.parse(rawInput);
    const line = await plService.createProductionLine(session.companyId, input);
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "ProductionLine",
      entityId: line.id,
      after: line as unknown as Record<string, unknown>,
    });
    return actionOk(line);
  } catch (error) {
    return handleActionError(error, "생산라인 생성에 실패했습니다", COMMON_ERROR_MAP);
  }
}

export async function updateProductionLineAction(
  id: string,
  rawInput: Record<string, unknown>
) {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "UPDATE");
    const input = updateProductionLineSchema.parse(rawInput);
    const existing = await plService.getProductionLineById(
      session.companyId,
      id
    );
    if (!existing) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "생산라인 수정에 실패했습니다",
        COMMON_ERROR_MAP
      );
    }
    const before = existing as unknown as Record<string, unknown>;
    const line = await plService.updateProductionLine(
      session.companyId,
      id,
      input
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "ProductionLine",
      entityId: line.id,
      before,
      after: line as unknown as Record<string, unknown>,
    });
    return actionOk(line);
  } catch (error) {
    return handleActionError(error, "생산라인 수정에 실패했습니다", COMMON_ERROR_MAP);
  }
}

export async function checkProductionLineDependenciesAction(id: string) {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "READ");
    const result = await plService.checkProductionLineDependencies(
      session.companyId,
      id
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(
      error,
      "생산라인 의존성 확인에 실패했습니다",
      COMMON_ERROR_MAP
    );
  }
}

export async function deleteProductionLineAction(id: string) {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "productionLine", "DELETE");
    const existing = await plService.getProductionLineById(
      session.companyId,
      id
    );
    if (!existing) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "생산라인 삭제에 실패했습니다",
        COMMON_ERROR_MAP
      );
    }
    await plService.deleteProductionLine(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "ProductionLine",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "생산라인 삭제에 실패했습니다", {
      ...COMMON_ERROR_MAP,
      DEPENDENCY_EXISTS:
        "이 생산라인을 사용 중인 작업지시서/식단 슬롯이 있어 삭제할 수 없습니다",
    });
  }
}
