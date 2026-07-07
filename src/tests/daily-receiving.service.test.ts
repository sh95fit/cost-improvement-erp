/**
 * Phase 3-D30-Ex1 — daily-receiving.service.ts 테스트
 *
 * 커버 대상:
 *  (a) outbound 모드 필터
 *  (b) expected 모드 범위 필터 + 리드타임 매칭
 *  (c) expected 모드에서 매칭 0건 PO 제외
 *  (d) leadTimeDays null → 기본값 1
 *  (e) outboundDate null → itemExpectedReceiveDate null
 *  (f) completed 목록 outboundDate 정확 매칭
 *  (g) 일부 아이템만 매칭 시 itemsMatchingDate 정확성
 *
 * 정책 근거:
 *  - itemExpectedReceiveDate = outboundDate - supplierItem.leadTimeDays (D15-3)
 *  - MAX_LEAD_TIME_DAYS_WINDOW = 30 (expected 모드 미래 창)
 *  - outboundDate = 실제 사용일 (엔드라인) / expectedReceiveDate = 그 이전
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POStatus, ReceivingNoteStatus } from "@prisma/client";

// ─── mocks ───
vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseOrder: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/transaction", () => ({
  withTransaction: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getDailyReceivingBundle } from "@/features/receiving-note/services/daily-receiving.service";

// ============================================================
// 헬퍼
// ============================================================

const COMPANY_ID = "company-1";
const SELECTED_DATE = "2026-07-15";

/** UTC 자정 Date (선택일 기준) */
const utcMidnight = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

/** n일 오프셋 */
const shiftDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

type MockPOItem = {
  id: string;
  itemType: "MATERIAL" | "SUBSIDIARY";
  materialMasterId?: string | null;
  subsidiaryMasterId?: string | null;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  supplierItem: { id: string; leadTimeDays: number | null } | null;
  materialMaster?: { id: string; name: string; unit: string } | null;
  subsidiaryMaster?: { id: string; name: string; unit: string } | null;
};

const makeItem = (overrides: Partial<MockPOItem> & { id: string }): MockPOItem => ({
  itemType: "MATERIAL",
  materialMasterId: "mm-1",
  subsidiaryMasterId: null,
  quantity: 10,
  receivedQty: 0,
  unitPrice: 1000,
  supplierItem: { id: "si-1", leadTimeDays: 2 },
  materialMaster: { id: "mm-1", name: "돼지고기", unit: "kg" },
  subsidiaryMaster: null,
  ...overrides,
});

const makePendingPO = (opts: {
  id: string;
  outboundDate: Date | null;
  status?: POStatus;
  items: MockPOItem[];
  draft?: unknown;
}) => ({
  id: opts.id,
  orderNumber: `PO-${opts.id}`,
  status: opts.status ?? POStatus.SUBMITTED,
  outboundDate: opts.outboundDate,
  expectedReceiveDate: null,
  supplierId: "sup-1",
  supplier: { id: "sup-1", name: "공급사A" },
  locationId: "loc-1",
  location: { id: "loc-1", name: "본사공장" },
  productionLineId: null,
  productionLine: null,
  note: null,
  items: opts.items,
  receivingNotes: opts.draft ? [opts.draft] : [],
});

const makeCompletedPO = (id: string, outboundDate: Date) => ({
  id,
  orderNumber: `PO-${id}`,
  status: POStatus.RECEIVED,
  outboundDate,
  supplier: { name: "공급사A" },
  location: { name: "본사공장" },
  items: [
    { quantity: 10, unitPrice: 1000 },
    { quantity: 5, unitPrice: 2000 },
  ],
  receivingNotes: [
    {
      id: "rn-c-1",
      receiveNumber: "RN-001",
      confirmedAt: outboundDate,
    },
  ],
});

/**
 * findMany 를 pending / completed 순으로 응답하도록 세팅.
 * 서비스 내부에서 pending → completed 순으로 findMany 를 두 번 호출한다.
 */
const setupFindMany = (pending: unknown[], completed: unknown[] = []) => {
  const mock = prisma.purchaseOrder.findMany as ReturnType<typeof vi.fn>;
  mock.mockReset();
  mock.mockResolvedValueOnce(pending);
  mock.mockResolvedValueOnce(completed);
};

// ============================================================
// 테스트
// ============================================================

describe("getDailyReceivingBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) outbound 모드: outboundDate = 선택일 정확 매칭만 pending 반환", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    setupFindMany([
      makePendingPO({
        id: "po-a",
        outboundDate: selected,
        items: [makeItem({ id: "poi-a1" })],
      }),
    ]);

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "outbound",
    );

    expect(result.mode).toBe("outbound");
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].purchaseOrder.id).toBe("po-a");
    // outbound 모드에서는 itemsMatchingDate 항상 빈 배열
    expect(result.pending[0].itemsMatchingDate).toEqual([]);

    // Prisma 필터 검증: outboundDate 가 { gte, lt } 형태 (당일만)
    const call = (prisma.purchaseOrder.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(call.where.outboundDate).toHaveProperty("gte");
    expect(call.where.outboundDate).toHaveProperty("lt");
  });

  it("(b) expected 모드: outboundDate − leadTimeDays = 선택일 인 품목을 가진 PO 반환", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    // leadTimeDays = 3 → outboundDate 는 선택일 + 3일 이어야 매칭
    const outbound = shiftDays(selected, 3);

    setupFindMany([
      makePendingPO({
        id: "po-b",
        outboundDate: outbound,
        items: [
          makeItem({
            id: "poi-b1",
            supplierItem: { id: "si-b", leadTimeDays: 3 },
          }),
        ],
      }),
    ]);

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "expected",
    );

    expect(result.mode).toBe("expected");
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].itemsMatchingDate).toEqual(["poi-b1"]);
    // itemExpectedReceiveDate 확인 (= outbound - 3d = 선택일)
    expect(
      result.pending[0].purchaseOrder.items[0].itemExpectedReceiveDate?.getTime(),
    ).toBe(selected.getTime());

    // Prisma 필터: expected 모드는 { gte, lte: gte + 30d }
    const call = (prisma.purchaseOrder.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(call.where.outboundDate).toHaveProperty("gte");
    expect(call.where.outboundDate).toHaveProperty("lte");
  });

  it("(c) expected 모드: 매칭 품목 0건 PO 는 pending 에서 제외", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    // leadTimeDays 1 이지만 outboundDate 가 선택일 +5 → 예상입고일 = 선택일 +4 (미일치)
    setupFindMany([
      makePendingPO({
        id: "po-c",
        outboundDate: shiftDays(selected, 5),
        items: [
          makeItem({
            id: "poi-c1",
            supplierItem: { id: "si-c", leadTimeDays: 1 },
          }),
        ],
      }),
    ]);

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "expected",
    );

    expect(result.pending).toHaveLength(0);
  });

  it("(d) leadTimeDays 가 null 이면 기본값 1 로 계산", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    // 기본값 1 적용 → outboundDate = 선택일 +1 이어야 매칭
    setupFindMany([
      makePendingPO({
        id: "po-d",
        outboundDate: shiftDays(selected, 1),
        items: [
          makeItem({
            id: "poi-d1",
            supplierItem: { id: "si-d", leadTimeDays: null },
          }),
        ],
      }),
    ]);

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "expected",
    );

    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].purchaseOrder.items[0].leadTimeDays).toBe(1);
    expect(result.pending[0].itemsMatchingDate).toEqual(["poi-d1"]);
  });

  it("(e) outboundDate 가 null 이면 itemExpectedReceiveDate 도 null", async () => {
    setupFindMany([
      makePendingPO({
        id: "po-e",
        outboundDate: null,
        items: [makeItem({ id: "poi-e1" })],
      }),
    ]);

    // outbound 모드에서는 outboundDate null 이면 필터에서 걸러지겠지만,
    // 테스트 목적상 findMany mock 이 그대로 반환하므로 파생 로직만 확인.
    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "outbound",
    );

    expect(result.pending).toHaveLength(1);
    expect(
      result.pending[0].purchaseOrder.items[0].itemExpectedReceiveDate,
    ).toBeNull();
  });

  it("(f) completed 목록은 outboundDate = 선택일 정확 매칭만 반환", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    setupFindMany(
      [],
      [makeCompletedPO("po-f", selected)],
    );

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "outbound",
    );

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].purchaseOrderId).toBe("po-f");
    // totalAmount = 10*1000 + 5*2000 = 20000
    expect(result.completed[0].totalAmount).toBe(20000);
    expect(result.completed[0].receivingNoteId).toBe("rn-c-1");

    // 두 번째 findMany 호출(=completed) 필터 검증
    const completedCall = (prisma.purchaseOrder.findMany as ReturnType<
      typeof vi.fn
    >).mock.calls[1][0];
    expect(completedCall.where.status).toBe(POStatus.RECEIVED);
    expect(completedCall.where.outboundDate).toHaveProperty("gte");
    expect(completedCall.where.outboundDate).toHaveProperty("lt");
  });

  it("(g) 여러 아이템 PO 에서 일부만 매칭 시 itemsMatchingDate 정확", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    // outboundDate = 선택일 +2
    // - 품목1: leadTimeDays 2 → 예상입고일 = 선택일 (매칭 ✓)
    // - 품목2: leadTimeDays 5 → 예상입고일 = 선택일 -3 (미일치)
    // - 품목3: leadTimeDays 2 → 예상입고일 = 선택일 (매칭 ✓)
    setupFindMany([
      makePendingPO({
        id: "po-g",
        outboundDate: shiftDays(selected, 2),
        items: [
          makeItem({
            id: "poi-g1",
            supplierItem: { id: "si-1", leadTimeDays: 2 },
          }),
          makeItem({
            id: "poi-g2",
            supplierItem: { id: "si-2", leadTimeDays: 5 },
          }),
          makeItem({
            id: "poi-g3",
            supplierItem: { id: "si-3", leadTimeDays: 2 },
          }),
        ],
      }),
    ]);

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "expected",
    );

    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].itemsMatchingDate.sort()).toEqual([
      "poi-g1",
      "poi-g3",
    ]);
  });

  it("existingDraft 가 있는 PO 는 draft 필드에 매핑됨", async () => {
    const selected = utcMidnight(SELECTED_DATE);
    setupFindMany([
      makePendingPO({
        id: "po-h",
        outboundDate: selected,
        items: [makeItem({ id: "poi-h1" })],
        draft: {
          id: "rn-draft-1",
          receiveNumber: "RN-DRAFT-001",
          receivedDate: selected,
          note: "부분 입고",
          items: [
            {
              id: "rni-h1",
              purchaseOrderItemId: "poi-h1",
              receivedQty: 7,
              unitPrice: 1000,
            },
          ],
        },
      }),
    ]);

    const result = await getDailyReceivingBundle(
      COMPANY_ID,
      SELECTED_DATE,
      "outbound",
    );

    expect(result.pending[0].existingDraft).not.toBeNull();
    expect(result.pending[0].existingDraft?.receivingNoteId).toBe("rn-draft-1");
    expect(result.pending[0].existingDraft?.items[0].receivedQty).toBe(7);
  });
});
