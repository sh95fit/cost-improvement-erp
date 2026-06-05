import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import * as locationService from "@/features/location/services/location.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productionLine: { count: vi.fn() },
    inventoryLot: { count: vi.fn() },
    inventoryTransaction: { count: vi.fn() },
    stockTake: { count: vi.fn() },
    inventoryTransfer: { count: vi.fn() },
    shippingOrder: { count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const COMPANY_ID = "company-1";
const LOC_ID = "loc-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Location service", () => {
  describe("createLocation - 자동채번", () => {
    it("기존 코드 없으면 LOC-001 생성", async () => {
      (prisma.$queryRaw as any).mockResolvedValue([]);
      (prisma.location.create as any).mockImplementation((args: any) => ({
        id: LOC_ID,
        ...args.data,
      }));

      const result = await locationService.createLocation(COMPANY_ID, {
        name: "1공장",
        type: "FACTORY",
        address: null,
        note: null,
        isActive: true,
        sortOrder: 0,
      });

      expect(result.code).toBe("LOC-001");
    });

    it("기존 LOC-003 있으면 LOC-004 생성", async () => {
      (prisma.$queryRaw as any).mockResolvedValue([{ code: "LOC-003" }]);
      (prisma.location.create as any).mockImplementation((args: any) => ({
        id: LOC_ID,
        ...args.data,
      }));

      const result = await locationService.createLocation(COMPANY_ID, {
        name: "2공장",
        type: "WAREHOUSE",
        address: null,
        note: null,
        isActive: true,
        sortOrder: 0,
      });

      expect(result.code).toBe("LOC-004");
    });
  });

  describe("updateLocation", () => {
    it("존재하지 않으면 NOT_FOUND throw", async () => {
      (prisma.location.findFirst as any).mockResolvedValue(null);

      await expect(
        locationService.updateLocation(COMPANY_ID, "missing", {
          name: "변경",
        })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("부분 필드만 갱신", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({ id: LOC_ID });
      (prisma.location.update as any).mockResolvedValue({
        id: LOC_ID,
        name: "변경",
      });

      await locationService.updateLocation(COMPANY_ID, LOC_ID, {
        name: "변경",
      });

      const callArgs = (prisma.location.update as any).mock.calls[0][0];
      expect(callArgs.data).toEqual({ name: "변경" });
    });
  });

  describe("checkLocationDependencies", () => {
    it("의존성 없으면 canDelete=true", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({ id: LOC_ID });
      (prisma.productionLine.count as any).mockResolvedValue(0);
      (prisma.inventoryLot.count as any).mockResolvedValue(0);
      (prisma.inventoryTransaction.count as any).mockResolvedValue(0);
      (prisma.stockTake.count as any).mockResolvedValue(0);
      (prisma.inventoryTransfer.count as any).mockResolvedValue(0);
      (prisma.shippingOrder.count as any).mockResolvedValue(0);

      const result = await locationService.checkLocationDependencies(
        COMPANY_ID,
        LOC_ID
      );

      expect(result.canDelete).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it("생산라인 존재 시 canDelete=false + 사유 포함", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({ id: LOC_ID });
      (prisma.productionLine.count as any).mockResolvedValue(3);
      (prisma.inventoryLot.count as any).mockResolvedValue(0);
      (prisma.inventoryTransaction.count as any).mockResolvedValue(0);
      (prisma.stockTake.count as any).mockResolvedValue(0);
      (prisma.inventoryTransfer.count as any).mockResolvedValue(0);
      (prisma.shippingOrder.count as any).mockResolvedValue(0);

      const result = await locationService.checkLocationDependencies(
        COMPANY_ID,
        LOC_ID
      );

      expect(result.canDelete).toBe(false);
      expect(result.reasons[0]).toContain("생산라인 3건");
    });

    it("InventoryTransfer fromLocation+toLocation 합산", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({ id: LOC_ID });
      (prisma.productionLine.count as any).mockResolvedValue(0);
      (prisma.inventoryLot.count as any).mockResolvedValue(0);
      (prisma.inventoryTransaction.count as any).mockResolvedValue(0);
      (prisma.stockTake.count as any).mockResolvedValue(0);
      (prisma.inventoryTransfer.count as any)
        .mockResolvedValueOnce(2) // fromLocationId
        .mockResolvedValueOnce(3); // toLocationId
      (prisma.shippingOrder.count as any).mockResolvedValue(0);

      const result = await locationService.checkLocationDependencies(
        COMPANY_ID,
        LOC_ID
      );

      expect(result.canDelete).toBe(false);
      expect(result.reasons[0]).toContain("재고 이동 5건");
    });

    it("NOT_FOUND throw", async () => {
      (prisma.location.findFirst as any).mockResolvedValue(null);

      await expect(
        locationService.checkLocationDependencies(COMPANY_ID, "missing")
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("deleteLocation", () => {
    it("의존성 있으면 DEPENDENCY_EXISTS throw", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({ id: LOC_ID });
      (prisma.productionLine.count as any).mockResolvedValue(1);
      (prisma.inventoryLot.count as any).mockResolvedValue(0);
      (prisma.inventoryTransaction.count as any).mockResolvedValue(0);
      (prisma.stockTake.count as any).mockResolvedValue(0);
      (prisma.inventoryTransfer.count as any).mockResolvedValue(0);
      (prisma.shippingOrder.count as any).mockResolvedValue(0);

      await expect(
        locationService.deleteLocation(COMPANY_ID, LOC_ID)
      ).rejects.toThrow("DEPENDENCY_EXISTS");
    });

    it("의존성 없으면 soft-delete 수행", async () => {
      (prisma.location.findFirst as any).mockResolvedValue({ id: LOC_ID });
      (prisma.productionLine.count as any).mockResolvedValue(0);
      (prisma.inventoryLot.count as any).mockResolvedValue(0);
      (prisma.inventoryTransaction.count as any).mockResolvedValue(0);
      (prisma.stockTake.count as any).mockResolvedValue(0);
      (prisma.inventoryTransfer.count as any).mockResolvedValue(0);
      (prisma.shippingOrder.count as any).mockResolvedValue(0);
      (prisma.location.update as any).mockResolvedValue({
        id: LOC_ID,
        deletedAt: new Date(),
      });

      await locationService.deleteLocation(COMPANY_ID, LOC_ID);

      const callArgs = (prisma.location.update as any).mock.calls[0][0];
      expect(callArgs.data.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe("getLocations", () => {
    it("type 필터 적용", async () => {
      (prisma.location.findMany as any).mockResolvedValue([]);
      (prisma.location.count as any).mockResolvedValue(0);

      await locationService.getLocations(COMPANY_ID, {
        page: 1,
        limit: 20,
        type: "WAREHOUSE",
        sortBy: "sortOrder",
        sortOrder: "asc",
      });

      const where = (prisma.location.findMany as any).mock.calls[0][0].where;
      expect(where.type).toBe("WAREHOUSE");
    });

    it("sortBy=sortOrder일 때 name asc 보조 정렬", async () => {
      (prisma.location.findMany as any).mockResolvedValue([]);
      (prisma.location.count as any).mockResolvedValue(0);

      await locationService.getLocations(COMPANY_ID, {
        page: 1,
        limit: 20,
        sortBy: "sortOrder",
        sortOrder: "asc",
      });

      const orderBy = (prisma.location.findMany as any).mock.calls[0][0]
        .orderBy;
      expect(orderBy).toEqual([{ sortOrder: "asc" }, { name: "asc" }]);
    });
  });
});
