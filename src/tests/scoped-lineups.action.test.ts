/**
 * S4-3-c-R6-B-3: getScopedLineupsForConsumptionAction 테스트
 * 감사서 근거:
 *   - §10-14 (Layer B lineupId non-null, R6-B-3 라인업 선택)
 *   - §10-17 (R7-a 스코프 유틸 통합)
 * 상위 커밋: 1fe1ff6 (R7-a)
 *
 * 검증 대상:
 *   1) 전권 사용자 → 스코프 필터 no-op, MaterialRequirement distinct 결과 정상 매핑
 *   2) COMPANY_ADMIN → where.companyId 에 { in: scopeIds } 병합
 *   3) empty result → 빈 배열 정상 반환
 *   4) targetDate 형식 오류 → VALIDATION
 *   5) permission 없음 → error (handleActionError 경로)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// ─── mocks (import 전 hoisting) ───
vi.mock("@/lib/auth/session", () => ({
  requireCompanySession: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({
  assertPermission: vi.fn(),
  assertScope: vi.fn(),
}));

import { getScopedLineupsForConsumptionAction } from "@/features/lineup/actions/lineup.action";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";

// ─── 상수 ───
const USER_ID = "usr_test";
const COMPANY_ID = "cmp_test";
const LOCATION_ID = "loc_test";
const TARGET_DATE = "2026-07-24";
const LINEUP_A = "lineup_a";
const LINEUP_B = "lineup_b";
const PROD_LINE_A = "pline_a";
const PROD_LINE_B = "pline_b";

// ─── Helper: 세션 mock 세팅 ───
function setSession() {
  vi.mocked(requireCompanySession).mockResolvedValue({
    userId: USER_ID,
    companyId: COMPANY_ID,
  } as never);
}

// ─── Helper: findMany 반환 행 factory ───
function makeRow(
  lineupId: string,
  productionLineId: string,
  lineupName = "라인업A",
  productionLineName = "라인A",
) {
  return {
    lineupId,
    productionLineId,
    lineup: {
      id: lineupId,
      name: lineupName,
      code: `LN-${lineupId}`,
      sortOrder: 1,
    },
    productionLine: { id: productionLineId, name: productionLineName },
  };
}

describe("getScopedLineupsForConsumptionAction (S4-3-c-R6-B-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession();
  });

  // ── 케이스 1: 전권 사용자 → distinct 결과 정상 매핑 ──
  it("케이스 1: 전권 사용자 → MaterialRequirement distinct 결과 정상 반환", async () => {
    mockPrisma.userScope.findMany.mockResolvedValue([] as never); // 전권 marker
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeRow(LINEUP_A, PROD_LINE_A, "라인업A", "라인A"),
      makeRow(LINEUP_B, PROD_LINE_B, "라인업B", "라인B"),
    ] as never);

    const result = await getScopedLineupsForConsumptionAction(
      TARGET_DATE,
      LOCATION_ID,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      lineupId: LINEUP_A,
      lineupName: "라인업A",
      lineupCode: `LN-${LINEUP_A}`,
      productionLineId: PROD_LINE_A,
      productionLineName: "라인A",
    });
    expect(result.data[1].lineupId).toBe(LINEUP_B);
  });

  // ── 케이스 2: COMPANY_ADMIN → where.companyId 병합 확인 ──
  it("케이스 2: COMPANY_ADMIN → where.companyId 에 { in: [companyId] } 병합", async () => {
    mockPrisma.userScope.findMany.mockResolvedValue([
      { companyId: COMPANY_ID, role: "COMPANY_ADMIN" },
    ] as never);
    mockPrisma.materialRequirement.findMany.mockResolvedValue([
      makeRow(LINEUP_A, PROD_LINE_A),
    ] as never);

    const result = await getScopedLineupsForConsumptionAction(
      TARGET_DATE,
      LOCATION_ID,
    );

    expect(result.success).toBe(true);

    // findMany 호출 인자 검증: where.companyId 가 { in: [COMPANY_ID] } 로 병합됨
    const call = mockPrisma.materialRequirement.findMany.mock.calls[0][0];
    expect(call.where.companyId).toEqual({ in: [COMPANY_ID] });
    expect(call.where.locationId).toBe(LOCATION_ID);
    expect(call.where.lineupId).toEqual({ not: null });
    expect(call.distinct).toEqual(["lineupId", "productionLineId"]);
  });

  // ── 케이스 3: empty result → 빈 배열 반환 ──
  it("케이스 3: MaterialRequirement 결과 없음 → 빈 배열 정상 반환", async () => {
    mockPrisma.userScope.findMany.mockResolvedValue([] as never);
    mockPrisma.materialRequirement.findMany.mockResolvedValue([] as never);

    const result = await getScopedLineupsForConsumptionAction(
      TARGET_DATE,
      LOCATION_ID,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });

  // ── 케이스 4: targetDate 형식 오류 → VALIDATION ──
  it("케이스 4: targetDate 형식 오류 → VALIDATION error", async () => {
    const result = await getScopedLineupsForConsumptionAction(
      "2026/07/24", // 구분자 자체가 regex 불일치 (/^\d{4}-\d{2}-\d{2}$/)
      LOCATION_ID,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("VALIDATION");
    // findMany 는 호출되지 않아야 함
    expect(mockPrisma.materialRequirement.findMany).not.toHaveBeenCalled();
  });

  // ── 케이스 5: permission 없음 → handleActionError 경로 ──
  it("케이스 5: assertPermission throw → success:false 반환", async () => {
    vi.mocked(assertPermission).mockImplementation(() => {
      const err = new Error("PERMISSION_DENIED");
      err.name = "PermissionDeniedError";
      throw err;
    });

    const result = await getScopedLineupsForConsumptionAction(
      TARGET_DATE,
      LOCATION_ID,
    );

    expect(result.success).toBe(false);
    expect(mockPrisma.materialRequirement.findMany).not.toHaveBeenCalled();
  });
});
