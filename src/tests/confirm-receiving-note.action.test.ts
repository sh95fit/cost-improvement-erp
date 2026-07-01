import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── mocks ───
vi.mock("@/lib/prisma", () => ({
  prisma: {
    receivingNote: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCompanySession: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({
  assertPermission: vi.fn(),
  assertScope: vi.fn(),
}));
vi.mock("@/lib/utils/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/receiving-note/services/receiving-note.service", async () => {
  // 실제 에러 클래스는 그대로 재사용
  const actual = await vi.importActual<
    typeof import("@/features/receiving-note/services/receiving-note.service")
  >("@/features/receiving-note/services/receiving-note.service");
  return {
    ...actual,
    confirmReceivingNote: vi.fn(),
  };
});

import { assertScope } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { confirmReceivingNoteAction } from "@/features/receiving-note/actions/confirm-receiving-note.action";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import {
  confirmReceivingNote,
  ReceivingNoteNotFoundError,
  ReceivingNoteAlreadyConfirmedError,
  UnsupportedSubsidiaryReceivingError,
} from "@/features/receiving-note/services/receiving-note.service";

// cuid 형식 (스키마의 z.string().cuid() 검증 통과용)
const VALID_CUID = "cjld2cjxh0000qzrmn831i7rn";

const SESSION = {
  userId: "user-1",
  companyId: "company-1",
  companyName: "런치랩",
  email: "u@x.com",
  name: "테스터",
  avatarUrl: null,
  systemRole: "SYSTEM_ADMIN" as const,
  permissions: [],
  scopes: [],
};

describe("confirmReceivingNoteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireCompanySession as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
    (assertPermission as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    (assertScope as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    // 기본 mock: 스코프 체크 통과
    (prisma.receivingNote.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: VALID_CUID,
      purchaseOrder: { id: "po-1", locationId: "loc-1" },
    });
  });

  it("정상: success=true + status CONFIRMED + 감사 로그 기록", async () => {
    (confirmReceivingNote as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: VALID_CUID,
      status: "CONFIRMED",
    });

    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual({ id: VALID_CUID, status: "CONFIRMED" });
    }
    expect(assertPermission).toHaveBeenCalledWith(SESSION, "receiving-note", "UPDATE");
    expect(assertScope).toHaveBeenCalledWith(SESSION, "LOCATION", "loc-1");    
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entityType: "ReceivingNote",
        entityId: VALID_CUID,
      }),
    );
  });

  it("이미 확정된 입고서: ALREADY_CONFIRMED 로 매핑", async () => {
    (confirmReceivingNote as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReceivingNoteAlreadyConfirmedError(VALID_CUID),
    );

    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("ALREADY_CONFIRMED");
    }
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("존재하지 않는 입고서: NOT_FOUND 로 매핑", async () => {
    (confirmReceivingNote as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReceivingNoteNotFoundError(VALID_CUID),
    );

    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("NOT_FOUND");
    }
  });

  it("부자재 입고: UNSUPPORTED_SUBSIDIARY 로 매핑", async () => {
    (confirmReceivingNote as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnsupportedSubsidiaryReceivingError("poi-1"),
    );

    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("UNSUPPORTED_SUBSIDIARY");
    }
  });

  it("권한 없음: FORBIDDEN 으로 매핑 (assertPermission이 throw)", async () => {
    (assertPermission as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });

    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
    expect(confirmReceivingNote).not.toHaveBeenCalled();
  });

  it("Zod 검증 실패 (receivingNoteId 없음): INTERNAL_ERROR 로 fallback", async () => {
    (assertPermission as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
  
    const res = await confirmReceivingNoteAction({});
  
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("노트 조회 실패 (findFirst null): NOT_FOUND 로 매핑", async () => {
    (prisma.receivingNote.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  
    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });
  
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("NOT_FOUND");
    }
    expect(confirmReceivingNote).not.toHaveBeenCalled();
  });

  it("스코프 위반 (다른 공장 PO): FORBIDDEN 으로 매핑", async () => {
    (assertScope as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
  
    const res = await confirmReceivingNoteAction({ receivingNoteId: VALID_CUID });
  
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
    expect(confirmReceivingNote).not.toHaveBeenCalled();
  });
});
