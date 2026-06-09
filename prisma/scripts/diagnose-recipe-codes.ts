// prisma/scripts/diagnose-recipe-codes.ts
// Phase 9-C-Fix-B 진단: 레시피 채번 상태 점검
// 실행: npx tsx prisma/scripts/diagnose-recipe-codes.ts

import { prisma } from "../../src/lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });

  for (const c of companies) {
    const recipes = await prisma.recipe.findMany({
      where: { companyId: c.id },
      select: { code: true, name: true, deletedAt: true, createdAt: true },
      orderBy: { code: "asc" },
    });

    console.log(`\n[${c.name}] 레시피 ${recipes.length}건`);
    let maxN = 0;
    for (const r of recipes) {
      const m = r.code.match(/^RCP-(\d+)$/);
      const n = m ? parseInt(m[1], 10) : 0;
      if (n > maxN) maxN = n;
      const status = r.deletedAt ? "🗑️  soft-deleted" : "✅ active";
      console.log(`  ${r.code}  ${status}  ${r.name}`);
    }
    console.log(`  → 최대 채번 = ${maxN}, 다음 채번 = RCP-${String(maxN + 1).padStart(3, "0")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
