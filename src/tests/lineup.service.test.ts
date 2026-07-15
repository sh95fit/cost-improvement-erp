// src/tests/lineup.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";
import {
  getLineups,
  getLineupById,
  createLineup,
  updateLineup,
  checkLineupDependencies,
  deleteLineup,
  // syncLineupLocations,    // ⚠️ 배제 (LineupLocationMap 미사용)
  // getLineupLocations,     // ⚠️ 배제
} from "@/features/lineup/services/lineup.service";

const COMPANY_ID = "company-1";
const LINEUP_ID = "lineup-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// getLineups
// ============================================================

describe("getLineups", () => {
  it("기본 정렬(sortOrder asc + name asc)로 회사 라인업 목록을 페이지네이션과 함께 반환한다", async () => {
    const items = [
      {
        id: "l1",
        name: "가정식도시락",
        code: "LINE-001",
        isActive: true,
        sortOrder: 0,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "l2",
        name: "프레시밀",
        code: "LINE-002",
        isActive: true,
        sortOrder: 1,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockPrisma.lineup.findMany.mockResolvedValue(items);
    mockPrisma.lineup.count.mockResolvedValue(2);

    const result = await getLineups(COMPANY_ID, {
      page: 1,
      limit: 20,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    expect(mockPrisma.lineup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          deletedAt: null,
        }),
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: 0,
        take: 20,
      })
    );
    expect(result.items).toEqual(items);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it("search 키워드가 있으면 name/code OR insensitive 조건을 추가한다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 20,
      search: "도시락",
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    expect(mockPrisma.lineup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "도시락", mode: "insensitive" } },
            { code: { contains: "도시락", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("isActive=true 필터가 적용되면 where에 isActive: true가 포함된다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 20,
      isActive: true,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    expect(mockPrisma.lineup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("isActive=false 필터가 적용되면 where에 isActive: false가 포함된다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 20,
      isActive: false,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    expect(mockPrisma.lineup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it("isActive가 undefined면 where에 isActive 조건이 포함되지 않는다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 20,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    const callArg = mockPrisma.lineup.findMany.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty("isActive");
  });

  it("sortBy=name이면 orderBy가 단일 객체로 [{ name: order }]로 전달된다", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(0);

    await getLineups(COMPANY_ID, {
      page: 1,
      limit: 20,
      sortBy: "name",
      sortOrder: "desc",
    });

    expect(mockPrisma.lineup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: "desc" }],
      })
    );
  });

  it("페이지네이션이 정확히 계산된다 (page=3, limit=10 → skip=20)", async () => {
    mockPrisma.lineup.findMany.mockResolvedValue([]);
    mockPrisma.lineup.count.mockResolvedValue(35);

    const result = await getLineups(COMPANY_ID, {
      page: 3,
      limit: 10,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    expect(mockPrisma.lineup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 35,
      totalPages: 4,
    });
  });
});

// ============================================================
// getLineupById
// ============================================================

describe("getLineupById", () => {
  it("회사 소속의 활성 라인업을 반환한다", async () => {
    const lineup = {
      id: LINEUP_ID,
      name: "가정식도시락",
      code: "LINE-001",
      isActive: true,
      sortOrder: 0,
      description: null,
    };
    mockPrisma.lineup.findFirst.mockResolvedValue(lineup);

    const result = await getLineupById(COMPANY_ID, LINEUP_ID);

    expect(mockPrisma.lineup.findFirst).toHaveBeenCalledWith({
      where: { id: LINEUP_ID, companyId: COMPANY_ID, deletedAt: null },
    });
    expect(result).toEqual(lineup);
  });

  it("찾을 수 없으면 null을 반환한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    const result = await getLineupById(COMPANY_ID, "non-existent");

    expect(result).toBeNull();
  });
});

// ============================================================
// createLineup
// ============================================================

describe("createLineup", () => {
  it("기존 코드가 없을 때 LINE-001로 생성한다", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const created = {
      id: "new-id",
      companyId: COMPANY_ID,
      name: "가정식도시락",
      code: "LINE-001",
      isActive: true,
      sortOrder: 0,
      description: null,
    };
    mockPrisma.lineup.create.mockResolvedValue(created);

    const result = await createLineup(COMPANY_ID, {
      name: "가정식도시락",
      isActive: true,
      sortOrder: 0,
      description: null,
    });

    expect(mockPrisma.lineup.create).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY_ID,
        name: "가정식도시락",
        code: "LINE-001",
        isActive: true,
        sortOrder: 0,
        description: null,
      },
    });
    expect(result).toEqual(created);
  });

  it("기존 코드가 LINE-005이면 LINE-006으로 증가시킨다", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ code: "LINE-005" }]);
    mockPrisma.lineup.create.mockResolvedValue({
      id: "new-id",
      code: "LINE-006",
    });

    await createLineup(COMPANY_ID, {
      name: "프레시밀",
      isActive: true,
      sortOrder: 0,
      description: null,
    });

    expect(mockPrisma.lineup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "LINE-006" }),
      })
    );
  });

  it("입력에 description이 있으면 그대로 저장한다", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.lineup.create.mockResolvedValue({ id: "new-id" });

    await createLineup(COMPANY_ID, {
      name: "특식",
      isActive: false,
      sortOrder: 99,
      description: "프리미엄 라인업",
    });

    expect(mockPrisma.lineup.create).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY_ID,
        name: "특식",
        code: "LINE-001",
        isActive: false,
        sortOrder: 99,
        description: "프리미엄 라인업",
      },
    });
  });
});

// ============================================================
// updateLineup
// ============================================================

describe("updateLineup", () => {
  it("존재하면 입력된 필드만 update한다 (name)", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineup.update.mockResolvedValue({
      id: LINEUP_ID,
      name: "가정식도시락 (수정)",
    });

    await updateLineup(COMPANY_ID, LINEUP_ID, {
      name: "가정식도시락 (수정)",
    });

    expect(mockPrisma.lineup.update).toHaveBeenCalledWith({
      where: { id: LINEUP_ID },
      data: { name: "가정식도시락 (수정)" },
    });
  });

  it("isActive와 sortOrder만 변경할 수 있다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineup.update.mockResolvedValue({ id: LINEUP_ID });

    await updateLineup(COMPANY_ID, LINEUP_ID, {
      isActive: false,
      sortOrder: 5,
    });

    expect(mockPrisma.lineup.update).toHaveBeenCalledWith({
      where: { id: LINEUP_ID },
      data: { isActive: false, sortOrder: 5 },
    });
  });

  it("description: null이면 null로 명시 update한다 (clear)", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineup.update.mockResolvedValue({ id: LINEUP_ID });

    await updateLineup(COMPANY_ID, LINEUP_ID, {
      description: null,
    });

    expect(mockPrisma.lineup.update).toHaveBeenCalledWith({
      where: { id: LINEUP_ID },
      data: { description: null },
    });
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      updateLineup(COMPANY_ID, "non-existent", { name: "x" })
    ).rejects.toThrow("NOT_FOUND");
    expect(mockPrisma.lineup.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// checkLineupDependencies
// ============================================================

describe("checkLineupDependencies", () => {
  it("모든 의존성이 0이면 canDelete=true를 반환한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealPlan.count.mockResolvedValue(0);
    mockPrisma.mealCount.count.mockResolvedValue(0);

    const result = await checkLineupDependencies(COMPANY_ID, LINEUP_ID);

    expect(result).toEqual({
      canDelete: true,
      reasons: [],
      counts: { mealPlans: 0, mealCounts: 0 },
    });
  });

  it("mealPlan이 있으면 canDelete=false + 한글 사유 메시지를 포함한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealPlan.count.mockResolvedValue(3);
    mockPrisma.mealCount.count.mockResolvedValue(0);

    const result = await checkLineupDependencies(COMPANY_ID, LINEUP_ID);

    expect(result.canDelete).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("식단");
    expect(result.reasons[0]).toContain("3");
  });

  it("여러 의존성이 동시에 있으면 모든 사유를 반환한다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealPlan.count.mockResolvedValue(2);
    mockPrisma.mealCount.count.mockResolvedValue(5);

    const result = await checkLineupDependencies(COMPANY_ID, LINEUP_ID);

    expect(result.canDelete).toBe(false);
    expect(result.reasons).toHaveLength(2);
    expect(result.counts).toEqual({
      mealPlans: 2,
      mealCounts: 5,
    });
  });

  it("라인업이 존재하지 않으면 NOT_FOUND를 던진다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      checkLineupDependencies(COMPANY_ID, "non-existent")
    ).rejects.toThrow("NOT_FOUND");
  });
});

// ============================================================
// deleteLineup
// ============================================================

describe("deleteLineup", () => {
  it("의존성 없으면 lineup을 soft-delete 한다", async () => {
    // checkLineupDependencies 내부 호출
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealPlan.count.mockResolvedValue(0);
    mockPrisma.mealCount.count.mockResolvedValue(0);

    mockPrisma.lineup.update.mockResolvedValue({
      id: LINEUP_ID,
      deletedAt: new Date(),
    });

    await deleteLineup(COMPANY_ID, LINEUP_ID);

    // lineup soft delete 호출 확인
    expect(mockPrisma.lineup.update).toHaveBeenCalledWith({
      where: { id: LINEUP_ID },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("의존성이 있으면 DEPENDENCY_EXISTS 에러를 던지고 update를 호출하지 않는다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealPlan.count.mockResolvedValue(1);
    mockPrisma.mealCount.count.mockResolvedValue(0);

    await expect(deleteLineup(COMPANY_ID, LINEUP_ID)).rejects.toThrow(
      "DEPENDENCY_EXISTS"
    );

    expect(mockPrisma.lineup.update).not.toHaveBeenCalled();
  });

  it("라인업이 존재하지 않으면 NOT_FOUND를 던진다", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(deleteLineup(COMPANY_ID, "non-existent")).rejects.toThrow(
      "NOT_FOUND"
    );
  });
});


// ============================================================
// ⚠️ LineupLocationMap 관련 테스트 — 모델 배제로 skip
//    향후 모델 복원 시 .skip 제거하여 재활성화
// ============================================================

describe.skip("syncLineupLocations (배제됨 — LineupLocationMap 미사용)", () => {
  it("placeholder", () => {
    // 향후 복원 시 기존 테스트 케이스 복원:
    //   - 라인업이 존재하지 않으면 NOT_FOUND
    //   - locationIds가 다른 회사 소속이면 INVALID_LOCATION
    //   - diff 기반 add/remove 정상 수행
    expect(true).toBe(true);
  });
});

describe.skip("getLineupLocations (배제됨 — LineupLocationMap 미사용)", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
