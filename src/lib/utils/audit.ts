import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";
import type { AppSession } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";

// ============================================================
// ★ Sprint 4 Phase S4-0-d — 트랜잭션 인식 감사 로그 헬퍼
// ============================================================
//
// 원칙 (CONVENTIONS.md 참조):
//   - 서비스 레이어(트랜잭션 내부): writeAuditLog(tx, params)
//     → 상태 변경과 감사 로그가 원자적으로 커밋/롤백된다.
//   - Actions 레이어(트랜잭션 외부): createAuditLog({ session, ... })
//     → session에서 companyId/userId를 자동 주입한다. 내부적으로
//       writeAuditLog(prisma, ...)를 호출한다.
//
// 실패 정책:
//   - writeAuditLog는 트랜잭션 안에서 호출되므로 실패 시 throw 한다
//     (전체 롤백). 감사 로그는 비즈니스 로직의 원자적 일부다.
//   - createAuditLog는 후처리이므로 실패해도 catch 후 log.error만 남긴다.

export type WriteAuditLogParams = {
  companyId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * JSON 직렬화 가능한 값으로 정규화한다.
 * Date/BigInt/Decimal 등 Prisma가 반환하는 특수 값들이 포함된
 * 객체를 InputJsonValue로 안전하게 변환한다.
 */
function normalizeJson(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * 트랜잭션 인식 감사 로그 기록.
 *
 * @param client Prisma 트랜잭션 클라이언트 또는 기본 prisma 인스턴스
 * @param params 감사 로그 파라미터
 *
 * @example 트랜잭션 내부에서 사용
 *   await withTransaction(async (tx) => {
 *     const res = await tx.inventoryReservation.create({ data: ... });
 *     await writeAuditLog(tx, {
 *       companyId: input.companyId,
 *       userId: actorUserId,
 *       action: "CREATE",
 *       entityType: "InventoryReservation",
 *       entityId: res.id,
 *       after: res as unknown as Record<string, unknown>,
 *     });
 *     return res;
 *   });
 */
export async function writeAuditLog(
  client: Prisma.TransactionClient | typeof prisma,
  params: WriteAuditLogParams
): Promise<void> {
  await client.auditLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: normalizeJson(params.before),
      after: normalizeJson(params.after),
      ipAddress: params.ipAddress ?? null,
    },
  });
}

// ============================================================
// Actions 레이어용 헬퍼 (기존 시그니처 유지)
// ============================================================

type CreateAuditLogParams = {
  session: AppSession;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * 감사 로그를 AuditLog 테이블에 기록한다. (Actions 레이어 전용)
 *
 * 내부적으로 writeAuditLog(prisma, ...)를 호출하며, 실패해도 비즈니스
 * 로직을 중단시키지 않고 logger.error로만 남긴다.
 *
 * 서비스 레이어(트랜잭션 내부)에서 감사 로그를 남기려면 writeAuditLog 사용.
 *
 * @example
 * await createAuditLog({
 *   session,
 *   action: "CREATE",
 *   entityType: "MaterialMaster",
 *   entityId: material.id,
 *   after: material as unknown as Record<string, unknown>,
 * });
 */
export async function createAuditLog({
  session,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  ipAddress = null,
}: CreateAuditLogParams): Promise<void> {
  try {
    await writeAuditLog(prisma, {
      companyId: session.companyId,
      userId: session.userId,
      action,
      entityType,
      entityId,
      before,
      after,
      ipAddress,
    });
  } catch (error) {
    // 감사 로그 기록 실패가 비즈니스 로직을 중단시키지 않도록 한다
    logger.error("감사 로그 기록 실패:", error);
  }
}
