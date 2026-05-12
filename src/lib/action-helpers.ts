// src/lib/action-helpers.ts
import { actionFail } from "@/lib/result";
import type { ActionFailure } from "@/lib/result";

/**
 * 공통 인증/권한 에러 → ActionFailure 매핑
 */
const COMMON_ERRORS: Record<string, { code: string; message: string }> = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" },
  COMPANY_NOT_ASSIGNED: { code: "COMPANY_NOT_ASSIGNED", message: "회사가 지정되지 않았습니다" },
  FORBIDDEN: { code: "FORBIDDEN", message: "권한이 없습니다" },
};

/**
 * Action의 catch 블록에서 공통 + 도메인 에러를 일관되게 변환하는 헬퍼.
 *
 * @param error        catch로 잡힌 에러
 * @param fallbackMsg  매핑되지 않은 에러일 때 사용할 메시지
 * @param domainErrors 도메인별 추가 에러 코드 → 메시지 매핑 (선택)
 *
 * @example
 * // 공통 에러만 처리
 * catch (error) {
 *   return handleActionError(error, "레시피 생성에 실패했습니다");
 * }
 *
 * @example
 * // 도메인 에러 포함
 * catch (error) {
 *   return handleActionError(error, "BOM 상태 변경에 실패했습니다", {
 *     NOT_FOUND: "BOM을 찾을 수 없습니다",
 *     LAST_ACTIVE_BOM: "마지막 사용중 BOM은 보관할 수 없습니다.",
 *   });
 * }
 */
export function handleActionError(
  error: unknown,
  fallbackMsg: string,
  domainErrors?: Record<string, string>
): ActionFailure {
  if (error instanceof Error) {
    // 1) 공통 에러 체크
    const common = COMMON_ERRORS[error.message];
    if (common) return actionFail(common.code, common.message);

    // 2) 도메인별 에러 체크
    if (domainErrors && error.message in domainErrors) {
      return actionFail(error.message, domainErrors[error.message]);
    }

    // 3) DEPENDENCY: 접두사 에러 (container 등)
    if (error.message.startsWith("DEPENDENCY:")) {
      const reason = error.message.replace("DEPENDENCY:", "").trim();
      return actionFail("DEPENDENCY", `삭제할 수 없습니다: ${reason}`);
    }

    // 4) Prisma unique constraint (unit-master 등)
    if (error.message.includes("Unique constraint")) {
      return actionFail("DUPLICATE", "이미 등록된 항목입니다");
    }

    // 5) UNIT_IN_USE 특수 처리 (usages 배열 포함)
    if (error.message === "UNIT_IN_USE") {
      const usages = (error as Error & { usages?: string[] }).usages ?? [];
      return actionFail(
        "UNIT_IN_USE",
        `사용 중인 단위는 삭제할 수 없습니다: ${usages.join(", ")}`
      );
    }
  }

  return actionFail("INTERNAL_ERROR", fallbackMsg);
}
