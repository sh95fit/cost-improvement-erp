// prisma/scripts/diagnose-recipe-codes-v2.ts
import { prisma } from "../../src/lib/prisma";

async function main() {
  // ★ 핵심: 전체 회사, soft-deleted 포함, 원시 SQL로
  const rows = await prisma.$queryRaw<Array<{
    company_id: string;
    code: string;
    name: string;
    deleted_at: Date | null;
  }>>`
    SELECT company_id, code, name, deleted_at
    FROM recipes
    WHERE code LIKE 'RCP-%'
    ORDER BY company_id, code;
  `;

  console.log(`전체 RCP-* 레시피 ${rows.length}건`);
  for (const r of rows) {
    const status = r.deleted_at ? "🗑️  deleted" : "✅ active ";
    console.log(`  [${r.company_id.slice(0,8)}] ${r.code} ${status} ${r.name}`);
  }

  // 회사별 max
  const byCompany = new Map<string, number>();
  for (const r of rows) {
    const m = r.code.match(/^RCP-(\d+)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const prev = byCompany.get(r.company_id) ?? 0;
    if (n > prev) byCompany.set(r.company_id, n);
  }
  console.log("\n회사별 max:");
  for (const [cid, max] of byCompany) {
    console.log(`  ${cid.slice(0,8)}  max=${max}  next=RCP-${String(max+1).padStart(3,"0")}`);
  }

  // 인덱스 정보
  const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
    SELECT indexdef FROM pg_indexes WHERE tablename = 'recipes';
  `;
  console.log("\nrecipes 테이블 인덱스:");
  for (const i of indexes) console.log("  " + i.indexdef);
}

main().finally(() => prisma.$disconnect());
