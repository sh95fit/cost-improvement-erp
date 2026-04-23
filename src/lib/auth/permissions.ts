import type { AppSession } from "@/lib/auth/session";

/**
 * 특정 리소스+액션에 대한 권한이 있는지 확인한다.
 * SYSTEM_ADMIN과 COMPANY_ADMIN은 모든 권한을 가진다.
 * MEMBER는 PermissionSetItem에 해당 resource:action이 있어야 한다.
 */
export function assertPermission(
  session: AppSession,
  resource: string,
  action: string
): void {
  if (session.systemRole === "SYSTEM_ADMIN") return;
  if (session.systemRole === "COMPANY_ADMIN") return;

  const required = `${resource}:${action}`;
  if (!session.permissions.includes(required)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * 특정 스코프(Location, ProductionLine 등)에 대한 접근 권한이 있는지 확인한다.
 * SYSTEM_ADMIN과 COMPANY_ADMIN은 모든 스코프에 접근 가능하다.
 * MEMBER는 UserScope에 해당 scopeType+scopeId가 있어야 한다.
 */
export function assertScope(
  session: AppSession,
  scopeType: "COMPANY" | "LOCATION" | "PRODUCTION_LINE",
  scopeId: string
): void {
  if (session.systemRole === "SYSTEM_ADMIN") return;
  if (session.systemRole === "COMPANY_ADMIN") return;

  const hasScope = session.scopes.some(
    (s) => s.scopeType === scopeType && s.scopeId === scopeId
  );

  if (!hasScope) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * 요청 대상 리소스의 companyId가 세션의 companyId와 일치하는지 확인한다.
 * SYSTEM_ADMIN은 모든 회사에 접근 가능하다.
 */
export function assertCompanyMatch(
  session: AppSession,
  targetCompanyId: string
): void {
  if (session.systemRole === "SYSTEM_ADMIN") return;
  if (session.companyId !== targetCompanyId) {
    throw new Error("FORBIDDEN");
  }
}
