"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import { prisma } from "@/lib/prisma";

export type CompanyMealSlotOption = {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
};

/**
 * 회사별 활성 슬롯 목록 조회.
 * MealPlan / MealCount 입력 UI의 Select 옵션 소스.
 *
 * Phase 5-R Step 3.2b-2-α 신설.
 * Step 3.2c에서 같은 디렉토리에 마스터 관리용 CRUD action이 추가될 예정.
 */
export async function getActiveCompanyMealSlotsAction(): Promise<
  ActionResult<CompanyMealSlotOption[]>
> {
  try {
    const session = await requireCompanySession();
    // meal-plan UI에서 사용하므로 mealPlan READ 권한으로 충분
    assertPermission(session, "mealPlan", "READ");

    const slots = await prisma.companyMealSlot.findMany({
      where: {
        companyId: session.companyId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        displayName: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return actionOk(slots);
  } catch (error) {
    return handleActionError(error, "슬롯 목록 조회에 실패했습니다");
  }
}
