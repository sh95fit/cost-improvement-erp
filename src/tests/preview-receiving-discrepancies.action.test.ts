import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiscrepancyType } from "@prisma/client";

// ─── mocks ───
vi.mock("@/lib/auth/session", () => ({
  requireCompanySession: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({
  assertPermission: vi.fn(),
}));
vi.mock("@/features/receiving-note/services/receiving-note.service", async () => {
  // 실제 에러 클래스는 그대로 재사용
  const actual = await vi.importActual<
    typeof import("@/features/receiving-note/services/receiving-note.service")
  >("@/features/receiving-note/services/receiving-note.service");
  return {
    ...actual,
    previewReceivingNoteDiscrepancies: vi.fn(),
  };
});

import { previewReceivingDiscrepanciesAction } from "@/features/receiving-note/actions/preview-receiving-discrepancies.action";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import {
  previewReceivingNoteDiscrepancies,
  ReceivingNoteNotFoundError,
  ReceivingNoteCompanyMismatchError,
  type ReceivingDiscrepancyPreview,
} from "@/features/receiving-note/services/receiving-note.service";

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

describe("previewReceivingDiscrepanciesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireCompanySession as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
    (assertPermission as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
  });

  it("정상: 불일치 3건 반환", async () => {
    const mockPreviews: ReceivingDiscrepancyPreview[] = [
      {
        key: `${DiscrepancyType.QUANTITY_SHORT}:po_item_A:rn_item_1`,
        type: DiscrepancyType.QUANTITY_SHORT,
        purchaseOrderItemId: "po_item_A",
        receivingNoteItemId: "rn_item_1",
        itemName: "양파",
        expectedQty: 10,
        actualQty: 8,
        expectedUnitPrice: 3000,
        actualUnitPrice: 3000,
        diffValue: -2,
        autoReason: null,
      },
      {
        key: `${DiscrepancyType.UNIT_PRICE_DIFF}:po_item_B:rn_item_2`,
        type: DiscrepancyType.UNIT_PRICE_DIFF,
        purchaseOrderItemId: "po_item_B",
        receivingNoteItemId: "rn_item_2",
        itemName: "대파",
        expectedQty: 5,
        actualQty: 5,
        expectedUnitPrice: 2000,
        actualUnitPrice: 2200,
        diffValue: 200,
        autoReason: "입고 단가가 발주 단가와 다름 (기록 전용, 단가 변경 없음)",
      },
      {
        key: `${DiscrepancyType.ITEM_MISSING}:po_item_C:none`,
        type: DiscrepancyType.ITEM_MISSING,
        purchaseOrderItemId: "po_item_C",
        receivingNoteItemId: null,
        itemName: "양배추",
        expectedQty: 3,
        actualQty: 0,
        expectedUnitPrice: 1500,
        actualUnitPrice: null,
        diffValue: -3,
        autoReason: "발주에 있었으나 입고되지 않음",
      },
    ];
    (previewReceivingNoteDiscrepancies as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPreviews,
    );

    const res = await previewReceivingDiscrepanciesAction({
      receivingNoteId: VALID_CUID,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toHaveLength(3);
      expect(res.data).toEqual(mockPreviews);
    }
    expect(assertPermission).toHaveBeenCalledWith(SESSION, "receiving-note", "READ");
    expect(previewReceivingNoteDiscrepancies).toHaveBeenCalledWith(
      "company-1",
      VALID_CUID,
    );
  });

  it("정상: 불일치 0건 반환 (완전 일치)", async () => {
    (previewReceivingNoteDiscrepancies as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await previewReceivingDiscrepanciesAction({
      receivingNoteId: VALID_CUID,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual([]);
    }
  });

  it("존재하지 않는 입고서: NOT_FOUND 로 매핑", async () => {
    (previewReceivingNoteDiscrepancies as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReceivingNoteNotFoundError(VALID_CUID),
    );

    const res = await previewReceivingDiscrepanciesAction({
      receivingNoteId: VALID_CUID,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("NOT_FOUND");
    }
  });

  it("다른 회사 입고서: FORBIDDEN 으로 매핑", async () => {
    (previewReceivingNoteDiscrepancies as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReceivingNoteCompanyMismatchError(),
    );

    const res = await previewReceivingDiscrepanciesAction({
      receivingNoteId: VALID_CUID,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
  });

  it("권한 없음 (assertPermission throw): FORBIDDEN 으로 매핑", async () => {
    (assertPermission as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });

    const res = await previewReceivingDiscrepanciesAction({
      receivingNoteId: VALID_CUID,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
    expect(previewReceivingNoteDiscrepancies).not.toHaveBeenCalled();
  });

  it("Zod 검증 실패 (receivingNoteId 없음): INTERNAL_ERROR 로 fallback", async () => {
    const res = await previewReceivingDiscrepanciesAction({});

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("INTERNAL_ERROR");
    }
    expect(previewReceivingNoteDiscrepancies).not.toHaveBeenCalled();
  });
});