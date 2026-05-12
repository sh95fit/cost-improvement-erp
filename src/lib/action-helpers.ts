// src/lib/action-helpers.ts
import { actionFail } from "@/lib/result";
import type { ActionFailure, ActionResult } from "@/lib/result";

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

// ── loadAllPages 타입 강화용 ──

/** Action이 반환하는 페이지네이션 응답의 공통 형태 */
export type PaginatedActionResult<T> = ActionResult<{
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}>;

/**
 * loadAllPages의 fetcher 파라미터 타입.
 * any를 제거하고 ActionResult 기반 타입을 사용한다.
 */
export type PaginatedFetcher<T> = (
  query: Record<string, unknown>
) => Promise<PaginatedActionResult<T>>;

/**
 * 다중 페이지 전체 로딩 공통 헬퍼.
 * recipe-detail-dialog.tsx 등에서 사용하던 인라인 함수를 공통화한다.
 *
 * @example
 * const { items, error } = await loadAllPages(getMaterialsAction, "name");
 */
export async function loadAllPages<T>(
  fetcher: PaginatedFetcher<T>,
  sortBy: string
): Promise<{ items: T[]; error?: string }> {
  try {
    const first = await fetcher({
      page: 1,
      limit: 100,
      sortBy,
      sortOrder: "asc",
    });
    if (!first.success) {
      return { items: [], error: first.error?.message ?? "조회 실패" };
    }

    const allItems: T[] = [...first.data.items];
    const totalPages: number = first.data.pagination.totalPages;

    if (totalPages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetcher({ page: i + 2, limit: 100, sortBy, sortOrder: "asc" })
        )
      );
      for (const res of remaining) {
        if (res.success) allItems.push(...res.data.items);
      }
    }
    return { items: allItems };
  } catch (err) {
    return { items: [], error: String(err) };
  }
}
