"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission, assertScope } from "@/lib/auth/permissions";
import { actionOk, actionFail } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  confirmConsumption,
  type ConfirmConsumptionResult,
} from "../services/confirm-consumption.service";

// ════════════════════════════════════════
// S4-3-d: 사용 처리 확정 Server Action
// ════════════════════════════════════════
//
// 권한 순서:
//   1) assertPermission(consumption, WRITE)
//   2) assertScope(LOCATION, locationId)
//   3) confirmConsumption(...)
//      - Layer A drift 재검증 → STALE_DRAFT
//      - Layer B 활성/메타 검증 → INVALID_LAYER_B_ITEM:{reason}
//      - CookingPlan auto-upsert
//      - FIFO Lot 차감 (receivedAt asc, id asc)
//      - InsufficientStockError → "INSUFFICIENT_STOCK:재고 부족 - ..."
//      - AuditLog: CONFIRM_CONSUMPTION

export type ConfirmConsumptionActionInput = {
  targetDate: string; // YYYY-MM-DD
  locationId: string;
  layerAItems: Array<{
    itemType: "MATERIAL" | "SUBSIDIARY";
    itemId: string;
    expectedQty: number;
  }>;
  layerBItems: Array<{
    itemType: "MATERIAL" | "SUBSIDIARY";
    itemId: string;
    quantity: number;
    note?: string;
  }>;
};

export async function confirmConsumptionAction(
  input: ConfirmConsumptionActionInput,
): Promise<ActionResult<ConfirmConsumptionResult>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "consumption", "WRITE");
    assertScope(session, "LOCATION", input.locationId);

    if (!session.companyId) {
      throw new Error("COMPANY_NOT_ASSIGNED");
    }

    const [y, m, d] = input.targetDate.split("-").map(Number);
    const targetDate = new Date(Date.UTC(y, m - 1, d));

    try {
      const result = await confirmConsumption({
        companyId: session.companyId,
        userId: session.userId,
        locationId: input.locationId,
        targetDate,
        layerAItems: input.layerAItems,
        layerBItems: input.layerBItems,
      });
      return actionOk(result);
    } catch (error) {
      // 접두사 형태 에러 (상세를 message 에 포함) — 사용자에게 그대로 노출
      if (error instanceof Error) {
        if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
          const detail = error.message.replace("INSUFFICIENT_STOCK:", "").trim();
          return actionFail("INSUFFICIENT_STOCK", detail);
        }
        if (error.message.startsWith("INVALID_LAYER_B_ITEM:")) {
          const reason = error.message.replace("INVALID_LAYER_B_ITEM:", "").trim();
          return actionFail(
            "INVALID_LAYER_B_ITEM",
            layerBReasonToMessage(reason),
          );
        }
      }
      throw error; // 나머지는 아래 handleActionError 로
    }
  } catch (error) {
    return handleActionError(error, "사용 처리 확정에 실패했습니다", {
      STALE_DRAFT:
        "화면 정보가 최신이 아닙니다. 페이지를 새로고침한 뒤 다시 시도해주세요.",
      MEAL_PLAN_NOT_COMPLETED_FOR_CONSUMPTION:
        "식단 확정이 완료되지 않아 사용 처리를 할 수 없습니다.",
      MATERIAL_REQUIREMENT_NOT_GENERATED:
        "소요량이 산출되지 않았습니다. 잠시 후 다시 시도해주세요.",
      MEAL_PLAN_GROUP_NOT_FOUND: "해당 날짜의 식단 그룹을 찾을 수 없습니다.",
    });
  }
}

function layerBReasonToMessage(reason: string): string {
  switch (reason) {
    case "ITEM_NOT_FOUND":
      return "선택한 품목을 찾을 수 없습니다.";
    case "ITEM_INACTIVE":
      return "비활성 품목은 사용할 수 없습니다.";
    case "QUANTITY_NON_POSITIVE":
      return "수량은 0보다 커야 합니다.";
    case "UNIT_MISMATCH":
      return "품목 단위가 일치하지 않습니다.";
    default:
      return "수동 추가 항목이 유효하지 않습니다.";
  }
}
