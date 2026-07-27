/**
 * S4-3-c-R7-a: 최소 스코프 유틸 (감사서 §10-17)
 *
 * 3함수 신설:
 *  1) getUserScope(userId) — UserScope 조회 → { level, scopeIds }
 *  2) applyScopeFilter(scope, baseWhere) — Prisma where 절 스코프 병합
 *  3) assertScopeAccess(scope, resource) — 자원 스코프 검증
 *
 * 스키마 제약 (R7-a 시점):
 *  - UserScope 테이블은 companyId+role만 저장 (LOCATION/PRODUCTION_LINE 레벨 컬럼 없음).
 *  - 따라서 현시점 실질 반환은 { level: "COMPANY", scopeIds: [companyId...] } 만 발생.
 *  - LOCATION/PRODUCTION_LINE 레벨 시그니처는 인터페이스만 준비 (감사서 §10-17 원문 유지).
 *    실제 반환은 UserLocationScope / UserProductionLineScope 테이블 신설 시 활성화.
 *  - SYSTEM_ADMIN: scopeIds=[] (전권), applyScopeFilter no-op.
 *
 * 기존 함수와의 관계:
 *  - permissions.ts::assertScope 는 AppSession 기반 (기존 코드 유지).
 *  - assertScopeAccess 는 UserScope 반환값 기반 (신설, 병렬 존재).
 *
 * 상위 커밋: R6-B-4 (2f91400).
 */
import { prisma } from "@/lib/prisma";

export type ScopeLevel = "COMPANY" | "LOCATION" | "PRODUCTION_LINE";

export type UserScope = {
  level: ScopeLevel;
  scopeIds: string[];  // 빈 배열 = 전권 (SYSTEM_ADMIN)
};

export class ScopeAccessDeniedError extends Error {
  constructor(
    public readonly resource: { companyId?: string; locationId?: string; productionLineId?: string },
    public readonly scope: UserScope,
  ) {
    super("SCOPE_ACCESS_DENIED");
    this.name = "ScopeAccessDeniedError";
  }
}

/**
 * 사용자 스코프 조회.
 * 현시점 (R7-a): companyId + role 기반 COMPANY 레벨만 반환.
 * 향후 (스키마 확장 시): UserLocationScope / UserProductionLineScope 조회 로직 편입.
 */
export async function getUserScope(userId: string): Promise<UserScope> {
  const scopes = await prisma.userScope.findMany({
    where: { userId },
    select: { companyId: true, role: true },
  });
  if (scopes.length === 0) {
    return { level: "COMPANY", scopeIds: [] }; // 스코프 없음 = 초기 상태
  }
  // SYSTEM_ADMIN 은 어느 UserScope 든 있으면 전권
  const isSystemAdmin = scopes.some((s) => s.role === "SYSTEM_ADMIN");
  if (isSystemAdmin) {
    return { level: "COMPANY", scopeIds: [] }; // 전권 marker
  }
  return {
    level: "COMPANY",
    scopeIds: scopes.map((s) => s.companyId),
  };
}

/**
 * Prisma where 절에 스코프 필터 병합.
 * scopeIds 가 빈 배열이면 전권 → baseWhere 원본 반환 (no-op).
 * 그 외에는 level 축의 { in: scopeIds } 조건 추가.
 */
export function applyScopeFilter<T extends Record<string, unknown>>(
  scope: UserScope,
  baseWhere: T,
): T {
  if (scope.scopeIds.length === 0) return baseWhere;
  const key =
    scope.level === "COMPANY"
      ? "companyId"
      : scope.level === "LOCATION"
      ? "locationId"
      : "productionLineId";
  return { ...baseWhere, [key]: { in: scope.scopeIds } } as T;
}

/**
 * 대상 자원이 스코프 내인지 검증.
 * scopeIds 가 빈 배열이면 전권 통과.
 * 그 외에는 자원의 해당 축 ID 가 scopeIds 에 포함되어야 함.
 */
export function assertScopeAccess(
  scope: UserScope,
  resource: { companyId?: string; locationId?: string; productionLineId?: string },
): void {
  if (scope.scopeIds.length === 0) return; // 전권
  const targetId =
    scope.level === "COMPANY"
      ? resource.companyId
      : scope.level === "LOCATION"
      ? resource.locationId
      : resource.productionLineId;
  if (!targetId || !scope.scopeIds.includes(targetId)) {
    throw new ScopeAccessDeniedError(resource, scope);
  }
}
