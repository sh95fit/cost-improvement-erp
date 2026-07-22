// prisma/scripts/check-seed-status.ts
// Sprint 4 Phase S4-3-c-R4 부속: seed 데이터 존재 여부 확인
//
// 실행:
//   npx tsx prisma/scripts/check-seed-status.ts

import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
  const [company, user, location, productionLine, material, subsidiary, unitMaster, mealPlan] =
    await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.location.count(),
      prisma.productionLine.count(),
      prisma.materialMaster.count(),
      prisma.subsidiaryMaster.count(),
      prisma.unitMaster.count(),
      prisma.mealPlan.count(),
    ]);

  console.log("[check-seed] Company:         ", company, "(expect: 1)");
  console.log("[check-seed] User:            ", user, "(expect: >=1)");
  console.log("[check-seed] Location:        ", location, "(expect: 2)");
  console.log("[check-seed] ProductionLine:  ", productionLine, "(expect: 4)");
  console.log("[check-seed] MaterialMaster:  ", material, "(expect: 6)");
  console.log("[check-seed] SubsidiaryMaster:", subsidiary, "(expect: >=1)");
  console.log("[check-seed] UnitMaster:      ", unitMaster, "(expect: 31)");
  console.log("[check-seed] MealPlan:        ", mealPlan, "(expect: 8)");

  const seedApplied = company >= 1 && location >= 2 && unitMaster >= 20;
  console.log("---");
  console.log(seedApplied ? "[check-seed] ✅ seed 적용됨" : "[check-seed] ⚠️ seed 누락 — 재실행 필요");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });