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
  containerGroup: createModelMock(),
  containerSlot: createModelMock(),         // ★ Phase 7 추가
  containerAccessory: createModelMock(),    // ★ Phase 7 추가
  mealTemplate: createModelMock(),          // ★ Phase 7 추가
  supplier: createModelMock(),              // ★ Phase 11 추가
  unitMaster: createModelMock(),            // ★ Phase 11 추가
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};

// ★ Phase 11: 기존 코드 호환을 위한 alias export
export const prismaMock = mockPrisma;

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));
