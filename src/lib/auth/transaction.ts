import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

/**
 * Prisma interactive transaction 래퍼.
 * 여러 DB 작업을 하나의 트랜잭션으로 묶어서 실행한다.
 * 하나라도 실패하면 모든 작업이 롤백된다.
 *
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const order = await tx.purchaseOrder.update({ ... });
 *   const lot = await tx.inventoryLot.create({ ... });
 *   return { order, lot };
 * });
 */
export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number }
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      return fn(tx as unknown as PrismaClient);
    },
    {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    }
  );
}
