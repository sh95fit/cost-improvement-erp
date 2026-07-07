import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // ★ Prisma CLI (migrate/db push/studio) 는 DIRECT_URL 사용
    //   pooler 를 통한 DDL 은 실패하거나 hang 됨
    url: env("DIRECT_URL"),
  },
});
