import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLocationOptions } from "@/features/location/services/location.service";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

const COMPANY_ID = "co_1";

const baseItems = [
  { id: "loc_1", code: "LOC-001", name: "본공장", type: "FACTORY" },
  { id: "loc_2", code: "LOC-002", name: "중앙창고", type: "WAREHOUSE" },
  { id: "loc_3", code: "LOC-003", name: "하이브리드센터", type: "HYBRID" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue(baseItems);
});

describe("getLocationOptions (S4-1-c)", () => {
  it("types 미지정: 전체 활성 Location 반환 (isActive=true 조건)", async () => {
    const result = await getLocationOptions(COMPANY_ID);
    expect(result).toEqual(baseItems);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          deletedAt: null,
          isActive: true,
        }),
      })
    );
  });

  it("types=['FACTORY','HYBRID'] (JIT용): type in 필터 적용", async () => {
    await getLocationOptions(COMPANY_ID, {
      types: ["FACTORY", "HYBRID"],
      includeInactive: false,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["FACTORY", "HYBRID"] },
        }),
      })
    );
  });

  it("types=['FACTORY','WAREHOUSE','HYBRID'] (SK용): 세 타입 모두 조회", async () => {
    await getLocationOptions(COMPANY_ID, {
      types: ["FACTORY", "WAREHOUSE", "HYBRID"],
      includeInactive: false,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["FACTORY", "WAREHOUSE", "HYBRID"] },
        }),
      })
    );
  });

  it("includeInactive=true: isActive 조건 미적용", async () => {
    await getLocationOptions(COMPANY_ID, { includeInactive: true });
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.isActive).toBeUndefined();
    expect(call.where.deletedAt).toBeNull();
  });

  it("정렬: sortOrder asc → name asc", async () => {
    await getLocationOptions(COMPANY_ID);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    );
  });

  it("select: id/code/name/type 만 반환 (Location 전체 노출 방지)", async () => {
    await getLocationOptions(COMPANY_ID);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, code: true, name: true, type: true },
      })
    );
  });
});
