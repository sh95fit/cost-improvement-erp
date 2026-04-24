import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createSoftDeleteExtension } from "@candoimage/prisma-extension-soft-delete";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  pool: pg.Pool | undefined;
  prisma: PrismaClient | undefined;
};

const pool = globalForPrisma.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

const basePrisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// Soft-delete extension 적용
// deletedAt 필드가 있는 모델 10개 등록
// compound unique index 모델 8개에 allowCompoundUniqueIndexWhere: true 설정
const softDeleteModels = {
  Company: true,
  User: true,
  Location: true,
  MaterialMaster: true,
  SubsidiaryMaster: true,
  Supplier: true,
  ContainerGroup: true,
  Recipe: true,
  SemiProduct: true,
  Lineup: true,
};

export const prisma = basePrisma.$extends(
  createSoftDeleteExtension({
    models: softDeleteModels,
    defaultConfig: {
      field: "deletedAt",
      createValue: (deleted) => {
        if (deleted) return new Date();
        return null;
      },
      allowCompoundUniqueIndexWhere: true,
    },
  })
) as unknown as PrismaClient;

export default prisma;
