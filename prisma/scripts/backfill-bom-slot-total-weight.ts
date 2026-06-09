// prisma/scripts/backfill-bom-slot-total-weight.ts
// Phase 9-C-Fix-D 백필: 기존 RecipeBOMSlot.totalWeightG를
// 슬롯 아이템 weightG 합계로 갱신.
//
// 실행:
//   npx tsx prisma/scripts/backfill-bom-slot-total-weight.ts
//   또는
//   npx ts-node prisma/scripts/backfill-bom-slot-total-weight.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.recipeBOMSlot.findMany({
    select: {
      id: true,
      totalWeightG: true,
      items: { select: { weightG: true } },
    },
  });

  let updated = 0;
  let unchanged = 0;

  for (const s of slots) {
    const sum = s.items.reduce((acc, it) => acc + (it.weightG ?? 0), 0);
    if (Math.abs(sum - s.totalWeightG) < 1e-6) {
      unchanged++;
      continue;
    }
    await prisma.recipeBOMSlot.update({
      where: { id: s.id },
      data: { totalWeightG: sum },
    });
    updated++;
    console.log(
      `[backfill] slot ${s.id}: ${s.totalWeightG}g → ${sum}g (items ${s.items.length})`,
    );
  }

  console.log(
    `\n[backfill] 완료: 갱신 ${updated}건 / 동일 ${unchanged}건 (전체 ${slots.length}건)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
