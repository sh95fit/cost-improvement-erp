// src/tests/lineup.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getLineups,
  getLineupById,
  createLineup,
  updateLineup,
  deleteLineup,
  checkLineupDependencies,
  syncLineupLocations,
  getLineupLocations,
} from "@/features/lineup/services/lineup.service";

const COMPANY_ID = "company-001";

const mockLineup = {
  id: "lineup-001",
  companyId: COMPANY_ID,
  name: "A라인 한식",
  code: "LINE-001",
  createdAt: new Date("2026-05-27"),
  updatedAt: new Date("2026-05-27"),
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════
// getLineups
// ════════════════════════════════════════

describe("getLineups", () => {
  it("deletedAt: null 조건과 함께 목록을 반환한다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([mockLineup]);
    mockPrisma.lineup.count.mockResolvedValue(1);

    const result = await getLineups(COMPANY_ID, {
      page: 1,
      limit: 100,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination.total).toBe(1);

    const whereArg = mockPrisma.lineup.findMany.mock.calls[0][0].where;
    expect(whereArg.deletedAt).toBeNull();
    expect(whereArg.companyId).toBe(COMPANY_ID);
  });

  it("검색어가 있으면 OR 조건에 포함한다 (name, code)", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 100,
      search: "한식",
      sortBy: "name",
      sortOrder: "asc",
    });

    const whereArg = mockPrisma.lineup.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.OR).toHaveLength(2);
  });

  it("페이지네이션이 정확히 계산된다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(250);

    const result = await getLineups(COMPANY_ID, {
      page: 2,
      limit: 100,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 100,
      total: 250,
      totalPages: 3,
    });
    const args = mockPrisma.lineup.findMany.mock.calls[0][0];
    expect(args.skip).toBe(100);
    expect(args.take).toBe(100);
  });

  it("locationMaps 카운트를 select에 포함한다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 100,
      sortBy: "name",
      sortOrder: "asc",
    });

    const selectArg = mockPrisma.lineup.findMany.mock.calls[0][0].select;
    expect(selectArg._count.select.locationMaps).toBe(true);
  });
});

// ════════════════════════════════════════
// getLineupById
// ════════════════════════════════════════

describe("getLineupById", () => {
  it("locationMaps + templateMaps include로 단건 조회한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({
      ...mockLineup,
      locationMaps: [],
      templateMaps: [],
    });

    const result = await getLineupById(COMPANY_ID, "lineup-001");

    expect(result?.id).toBe("lineup-001");
    const args = mockPrisma.lineup.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      id: "lineup-001",
      companyId: COMPANY_ID,
      deletedAt: null,
    });
    expect(args.include.locationMaps).toBeDefined();
    expect(args.include.templateMaps).toBeDefined();
    // templateMaps에는 deletedAt: null 조건이 적용되어야 함
    expect(args.include.templateMaps.where).toEqual({ deletedAt: null });
  });

  it("존재하지 않으면 null을 반환한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);
    const result = await getLineupById(COMPANY_ID, "nonexistent");
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════
// createLineup (코드 자동 채번)
// ════════════════════════════════════════

describe("createLineup", () => {
  it("기존 라인업이 없으면 LINE-001로 채번한다", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.lineup.create.mockResolvedValue({
      ...mockLineup,
      code: "LINE-001",
    });

    const result = await createLineup(COMPANY_ID, { name: "A라인 한식" });

    expect(result.code).toBe("LINE-001");
    const data = mockPrisma.lineup.create.mock.calls[0][0].data;
    expect(data.code).toBe("LINE-001");
    expect(data.companyId).toBe(COMPANY_ID);
    expect(data.name).toBe("A라인 한식");
  });

  it("기존 최대 코드 +1로 채번한다", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ code: "LINE-007" }]);
    mockPrisma.lineup.create.mockResolvedValue({
      ...mockLineup,
      code: "LINE-008",
    });

    await createLineup(COMPANY_ID, { name: "B라인" });

    const data = mockPrisma.lineup.create.mock.calls[0][0].data;
    expect(data.code).toBe("LINE-008");
  });

  it("3자리 zero-padding 형식을 유지한다", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ code: "LINE-099" }]);
    mockPrisma.lineup.create.mockResolvedValue({
      ...mockLineup,
      code: "LINE-100",
    });

    await createLineup(COMPANY_ID, { name: "C라인" });

    const data = mockPrisma.lineup.create.mock.calls[0][0].data;
    expect(data.code).toBe("LINE-100");
  });
});

// ════════════════════════════════════════
// updateLineup
// ════════════════════════════════════════

describe("updateLineup", () => {
  it("존재하는 라인업을 수정한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.lineup.update.mockResolvedValue({
      ...mockLineup,
      name: "수정된 이름",
    });

    const result = await updateLineup(COMPANY_ID, "lineup-001", {
      name: "수정된 이름",
    });

    expect(result.name).toBe("수정된 이름");
    expect(mockPrisma.lineup.update).toHaveBeenCalledWith({
      where: { id: "lineup-001" },
      data: { name: "수정된 이름" },
    });
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      updateLineup(COMPANY_ID, "nonexistent", { name: "x" })
    ).rejects.toThrow("NOT_FOUND");
    expect(mockPrisma.lineup.update).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════
// checkLineupDependencies
// ════════════════════════════════════════

describe("checkLineupDependencies", () => {
  it("의존성이 없으면 canDelete: true 반환", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.mealPlan.count.mockResolvedValue(0);
    mockPrisma.mealCount.count.mockResolvedValue(0);
    mockPrisma.shippingOrder.count = vi.fn().mockResolvedValue(0);

    const result = await checkLineupDependencies(COMPANY_ID, "lineup-001");

    expect(result.canDelete).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.counts).toEqual({
      mealPlans: 0,
      mealCounts: 0,
      shippingOrders: 0,
    });
  });

  it("활성 mealPlans가 있으면 canDelete: false + 사유 포함", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.mealPlan.count.mockResolvedValue(3);
    mockPrisma.mealCount.count.mockResolvedValue(0);
    mockPrisma.shippingOrder.count = vi.fn().mockResolvedValue(0);

    const result = await checkLineupDependencies(COMPANY_ID, "lineup-001");

    expect(result.canDelete).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain("식단 3건");
    expect(result.counts.mealPlans).toBe(3);
  });

  it("mealPlan.count 호출 시 deletedAt: null 조건을 포함한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.mealPlan.count.mockResolvedValue(0);
    mockPrisma.mealCount.count.mockResolvedValue(0);
    mockPrisma.shippingOrder.count = vi.fn().mockResolvedValue(0);

    await checkLineupDependencies(COMPANY_ID, "lineup-001");

    const mealPlanWhere = mockPrisma.mealPlan.count.mock.calls[0][0].where;
    expect(mealPlanWhere.deletedAt).toBeNull();
    expect(mealPlanWhere.lineupId).toBe("lineup-001");

    const mealCountWhere = mockPrisma.mealCount.count.mock.calls[0][0].where;
    expect(mealCountWhere.deletedAt).toBeNull();
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      checkLineupDependencies(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });
});

// ════════════════════════════════════════
// deleteLineup
// ════════════════════════════════════════

describe("deleteLineup", () => {
  it("의존성 없으면 트랜잭션으로 soft-delete 처리", async () => {
    // checkLineupDependencies 통과
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.mealPlan.count.mockResolvedValue(0);
    mockPrisma.mealCount.count.mockResolvedValue(0);
    mockPrisma.shippingOrder.count = vi.fn().mockResolvedValue(0);

    mockPrisma.lineupLocationMap.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.lineupMealTemplateMap.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.lineup.update.mockResolvedValue({
      ...mockLineup,
      deletedAt: new Date(),
    });

    await deleteLineup(COMPANY_ID, "lineup-001");

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    // locationMap은 hard delete
    expect(mockPrisma.lineupLocationMap.deleteMany).toHaveBeenCalledWith({
      where: { lineupId: "lineup-001" },
    });
    // templateMap은 soft delete (활성 행만)
    const tmplArgs = mockPrisma.lineupMealTemplateMap.updateMany.mock.calls[0][0];
    expect(tmplArgs.where).toEqual({
      lineupId: "lineup-001",
      deletedAt: null,
    });
    expect(tmplArgs.data.deletedAt).toBeInstanceOf(Date);
    // lineup 본체 soft delete
    const lineupArgs = mockPrisma.lineup.update.mock.calls[0][0];
    expect(lineupArgs.where).toEqual({ id: "lineup-001" });
    expect(lineupArgs.data.deletedAt).toBeInstanceOf(Date);
  });

  it("의존성 있으면 DEPENDENCY_EXISTS 에러를 던지고 update를 호출하지 않는다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.mealPlan.count.mockResolvedValue(5);
    mockPrisma.mealCount.count.mockResolvedValue(0);
    mockPrisma.shippingOrder.count = vi.fn().mockResolvedValue(0);

    await expect(deleteLineup(COMPANY_ID, "lineup-001")).rejects.toThrow(
      "DEPENDENCY_EXISTS"
    );
    expect(mockPrisma.lineup.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(deleteLineup(COMPANY_ID, "nonexistent")).rejects.toThrow(
      "NOT_FOUND"
    );
  });
});

// ════════════════════════════════════════
// syncLineupLocations
// ════════════════════════════════════════

describe("syncLineupLocations", () => {
  it("추가/제거 diff에 따라 createMany / deleteMany 호출", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    // location 소속 검증 통과
    mockPrisma.location.findMany.mockResolvedValue([
      { id: "loc-A" },
      { id: "loc-B" },
    ]);
    // 기존 매핑: loc-A, loc-C (→ loc-C 제거, loc-B 추가)
    mockPrisma.lineupLocationMap.findMany
      .mockResolvedValueOnce([
        { id: "map-1", locationId: "loc-A" },
        { id: "map-2", locationId: "loc-C" },
      ])
      // 최종 반환용 findMany
      .mockResolvedValueOnce([
        { id: "map-1", locationId: "loc-A", location: { id: "loc-A", name: "A", code: "L-A" } },
        { id: "map-3", locationId: "loc-B", location: { id: "loc-B", name: "B", code: "L-B" } },
      ]);
    mockPrisma.lineupLocationMap.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.lineupLocationMap.createMany.mockResolvedValue({ count: 1 });

    const result = await syncLineupLocations(COMPANY_ID, "lineup-001", {
      locationIds: ["loc-A", "loc-B"],
    });

    // 제거: loc-C → map-2
    const removeArgs = mockPrisma.lineupLocationMap.deleteMany.mock.calls[0][0];
    expect(removeArgs.where.id.in).toEqual(["map-2"]);
    // 추가: loc-B
    const addArgs = mockPrisma.lineupLocationMap.createMany.mock.calls[0][0];
    expect(addArgs.data).toEqual([{ lineupId: "lineup-001", locationId: "loc-B" }]);

    expect(result).toHaveLength(2);
  });

  it("매핑이 동일하면 createMany / deleteMany 둘 다 호출되지 않는다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.location.findMany.mockResolvedValue([{ id: "loc-A" }]);
    mockPrisma.lineupLocationMap.findMany
      .mockResolvedValueOnce([{ id: "map-1", locationId: "loc-A" }])
      .mockResolvedValueOnce([
        { id: "map-1", locationId: "loc-A", location: { id: "loc-A", name: "A", code: "L-A" } },
      ]);

    await syncLineupLocations(COMPANY_ID, "lineup-001", {
      locationIds: ["loc-A"],
    });

    expect(mockPrisma.lineupLocationMap.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.lineupLocationMap.createMany).not.toHaveBeenCalled();
  });

  it("빈 배열 입력 시 모든 매핑이 제거된다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.lineupLocationMap.findMany
      .mockResolvedValueOnce([
        { id: "map-1", locationId: "loc-A" },
        { id: "map-2", locationId: "loc-B" },
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.lineupLocationMap.deleteMany.mockResolvedValue({ count: 2 });

    const result = await syncLineupLocations(COMPANY_ID, "lineup-001", {
      locationIds: [],
    });

    const removeArgs = mockPrisma.lineupLocationMap.deleteMany.mock.calls[0][0];
    expect(removeArgs.where.id.in.sort()).toEqual(["map-1", "map-2"]);
    expect(mockPrisma.lineupLocationMap.createMany).not.toHaveBeenCalled();
    // location.findMany는 빈 배열일 때 호출되지 않아야 함
    expect(mockPrisma.location.findMany).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it("locationIds 중복은 제거된다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.location.findMany.mockResolvedValue([{ id: "loc-A" }]);
    mockPrisma.lineupLocationMap.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.lineupLocationMap.createMany.mockResolvedValue({ count: 1 });

    await syncLineupLocations(COMPANY_ID, "lineup-001", {
      locationIds: ["loc-A", "loc-A", "loc-A"],
    });

    const addArgs = mockPrisma.lineupLocationMap.createMany.mock.calls[0][0];
    expect(addArgs.data).toHaveLength(1);
  });

  it("다른 회사 location 포함 시 INVALID_LOCATION 에러", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    // 1개만 valid, 1개는 다른 회사 소속
    mockPrisma.location.findMany.mockResolvedValue([{ id: "loc-A" }]);

    await expect(
      syncLineupLocations(COMPANY_ID, "lineup-001", {
        locationIds: ["loc-A", "loc-OTHER"],
      })
    ).rejects.toThrow("INVALID_LOCATION");
  });

  it("라인업이 존재하지 않으면 NOT_FOUND 에러", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      syncLineupLocations(COMPANY_ID, "nonexistent", { locationIds: [] })
    ).rejects.toThrow("NOT_FOUND");
  });
});

// ════════════════════════════════════════
// getLineupLocations
// ════════════════════════════════════════

describe("getLineupLocations", () => {
  it("매핑을 location include로 조회한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: "lineup-001" });
    mockPrisma.lineupLocationMap.findMany.mockResolvedValue([
      { id: "map-1", lineupId: "lineup-001", locationId: "loc-A", location: { id: "loc-A", name: "A", code: "L-A" } },
    ]);

    const result = await getLineupLocations(COMPANY_ID, "lineup-001");

    expect(result).toHaveLength(1);
    const args = mockPrisma.lineupLocationMap.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ lineupId: "lineup-001" });
    expect(args.include.location).toBeDefined();
  });

  it("존재하지 않으면 NOT_FOUND", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);
    await expect(
      getLineupLocations(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });
});
