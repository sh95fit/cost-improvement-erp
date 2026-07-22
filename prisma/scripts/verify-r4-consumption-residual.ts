// prisma/scripts/verify-r4-consumption-residual.ts
// Sprint 4 Phase S4-3-c-R4 검증: R3-b 진행 중 `prisma migrate reset` 으로
// 흡수된 consumption/receiving 잔재를 재확인한다.
// 4개 지표 (consumptionItem, consumptionLotDetail,
//  inventoryTransaction CONSUMPTION+DISPOSAL,
//  inventoryReservation CONSUMED) 카운트를 출력하고,
// 전부 0건이면 R4 α 종결(N/A) 가능 판정을 표시한다.
//
// 실행:
//   npx tsx prisma/scripts/verify-r4-consumption-residual.ts

import "dotenv/config";  // ★ 추가 — Supabase DATABASE_URL 로드 (prisma/seed.ts 관례 반영)
import { prisma } from "../../src/lib/prisma";

async function main() {
  const [tx, rv, ci, cld] = await Promise.all([
    prisma.inventoryTransaction.count({
      where: { transactionType: { in: ["CONSUMPTION", "DISPOSAL"] } },
    }),
    prisma.inventoryReservation.count({
      where: { releaseReason: "CONSUMED" },
    }),
    prisma.consumptionItem.count(),
    prisma.consumptionLotDetail.count(),
  ]);

  console.log("[verify-r4] inventoryTransaction(CONSUMPTION+DISPOSAL):", tx);
  console.log("[verify-r4] inventoryReservation(CONSUMED):          ", rv);
  console.log("[verify-r4] consumptionItem:                          ", ci);
  console.log("[verify-r4] consumptionLotDetail:                     ", cld);

  const total = tx + rv + ci + cld;
  console.log("---");
  console.log(
    total === 0
      ? "[verify-r4] ✅ 잔재 없음 — R4 α 종결(N/A) 가능"
      : `[verify-r4] ⚠️ 잔재 ${total}건 존재 — R4 γ (purge 마이그레이션) 필요`,
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
