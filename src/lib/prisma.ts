import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createSoftDeleteExtension } from "@candoimage/prisma-extension-soft-delete";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  pool: pg.Pool | undefined;
  prisma: PrismaClient | undefined;
};

// ★ Pool 옵션 명시:
//   - max: dev 는 낮게(5), prod 는 여유(10~15)
//   - idleTimeoutMillis: 유휴 커넥션 조기 반환 (Supavisor 세션 슬롯 회수)
//   - connectionTimeoutMillis: 획득 대기 timeout — 무한 대기로 요청 걸림 방지
//   - allowExitOnIdle: dev HMR 시 프로세스 정리 도움
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]  // ★ "query" 제거 - 로그 과다로 dev 성능 저하
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

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
      createValue: (deleted) => (deleted ? new Date() : null),
      allowCompoundUniqueIndexWhere: true,
    },
  })
) as unknown as PrismaClient;

export default prisma;
