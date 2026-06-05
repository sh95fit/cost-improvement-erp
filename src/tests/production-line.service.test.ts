import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import * as plService from "@/features/production-line/services/production-line.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productionLine: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    location: { findFirst: vi.fn(), findMany: vi.fn() },
    cookingPlan: { count: vi.fn() },
    mealPlanSlot: { count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const COMPANY_ID = "company-1";
const LOC_ID = "loc-1";
const PL_ID = "pl-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductionLine service", () => {
  describe("createProductionLine - 위치 검증", () => {
    it("WAREHOUSE 위치 선택 시 LOCATION_NOT_FACTORY throw", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({
        id: LOC_ID,
        type: "WAREHOUSE",
        isActive: true,
      });

      await expect(
        plService.createProductionLine(COMPANY_ID, {
          locationId: LOC_ID,
          name: "A라인",
          status: "ACTIVE",
          sortOrder: 0,
          note: null,
        })
      ).rejects.toThrow("LOCATION_NOT_FACTORY");
    });

    it("미존재 위치 시 LOCATION_NOT_FOUND throw", async () => {
      (prisma.location.findFirst as any).mockResolvedValue(null);

      await expect(
        plService.createProductionLine(COMPANY_ID, {
          locationId: "missing",
          name: "A라인",
          status: "ACTIVE",
          sortOrder: 0,
          note: null,
        })
      ).rejects.toThrow("LOCATION_NOT_FOUND");
    });

    it("비활성 위치 시 LOCATION_INACTIVE throw", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({
        id: LOC_ID,
        type: "FACTORY",
        isActive: false,
      });

      await expect(
        plService.createProductionLine(COMPANY_ID, {
          locationId: LOC_ID,
          name: "A라인",
          status: "ACTIVE",
          sortOrder: 0,
          note: null,
        })
      ).rejects.toThrow("LOCATION_INACTIVE");
    });

    it("FACTORY 위치 시 자동채번 PL-001 생성", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({
        id: LOC_ID,
        type: "FACTORY",
        isActive: true,
      });
      (prisma.$queryRaw as any).mockResolvedValue([]);
      (prisma.productionLine.create as any).mockImplementation((args: any) => ({
        id: PL_ID,
        ...args.data,
      }));

      const result = await plService.createProductionLine(COMPANY_ID, {
        locationId: LOC_ID,
        name: "A라인",
        status: "ACTIVE",
        sortOrder: 0,
        note: null,
      });

      expect(result.code).toBe("PL-001");
    });

    it("HYBRID 위치도 허용", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({
        id: LOC_ID,
        type: "HYBRID",
        isActive: true,
      });
      (prisma.$queryRaw as any).mockResolvedValue([{ code: "PL-007" }]);
      (prisma.productionLine.create as any).mockImplementation((args: any) => ({
        id: PL_ID,
        ...args.data,
      }));

      const result = await plService.createProductionLine(COMPANY_ID, {
        locationId: LOC_ID,
        name: "B라인",
        status: "ACTIVE",
        sortOrder: 0,
        note: null,
      });

      expect(result.code).toBe("PL-008");
    });
  });

  describe("checkProductionLineDependencies", () => {
    it("CookingPlan 의존성 차단", async () => {
      (prisma.productionLine.findFirst as any).mockResolvedValue({ id: PL_ID });
      (prisma.cookingPlan.count as any).mockResolvedValue(2);
      (prisma.mealPlanSlot.count as any).mockResolvedValue(0);

      const result = await plService.checkProductionLineDependencies(
        COMPANY_ID,
        PL_ID
      );

      expect(result.canDelete).toBe(false);
      expect(result.reasons[0]).toContain("작업지시서 2건");
    });

    it("MealPlanSlot 의존성 차단", async () => {
      (prisma.productionLine.findFirst as any).mockResolvedValue({ id: PL_ID });
      (prisma.cookingPlan.count as any).mockResolvedValue(0);
      (prisma.mealPlanSlot.count as any).mockResolvedValue(5);

      const result = await plService.checkProductionLineDependencies(
        COMPANY_ID,
        PL_ID
      );

      expect(result.canDelete).toBe(false);
      expect(result.reasons[0]).toContain("식단 슬롯 5건");
    });
  });

  describe("getFactoryLocationOptions", () => {
    it("WAREHOUSE 제외, FACTORY/HYBRID만 반환", async () => {
      (prisma.location.findMany as any).mockResolvedValue([
        { id: "loc-1", code: "LOC-001", name: "1공장", type: "FACTORY" },
      ]);

      await plService.getFactoryLocationOptions(COMPANY_ID);

      const where = (prisma.location.findMany as any).mock.calls[0][0].where;
      expect(where.type).toEqual({ in: ["FACTORY", "HYBRID"] });
      expect(where.isActive).toBe(true);
      expect(where.deletedAt).toBeNull();
    });
  });
});
