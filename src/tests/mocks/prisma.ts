// src/tests/mocks/prisma.ts
import { vi } from "vitest";

function createModelMock() {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),        
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}

export const mockPrisma = {
  materialMaster: createModelMock(),
  subsidiaryMaster: createModelMock(),
  unitConversion: createModelMock(),
  supplierItem: createModelMock(),
  supplierItemPriceHistory: createModelMock(),
  recipe: createModelMock(),
  recipeIngredient: createModelMock(),
  recipeBOM: createModelMock(),
  recipeBOMSlot: createModelMock(),
  recipeBOMSlotItem: createModelMock(),
  semiProduct: createModelMock(),
  bOM: createModelMock(),
  bOMItem: createModelMock(),
  // ★ v5: containerGroup 제거, containerSlot 유지
  containerSlot: createModelMock(),
  // ★ v5: mealTemplateSlot → mealTemplateContainer
  mealTemplate: createModelMock(),
  mealTemplateContainer: createModelMock(),
  mealTemplateAccessory: createModelMock(),
  supplier: createModelMock(),
  unitMaster: createModelMock(),
  // ★ Phase 3: 식단 계획
  mealPlanGroup: createModelMock(),
  mealPlan: createModelMock(),
  mealPlanSlot: createModelMock(),
  mealCount: createModelMock(),
  mealPlanAccessory: createModelMock(),
  lineup: createModelMock(),
  // ★ Phase 5-R Step 3.1: 식단 슬롯 마스터
  companyMealSlot: createModelMock(),
  // ★ Phase 5-R Step 2: 라인업 부속
  location: createModelMock(),
  lineupLocationMap: createModelMock(),
  // lineupMealTemplateMap: createModelMock(),
  // ★ Phase 8.5: 라인/위치 마스터 (이미 location은 있음, productionLine 신규)
  productionLine: createModelMock(),
  // ★ Phase 9-A: 소요량 산출 대상
  materialRequirement: createModelMock(),
  shippingOrder: createModelMock(),
  // ★ Sprint 3 Phase 2: 발주
  purchaseOrder: createModelMock(),
  purchaseOrderItem: createModelMock(),
  // ★ Sprint 3 Phase 3-4: 입고
  receivingNote: createModelMock(),
  receivingNoteItem: createModelMock(),
  // ★ D30 (2026-06-30): 입고 확정 시 재고/불일치 스냅샷
  receivingDiscrepancy: createModelMock(),
  inventoryLot: createModelMock(),
  inventoryTransaction: createModelMock(),
  // ★ Sprint 4 Phase S4-0-c: 예약 도메인
  inventoryReservation: createModelMock(),
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  $queryRaw: vi.fn().mockResolvedValue([]),
};

export const prismaMock = mockPrisma;

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));