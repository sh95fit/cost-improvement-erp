import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockPrisma } from "./mocks/prisma";
import { writeAuditLog, createAuditLog } from "@/lib/utils/audit";

const COMPANY_ID = "company-1";
const USER_ID = "user-1";
const ENTITY_ID = "entity-1";

describe("writeAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("정상: auditLog.create 를 주어진 client 로 호출", async () => {
    await writeAuditLog(mockPrisma as never, {
      companyId: COMPANY_ID,
      userId: USER_ID,
      action: "CREATE",
      entityType: "InventoryReservation",
      entityId: ENTITY_ID,
      after: { foo: "bar" },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: COMPANY_ID,
        userId: USER_ID,
        action: "CREATE",
        entityType: "InventoryReservation",
        entityId: ENTITY_ID,
        after: { foo: "bar" },
        ipAddress: null,
      }),
    });
  });

  it("Date 객체가 포함된 payload 도 JSON 직렬화 정규화됨", async () => {
    const now = new Date("2026-07-10T00:00:00Z");

    await writeAuditLog(mockPrisma as never, {
      companyId: COMPANY_ID,
      userId: USER_ID,
      action: "UPDATE",
      entityType: "InventoryReservation",
      entityId: ENTITY_ID,
      before: { releasedAt: null },
      after: { releasedAt: now },
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    // JSON 직렬화되면 Date → ISO 문자열
    expect(call.data.after).toEqual({ releasedAt: now.toISOString() });
    expect(call.data.before).toEqual({ releasedAt: null });
  });

  it("before/after 미지정 시 undefined 로 처리", async () => {
    await writeAuditLog(mockPrisma as never, {
      companyId: COMPANY_ID,
      userId: USER_ID,
      action: "DELETE",
      entityType: "InventoryReservation",
      entityId: ENTITY_ID,
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(call.data.before).toBeUndefined();
    expect(call.data.after).toBeUndefined();
  });

  it("companyId/userId null 도 허용 (시스템 액션)", async () => {
    await writeAuditLog(mockPrisma as never, {
      companyId: null,
      userId: null,
      action: "OVERRIDE",
      entityType: "InventoryLot",
      entityId: ENTITY_ID,
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: null,
        userId: null,
        action: "OVERRIDE",
      }),
    });
  });

  it("트랜잭션 클라이언트 tx 로 호출하면 tx.auditLog.create 사용", async () => {
    const tx = { auditLog: { create: vi.fn().mockResolvedValue({ id: "a" }) } };

    await writeAuditLog(tx as never, {
      companyId: COMPANY_ID,
      userId: USER_ID,
      action: "CREATE",
      entityType: "InventoryReservation",
      entityId: ENTITY_ID,
    });

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("createAuditLog (Actions 레이어 래퍼)", () => {
  const session = {
    companyId: COMPANY_ID,
    userId: USER_ID,
  } as never; // AppSession 최소 필드

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상: session 에서 companyId/userId 자동 주입", async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "MaterialMaster",
      entityId: ENTITY_ID,
      after: { name: "test" },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: COMPANY_ID,
        userId: USER_ID,
        action: "CREATE",
        entityType: "MaterialMaster",
        entityId: ENTITY_ID,
      }),
    });
  });

  it("실패해도 throw 하지 않음 (로그만 남기고 통과)", async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error("DB down"));

    await expect(
      createAuditLog({
        session,
        action: "DELETE",
        entityType: "MaterialMaster",
        entityId: ENTITY_ID,
      }),
    ).resolves.toBeUndefined();
  });
});
