import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── mocks ───
vi.mock("@/lib/auth/session", () => ({
  requireCompanySession: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({
  assertPermission: vi.fn(),
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
    const res = await confirmReceivingNoteAction({});

    expect(res.success).toBe(false);
    // ZodError 는 handleActionError 의 도메인 매핑 대상이 아니므로 fallback 발생
    if (!res.success) {
      expect(res.error.code).toBe("INTERNAL_ERROR");
    }
  });
});
