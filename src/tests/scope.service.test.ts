/**
 * S4-3-c-R7-a: 스코프 유틸 단위 테스트 (감사서 §10-17)
 * 상위 커밋: R6-B-4 (2f91400).
 *
 * 검증 대상:
 *   - getUserScope(userId) — UserScope 테이블 조회 → { level, scopeIds }
 *   - applyScopeFilter(scope, baseWhere) — Prisma where 절 스코프 병합
 *   - assertScopeAccess(scope, resource) — 자원 스코프 검증 (throw)
 *
 * 현시점 스키마 제약: COMPANY 레벨만 실동작. LOCATION/PRODUCTION_LINE 인터페이스는 준비 상태.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// mocks/prisma.ts 하단에서 이미 vi.mock("@/lib/prisma") 자동 등록되어 있으므로 여기서는 import만.
import {
  getUserScope,
  applyScopeFilter,
  assertScopeAccess,
  ScopeAccessDeniedError,
  type UserScope,
} from "@/lib/auth/scope";

const USER_ID = "usr_test";
const COMPANY_A = "company_a";
const COMPANY_B = "company_b";
const LOCATION_A = "loc_a";
const PROD_LINE_A = "pline_a";

describe("scope 유틸 (S4-3-c-R7-a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 그룹 1: getUserScope (§10-17-1) ──
  describe("getUserScope — UserScope 테이블 조회", () => {
    it("케이스 1: 스코프 없음 → { level:'COMPANY', scopeIds:[] } (초기 상태)", async () => {
      mockPrisma.userScope.findMany.mockResolvedValue([]);

      const scope = await getUserScope(USER_ID);

      expect(scope).toEqual({ level: "COMPANY", scopeIds: [] });
      expect(mockPrisma.userScope.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: { companyId: true, role: true },
      });
    });

    it("케이스 2: SYSTEM_ADMIN 포함 시 scopeIds=[] (전권 marker)", async () => {
      mockPrisma.userScope.findMany.mockResolvedValue([
        { companyId: COMPANY_A, role: "SYSTEM_ADMIN" },
        { companyId: COMPANY_B, role: "MEMBER" },
      ] as never);

      const scope = await getUserScope(USER_ID);

      expect(scope.level).toBe("COMPANY");
      expect(scope.scopeIds).toEqual([]); // 전권
    });

    it("케이스 3: COMPANY_ADMIN/MEMBER 조합 → scopeIds에 모든 companyId 포함", async () => {
      mockPrisma.userScope.findMany.mockResolvedValue([
        { companyId: COMPANY_A, role: "COMPANY_ADMIN" },
        { companyId: COMPANY_B, role: "MEMBER" },
      ] as never);

      const scope = await getUserScope(USER_ID);

      expect(scope.level).toBe("COMPANY");
      expect(scope.scopeIds).toEqual([COMPANY_A, COMPANY_B]);
    });
  });

  // ── 그룹 2: applyScopeFilter (§10-17-2) ──
  describe("applyScopeFilter — Prisma where 병합", () => {
    it("케이스 4: 전권(scopeIds=[]) → baseWhere 원본 반환 (no-op)", () => {
      const scope: UserScope = { level: "COMPANY", scopeIds: [] };
      const base = { status: "ACTIVE" };

      const result = applyScopeFilter(scope, base);

      expect(result).toEqual({ status: "ACTIVE" });
      expect(result).toBe(base); // 참조 동일
    });

    it("케이스 5: level=COMPANY → companyId: { in: scopeIds } 병합", () => {
      const scope: UserScope = { level: "COMPANY", scopeIds: [COMPANY_A, COMPANY_B] };
      const base = { status: "ACTIVE" };

      const result = applyScopeFilter(scope, base);

      expect(result).toEqual({
        status: "ACTIVE",
        companyId: { in: [COMPANY_A, COMPANY_B] },
      });
    });

    it("케이스 6: level=LOCATION → locationId: { in: scopeIds } 병합 (인터페이스 확인)", () => {
      const scope: UserScope = { level: "LOCATION", scopeIds: [LOCATION_A] };
      const base = { status: "ACTIVE" };

      const result = applyScopeFilter(scope, base);

      expect(result).toEqual({
        status: "ACTIVE",
        locationId: { in: [LOCATION_A] },
      });
    });

    it("케이스 7: level=PRODUCTION_LINE → productionLineId: { in: scopeIds } 병합 (인터페이스 확인)", () => {
      const scope: UserScope = { level: "PRODUCTION_LINE", scopeIds: [PROD_LINE_A] };
      const base = { status: "ACTIVE" };

      const result = applyScopeFilter(scope, base);

      expect(result).toEqual({
        status: "ACTIVE",
        productionLineId: { in: [PROD_LINE_A] },
      });
    });
  });

  // ── 그룹 3: assertScopeAccess (§10-17-3) ──
  describe("assertScopeAccess — 자원 스코프 검증", () => {
    it("케이스 8: 전권(scopeIds=[]) → 어떤 자원이든 통과", () => {
      const scope: UserScope = { level: "COMPANY", scopeIds: [] };

      expect(() =>
        assertScopeAccess(scope, { companyId: COMPANY_A }),
      ).not.toThrow();
    });

    it("케이스 9: 자원 companyId가 scopeIds에 포함 → 통과", () => {
      const scope: UserScope = { level: "COMPANY", scopeIds: [COMPANY_A] };

      expect(() =>
        assertScopeAccess(scope, { companyId: COMPANY_A }),
      ).not.toThrow();
    });

    it("케이스 10: 자원 companyId가 scopeIds에 미포함 → ScopeAccessDeniedError throw", () => {
      const scope: UserScope = { level: "COMPANY", scopeIds: [COMPANY_A] };

      expect(() =>
        assertScopeAccess(scope, { companyId: COMPANY_B }),
      ).toThrow(ScopeAccessDeniedError);
    });

    it("케이스 11: 대상 자원의 축 ID 누락 시 throw (level=COMPANY, resource에 companyId 없음)", () => {
      const scope: UserScope = { level: "COMPANY", scopeIds: [COMPANY_A] };

      expect(() =>
        assertScopeAccess(scope, { locationId: LOCATION_A }),
      ).toThrow(ScopeAccessDeniedError);
    });
  });

  // ── 그룹 4: 통합 시나리오 ──
  describe("통합 시나리오 (getUserScope → applyScopeFilter/assertScopeAccess)", () => {
    it("케이스 12: COMPANY_ADMIN 사용자가 다른 회사 자원 접근 시도 → assertScopeAccess에서 throw", async () => {
      mockPrisma.userScope.findMany.mockResolvedValue([
        { companyId: COMPANY_A, role: "COMPANY_ADMIN" },
      ] as never);

      const scope = await getUserScope(USER_ID);

      // 본인 회사 자원 → 통과
      expect(() =>
        assertScopeAccess(scope, { companyId: COMPANY_A }),
      ).not.toThrow();

      // 다른 회사 자원 → throw
      expect(() =>
        assertScopeAccess(scope, { companyId: COMPANY_B }),
      ).toThrow(ScopeAccessDeniedError);

      // applyScopeFilter도 정상 병합
      const filtered = applyScopeFilter(scope, { status: "ACTIVE" });
      expect(filtered).toEqual({
        status: "ACTIVE",
        companyId: { in: [COMPANY_A] },
      });
    });
  });
});
