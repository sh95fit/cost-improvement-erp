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
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  $queryRaw: vi.fn(),
};

export const prismaMock = mockPrisma;

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));
