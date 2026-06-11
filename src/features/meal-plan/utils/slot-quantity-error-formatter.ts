// src/features/meal-plan/utils/slot-quantity-error-formatter.ts
import { prisma } from "@/lib/prisma";

// ────────────────────────────────────────────────────────────
// Phase 9-C-Fix-R1-4: 슬롯 수량 검증 실패 메시지 포맷터
// ────────────────────────────────────────────────────────────
// 서비스에서 throw하는 에러 메시지(`PREFIX::mealPlanId::recipeId::...::more`)를
// 사용자 친화적 한국어 문장으로 변환한다.
//
// 메시지에 레시피명을 포함시키기 위해 recipeId로 Recipe.name을 lookup한다.
// recipeId가 유효하지 않거나 lookup 실패 시 "(레시피 미상)"으로 fallback.
//
// "외 N건"은 같은 그룹 검증 호출에서 추가로 발견된 위반 개수.
// ────────────────────────────────────────────────────────────

/**
 * recipeId로 Recipe.name을 조회 (실패 시 "(레시피 미상)")
 */
async function lookupRecipeName(recipeId: string): Promise<string> {
  try {
    const r = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { name: true },
    });
    return r?.name ?? "(레시피 미상)";
  } catch {
    return "(레시피 미상)";
  }
}

/** "외 N건" 접미사 (more=0이면 빈 문자열) */
function moreSuffix(more: number): string {
  return more > 0 ? ` 외 ${more}건` : "";
}

/**
 * 슬롯 수량 검증 실패 에러 메시지를 분석해 사용자 문장으로 변환.
 * 매칭되는 prefix가 없으면 null 반환 → 호출부에서 기본 에러 처리.
 *
 * 지원 prefix:
 *   - PARTIAL_INPUT_*    (zeroCount/totalCount/more)
 *   - SUM_MISMATCH_*     (mealCount/slotsSum/more)
 *   - MULTI_LINE_*       (productionLineCount/more)
 *
 * @param msg      에러 메시지 원문
 * @param prefixes 매칭할 prefix 묶음 (호출부에서 namespace 지정)
 * @param leadIn   메시지 앞에 붙일 문맥 문구 (예: "상태를 변경할 수 없습니다. ")
 */
export async function formatSlotQuantityError(
  msg: string,
  prefixes: {
    partial: string;
    sumMismatch: string;
    multiLine: string;
  },
  leadIn: string,
): Promise<string | null> {
  // PARTIAL_INPUT: prefix::mealPlanId::recipeId::zeroCount::totalCount::more
  if (msg.startsWith(`${prefixes.partial}::`)) {
    const [, , recipeId, zero, total, more] = msg.split("::");
    const name = await lookupRecipeName(recipeId);
    return `${leadIn}레시피 "${name}"의 슬롯 ${total}개 중 ${zero}개가 미입력입니다. 모두 입력하거나 모두 비워주세요${moreSuffix(Number(more))}`;
  }

  // SUM_MISMATCH: prefix::mealPlanId::recipeId::mealCount::slotsSum::more
  // Phase 9-D-Sym: leadIn에 "예상" / "확정" 문맥이 이미 포함되므로 본 메시지는 "식수"로 일반화.
  if (msg.startsWith(`${prefixes.sumMismatch}::`)) {
    const [, , recipeId, mc, sum, more] = msg.split("::");
    const name = await lookupRecipeName(recipeId);
    return `${leadIn}레시피 "${name}"의 슬롯 합계(${Number(sum).toLocaleString()})가 식수(${Number(mc).toLocaleString()})와 일치하지 않습니다${moreSuffix(Number(more))}`;
  }

  // MULTI_LINE: prefix::mealPlanId::recipeId::productionLineCount::more
  if (msg.startsWith(`${prefixes.multiLine}::`)) {
    const [, , recipeId, lineCount, more] = msg.split("::");
    const name = await lookupRecipeName(recipeId);
    return `${leadIn}레시피 "${name}"이(가) ${lineCount}개의 제조라인에 걸쳐 있습니다. 라인별 수량을 입력해주세요${moreSuffix(Number(more))}`;
  }

  return null;
}
