import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Prisma interactive transaction 래퍼.
 * 여러 DB 작업을 하나의 트랜잭션으로 묶어서 실행한다.
 * 하나라도 실패하면 모든 작업이 롤백된다.
 *
 * @param options.existingTx 외부에서 이미 진행 중인 트랜잭션 객체.
 *   주입 시 새 트랜잭션을 시작하지 않고 해당 tx 위에서 실행한다.
 *   (D30 등에서 ReceivingNote 확정과 PO 종결을 단일 트랜잭션으로 묶기 위함)
 *
 * @example 단일 트랜잭션
 * const result = await withTransaction(async (tx) => {
 *   const order = await tx.purchaseOrder.update({ ... });
 *   const lot = await tx.inventoryLot.create({ ... });
 *   return { order, lot };
 * });
 *
 * @example 외부 트랜잭션 합류
 * await withTransaction(async (innerTx) => {
 *   // outerTx 위에서 그대로 실행됨, 새 트랜잭션 시작 안 함
 * }, { existingTx: outerTx });
 */
export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; existingTx?: TxClient }
): Promise<T> {
  if (options?.existingTx) {
    return fn(options.existingTx as unknown as PrismaClient);
  }
  return prisma.$transaction(
    async (tx) => fn(tx as unknown as PrismaClient),
    {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    }
  );
}