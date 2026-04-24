import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";
import type { AppSession } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";

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
 * 감사 로그를 AuditLog 테이블에 기록한다.
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
    await prisma.auditLog.create({
      data: {
        companyId: session.companyId,
        userId: session.userId,
        action,
        entityType,
        entityId,
        before: before ? (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue) : undefined,
        after: after ? (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue) : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    // 감사 로그 기록 실패가 비즈니스 로직을 중단시키지 않도록 한다
    logger.error("감사 로그 기록 실패:", error);
  }
}
