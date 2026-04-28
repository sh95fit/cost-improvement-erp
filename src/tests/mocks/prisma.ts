import { vi } from "vitest";

// Prisma 클라이언트 mock
const mockPrisma = {
  materialMaster: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subsidiaryMaster: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  unitConversion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  supplierItem: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  supplierItemPriceHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

export { mockPrisma };
