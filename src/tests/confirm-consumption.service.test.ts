// src/tests/confirm-consumption.service.test.ts
/**
 * S4-3-c-R6-B-4: confirmConsumption 서비스 통합 테스트
 * 감사서 근거:
 *   - §10-14 (Layer B guard, R6-B-3 이전 임시 차단)
 *   - §9-13-e (Layer A lineupId/productionLineId non-null, MATERIAL/SUBSIDIARY 공통)
 *   - §10-13 (mergeItems 키 확장: itemType + itemId + lineupId + productionLineId)
 *   - §10-3  (MATERIAL: getAvailableStock)
 *   - §10-12 (SUBSIDIARY: getSubsidiaryAvailableForConsumption)
 * 상위 커밋: 33470e2 (R6-B-2)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";
import { StaleDraftError } from "@/features/consumption/errors/consumption.errors";

// ── Mock 설정 (import 전에 hoisting) ────────────────
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/features/consumption/services/consumption-draft.service", () => ({
  buildConsumptionDraft: vi.fn(),
}));
vi.mock("@/features/consumption/services/cooking-plan-upsert.service", () => ({
  getOrCreateCookingPlanForConsumption: vi.fn(),
}));
vi.mock("@/features/inventory/services/available-stock.service", () => ({
  getAvailableStock: vi.fn(),
  getSubsidiaryAvailableForConsumption: vi.fn(),
}));
vi.mock("@/features/inventory/services/reservation.service", () => ({
  getAvailableQty: vi.fn().mockReturnValue(100),
}));
vi.mock("@/lib/utils/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { confirmConsumption } from "@/features/consumption/services/confirm-consumption.service";
import { buildConsumptionDraft } from "@/features/consumption/services/consumption-draft.service";
import { getOrCreateCookingPlanForConsumption } from "@/features/consumption/services/cooking-plan-upsert.service";
import {
  getAvailableStock,
  getSubsidiaryAvailableForConsumption,
} from "@/features/inventory/services/available-stock.service";

// ── 상수 ──────────────────────────────────────────
const COMPANY_ID = "cmp_test";
const USER_ID = "usr_test";
const LOCATION_ID = "loc_test";
const LINEUP_A = "lineup_a";
const LINEUP_B = "lineup_b";
const PROD_LINE_A = "pline_a";
const MEAL_PLAN_GROUP_ID = "mpg_test";
const COOKING_PLAN_ID = "cp_test";
const TARGET_DATE = new Date("2026-07-24T00:00:00.000Z");

// ── Helper factories ──────────────────────────────
function makeInputItem(overrides: Record<string, unknown> = {}) {
  return {
    itemType: "MATERIAL" as const,
    itemId: "mat_1",
    lineupId: LINEUP_A as string | null,
    productionLineId: PROD_LINE_A as string | null,
    suggestedQty: 100,
    totalAvailable: 100,
    finalUsedQty: 100,      // ← 10 → 100 (폐기 0 유지)
    remainingToStock: 0,
    ...overrides,
  };
}


function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY_ID,
    userId: USER_ID,
    locationId: LOCATION_ID,
    targetDate: TARGET_DATE,
    layerAItems: [makeInputItem()],
    layerBItems: [] as Array<{
      itemType: "MATERIAL" | "SUBSIDIARY";
      itemId: string;
      quantity: number;
      note?: string;
    }>,
    ...overrides,
  };
}

function makeDraftItem(overrides: Record<string, unknown> = {}) {
  return {
    itemType: "MATERIAL" as const,
    itemId: "mat_1",
    itemName: "테스트자재",
    itemCode: "M001",
    unit: "g",
    lineupId: LINEUP_A as string | null,
    lineupName: "라인업A" as string | null,
    productionLineId: PROD_LINE_A as string | null,
    productionLineName: "라인A" as string | null,
    suggestedQty: 100,      // ← 10 → 100
    roundedFinalQty: 100,   // ← 10 → 100
    hasSupplyUnit: true,
    supplyUnit: "kg",
    supplyUnitQty: 1000,
    availableQty: 100,
    inboundQtyOnDate: 0,
    sourceIds: ["mr_1"],
    consumptionMode: null,
    ...overrides,
  };
}

/**
 * Happy-path 공용 mock 설정.
 * 트랜잭션 진입 이후 필요한 모든 Prisma/서비스 호출을 정상 값으로 세팅한다.
 */
function setupHappyPath(draftItems = [makeDraftItem()]) {
  vi.mocked(buildConsumptionDraft).mockResolvedValue({
    header: {
      mealPlanGroupId: MEAL_PLAN_GROUP_ID,
      planDate: TARGET_DATE,
      totalEstimatedCount: 100,
      totalFinalCount: 95,
    },
    layerAItems: draftItems,
    references: { generatedAt: new Date(), note: "" },
  } as never);

  vi.mocked(getOrCreateCookingPlanForConsumption).mockResolvedValue(
    COOKING_PLAN_ID as never,
  );

  vi.mocked(getAvailableStock).mockResolvedValue({
    available: 100,
    breakdown: {
      reservedSameAxis: 0,
      freeStock: 100,
      reservedOtherDate: 0,
      reservedOtherAxis: 0,
    },
  });

  vi.mocked(getSubsidiaryAvailableForConsumption).mockResolvedValue({
    available: 100,
    lots: [
      {
        id: "lot_sub_1",
        subsidiaryMasterId: "sub_1",
        remainingQty: 100,
        unitCost: 5,
        receivedAt: new Date("2026-07-20"),
        lotNumber: "LS001",
      },
    ],
  } as never);

  // FIFO Lot 쿼리
  mockPrisma.inventoryLot.findMany.mockResolvedValue([
    {
      id: "lot_1",
      remainingQty: 100,
      unitPrice: 10,
    },
  ] as never);

  mockPrisma.mealPlanGroup.findUnique.mockResolvedValue({
    id: MEAL_PLAN_GROUP_ID,
  } as never);

  mockPrisma.cookingPlan.findUnique.mockResolvedValue({
    productionLineId: PROD_LINE_A,
  } as never);

  mockPrisma.consumptionHeader.upsert.mockResolvedValue({
    id: "header_1",
  } as never);

  mockPrisma.consumptionItem.create.mockImplementation(
    (async (args: { data: Record<string, unknown> }) => ({
      id: `ci_${Math.random().toString(36).slice(2, 8)}`,
      ...args.data,
    })) as never,
  );

  mockPrisma.consumptionLotDetail.create.mockResolvedValue({} as never);
  mockPrisma.inventoryTransaction.create.mockResolvedValue({} as never);
  mockPrisma.inventoryLot.update.mockResolvedValue({} as never);
}

// ── Test suites ───────────────────────────────────
describe("confirmConsumption (S4-3-c-R6-B-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 그룹 1: Layer B guard (§10-14) ──
  describe("Layer B guard (§10-14, R6-B-1)", () => {
    it("케이스 1: layerBItems가 존재하면 buildConsumptionDraft 호출 전에 Error throw", async () => {
      const input = makeInput({
        layerBItems: [{ itemType: "MATERIAL", itemId: "mat_x", quantity: 5 }],
      });

      await expect(confirmConsumption(input)).rejects.toThrow();
      expect(buildConsumptionDraft).not.toHaveBeenCalled();
    });
  });

  // ── 그룹 2: Pre-validation (P11, P14) ──
  describe("Pre-validation (트랜잭션 진입 전)", () => {
    it("케이스 2: finalUsedQty가 음수이면 QUANTITY_NEGATIVE throw", async () => {
      const input = makeInput({
        layerAItems: [makeInputItem({ finalUsedQty: -1 })],
      });
      await expect(confirmConsumption(input)).rejects.toThrow(
        /QUANTITY_NEGATIVE/,
      );
    });

    it("케이스 3: finalUsedQty + remainingToStock > totalAvailable이면 QUANTITY_OVERFLOW throw", async () => {
      const input = makeInput({
        layerAItems: [
          makeInputItem({
            totalAvailable: 100,
            finalUsedQty: 80,
            remainingToStock: 30,
          }),
        ],
      });
      await expect(confirmConsumption(input)).rejects.toThrow(
        /QUANTITY_OVERFLOW/,
      );
    });

    it("케이스 4: 폐기량 > 0인데 disposalReason 누락 시 DISPOSAL_REASON_REQUIRED throw", async () => {
      const input = makeInput({
        layerAItems: [
          makeInputItem({
            totalAvailable: 100,
            finalUsedQty: 50,
            remainingToStock: 40, // 폐기 = 10
          }),
        ],
      });
      await expect(confirmConsumption(input)).rejects.toThrow(
        /DISPOSAL_REASON_REQUIRED/,
      );
    });

    it("케이스 5: disposalReason=OTHER 인데 disposalNote 누락 시 DISPOSAL_NOTE_REQUIRED throw", async () => {
      const input = makeInput({
        layerAItems: [
          makeInputItem({
            totalAvailable: 100,
            finalUsedQty: 50,
            remainingToStock: 40,
            disposalReason: "OTHER",
          }),
        ],
      });
      await expect(confirmConsumption(input)).rejects.toThrow(
        /DISPOSAL_NOTE_REQUIRED/,
      );
    });
  });

  // ── 그룹 3: Drift 감지 & Lineup guard ──
  describe("Drift detection & Lineup non-null guard (§9-13-e)", () => {
    it("케이스 6: 서버 draft와 클라이언트 입력 itemId가 다르면 StaleDraftError throw", async () => {
      setupHappyPath([makeDraftItem({ itemId: "mat_DIFFERENT" })]);

      const input = makeInput();
      await expect(confirmConsumption(input)).rejects.toBeInstanceOf(
        StaleDraftError,
      );
    });

    it("케이스 7: Layer A 항목의 lineupId가 null이면 LAYER_A_LINEUP_MISSING throw", async () => {
      // drift를 통과시키려면 서버 draft도 동일하게 lineupId=null이어야 함
      setupHappyPath([makeDraftItem({ lineupId: null })]);

      const input = makeInput({
        layerAItems: [makeInputItem({ lineupId: null })],
      });
      await expect(confirmConsumption(input)).rejects.toThrow(
        /LAYER_A_LINEUP_MISSING/,
      );
    });

    it("케이스 8: Layer A 항목의 productionLineId가 null이면 LAYER_A_LINEUP_MISSING throw", async () => {
      setupHappyPath([makeDraftItem({ productionLineId: null })]);

      const input = makeInput({
        layerAItems: [makeInputItem({ productionLineId: null })],
      });
      await expect(confirmConsumption(input)).rejects.toThrow(
        /LAYER_A_LINEUP_MISSING/,
      );
    });
  });

  // ── 그룹 4: Merge key 확장 & Helper 분기 (§10-13, §10-3, §10-12) ──
  describe("Merge key expansion & Helper branching", () => {
    it("케이스 9: 동일 (itemType, itemId)여도 lineupId가 다르면 별도 ConsumptionItem 생성", async () => {
        setupHappyPath([
            makeDraftItem({ itemId: "mat_1", lineupId: LINEUP_A, suggestedQty: 5, roundedFinalQty: 5, availableQty: 5 }),
            makeDraftItem({ itemId: "mat_1", lineupId: LINEUP_B, suggestedQty: 3, roundedFinalQty: 3, availableQty: 3 }),
          ]);
          
          const input = makeInput({
            layerAItems: [
              makeInputItem({ itemId: "mat_1", lineupId: LINEUP_A, totalAvailable: 5, finalUsedQty: 5, suggestedQty: 5 }),
              makeInputItem({ itemId: "mat_1", lineupId: LINEUP_B, totalAvailable: 3, finalUsedQty: 3, suggestedQty: 3 }),
            ],
          });

      await confirmConsumption(input);

      const createCalls = mockPrisma.consumptionItem.create.mock.calls;
      const lineupIdsInCalls = createCalls.map(
        (c) => (c[0] as { data: { lineupId: string } }).data.lineupId,
      );
      expect(lineupIdsInCalls).toContain(LINEUP_A);
      expect(lineupIdsInCalls).toContain(LINEUP_B);
    });

    it("케이스 10: 정상 flow에서 ConsumptionItem.create의 data.lineupId가 정확히 전달됨", async () => {
      setupHappyPath([makeDraftItem()]);

      const input = makeInput();
      await confirmConsumption(input);

      expect(mockPrisma.consumptionItem.create).toHaveBeenCalled();
      const firstCall = mockPrisma.consumptionItem.create.mock.calls[0];
      const data = (firstCall![0] as { data: { lineupId: string } }).data;
      expect(data.lineupId).toBe(LINEUP_A);
    });

    it("케이스 11: MATERIAL 항목만 존재 시 getAvailableStock만 호출 (§10-3)", async () => {
      setupHappyPath([makeDraftItem({ itemType: "MATERIAL" })]);

      const input = makeInput({
        layerAItems: [makeInputItem({ itemType: "MATERIAL" })],
      });

      await confirmConsumption(input);

      expect(getAvailableStock).toHaveBeenCalled();
      expect(getSubsidiaryAvailableForConsumption).not.toHaveBeenCalled();
    });

    it("케이스 12: SUBSIDIARY 항목은 getSubsidiaryAvailableForConsumption 호출 (§10-12)", async () => {
      setupHappyPath([
        makeDraftItem({
          itemType: "SUBSIDIARY",
          itemId: "sub_1",
          // §9-13-e: SUBSIDIARY도 lineup non-null 필수
          lineupId: LINEUP_A,
          productionLineId: PROD_LINE_A,
        }),
      ]);

      const input = makeInput({
        layerAItems: [
          makeInputItem({
            itemType: "SUBSIDIARY",
            itemId: "sub_1",
            lineupId: LINEUP_A,
            productionLineId: PROD_LINE_A,
          }),
        ],
      });

      await confirmConsumption(input);

      expect(getSubsidiaryAvailableForConsumption).toHaveBeenCalled();
      expect(getAvailableStock).not.toHaveBeenCalled();
    });
  });
});
