// src/tests/lineup-template-map.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getLineupTemplateMaps,
  getDefaultTemplateForSlot,
  upsertLineupTemplateMap,
  bulkUpsertLineupTemplateMaps,
  deleteLineupTemplateMap,
  deleteLineupTemplateMapBySlot,
} from "@/features/lineup/services/lineup-template-map.service";

const COMPANY_ID = "company-001";
const LINEUP_ID = "lineup-001";
const TPL_ID = "tmpl-001";
const TPL_ID2 = "tmpl-002";

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════
// getLineupTemplateMaps
// ════════════════════════════════════════

describe("getLineupTemplateMaps", () => {
  it("활성 매핑만 조회하고 slotType asc 정렬", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineupMealTemplateMap.findMany.mockResolvedValue([
      { id: "m1", slotType: "LUNCH", mealTemplate: { id: TPL_ID, name: "도시락" } },
    ]);

    const result = await getLineupTemplateMaps(COMPANY_ID, LINEUP_ID);

    expect(result).toHaveLength(1);
    const args = mockPrisma.lineupMealTemplateMap.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ lineupId: LINEUP_ID, deletedAt: null });
    expect(args.orderBy).toEqual({ slotType: "asc" });
  });

  it("라인업이 없으면 NOT_FOUND", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);
    await expect(
      getLineupTemplateMaps(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });
});

// ════════════════════════════════════════
// getDefaultTemplateForSlot
// ════════════════════════════════════════

describe("getDefaultTemplateForSlot", () => {
  it("(lineupId, slotType, deletedAt: null)로 단건 조회", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue({
      id: "m1",
      slotType: "LUNCH",
      mealTemplate: { id: TPL_ID, name: "도시락" },
    });

    const result = await getDefaultTemplateForSlot(
      COMPANY_ID,
      LINEUP_ID,
      "LUNCH"
    );

    expect(result?.id).toBe("m1");
    const args = mockPrisma.lineupMealTemplateMap.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      lineupId: LINEUP_ID,
      slotType: "LUNCH",
      deletedAt: null,
    });
  });

  it("매핑이 없으면 null 반환", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue(null);

    const result = await getDefaultTemplateForSlot(
      COMPANY_ID,
      LINEUP_ID,
      "DINNER"
    );
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════
// upsertLineupTemplateMap
// ════════════════════════════════════════

describe("upsertLineupTemplateMap", () => {
  it("활성 행이 있으면 update", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findFirst.mockResolvedValue({ id: TPL_ID });
    // tx 내 활성 행 조회
    mockPrisma.lineupMealTemplateMap.findFirst
      .mockResolvedValueOnce({ id: "m1" }); // active
    mockPrisma.lineupMealTemplateMap.update.mockResolvedValue({
      id: "m1",
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
      mealTemplate: { id: TPL_ID, name: "도시락" },
    });

    await upsertLineupTemplateMap(COMPANY_ID, LINEUP_ID, {
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
    });

    expect(mockPrisma.lineupMealTemplateMap.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1" },
        data: { mealTemplateId: TPL_ID },
      })
    );
    expect(mockPrisma.lineupMealTemplateMap.create).not.toHaveBeenCalled();
  });

  it("활성 행이 없고 soft-deleted 행이 있으면 복원 + update", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findFirst.mockResolvedValue({ id: TPL_ID });
    // 1) active 없음
    mockPrisma.lineupMealTemplateMap.findFirst
      .mockResolvedValueOnce(null)
      // 2) deleted 행 존재
      .mockResolvedValueOnce({ id: "m-deleted" });
    mockPrisma.lineupMealTemplateMap.update.mockResolvedValue({
      id: "m-deleted",
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
      deletedAt: null,
    });

    await upsertLineupTemplateMap(COMPANY_ID, LINEUP_ID, {
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
    });

    // 복원: deletedAt: null + mealTemplateId 갱신
    expect(mockPrisma.lineupMealTemplateMap.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m-deleted" },
        data: { mealTemplateId: TPL_ID, deletedAt: null },
      })
    );
    expect(mockPrisma.lineupMealTemplateMap.create).not.toHaveBeenCalled();
  });

  it("활성/soft-deleted 모두 없으면 create", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findFirst.mockResolvedValue({ id: TPL_ID });
    mockPrisma.lineupMealTemplateMap.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.lineupMealTemplateMap.create.mockResolvedValue({
      id: "m-new",
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
    });

    await upsertLineupTemplateMap(COMPANY_ID, LINEUP_ID, {
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
    });

    expect(mockPrisma.lineupMealTemplateMap.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineupId: LINEUP_ID,
          slotType: "LUNCH",
          mealTemplateId: TPL_ID,
        }),
      })
    );
    expect(mockPrisma.lineupMealTemplateMap.update).not.toHaveBeenCalled();
  });

  it("라인업 미존재 시 NOT_FOUND", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      upsertLineupTemplateMap(COMPANY_ID, "nonexistent", {
        slotType: "LUNCH",
        mealTemplateId: TPL_ID,
      })
    ).rejects.toThrow("NOT_FOUND");
  });

  it("템플릿이 다른 회사 소속이면 INVALID_TEMPLATE", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(null);

    await expect(
      upsertLineupTemplateMap(COMPANY_ID, LINEUP_ID, {
        slotType: "LUNCH",
        mealTemplateId: "other-company-tpl",
      })
    ).rejects.toThrow("INVALID_TEMPLATE");
  });
});

// ════════════════════════════════════════
// bulkUpsertLineupTemplateMaps
// ════════════════════════════════════════

describe("bulkUpsertLineupTemplateMaps", () => {
  it("빈 입력은 빈 배열 반환", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });

    const result = await bulkUpsertLineupTemplateMaps(COMPANY_ID, LINEUP_ID, {
      items: [],
    });

    expect(result).toEqual([]);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("입력 내 동일 slotType 중복은 후자가 우선", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findMany.mockResolvedValue([
      { id: TPL_ID2 },
    ]);
    mockPrisma.lineupMealTemplateMap.findMany.mockResolvedValue([]);
    mockPrisma.lineupMealTemplateMap.create.mockResolvedValue({
      id: "m-new",
      slotType: "LUNCH",
      mealTemplateId: TPL_ID2,
    });

    await bulkUpsertLineupTemplateMaps(COMPANY_ID, LINEUP_ID, {
      items: [
        { slotType: "LUNCH", mealTemplateId: TPL_ID },
        { slotType: "LUNCH", mealTemplateId: TPL_ID2 }, // 후자가 우선
      ],
    });

    // 단일 create 호출, TPL_ID2 사용
    expect(mockPrisma.lineupMealTemplateMap.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.lineupMealTemplateMap.create.mock.calls[0][0].data;
    expect(data.mealTemplateId).toBe(TPL_ID2);
  });

  it("템플릿 회사 소속 검증 실패 시 INVALID_TEMPLATE", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    // 2개 요청했는데 1개만 매칭
    mockPrisma.mealTemplate.findMany.mockResolvedValue([{ id: TPL_ID }]);

    await expect(
      bulkUpsertLineupTemplateMaps(COMPANY_ID, LINEUP_ID, {
        items: [
          { slotType: "LUNCH", mealTemplateId: TPL_ID },
          { slotType: "DINNER", mealTemplateId: "other-tpl" },
        ],
      })
    ).rejects.toThrow("INVALID_TEMPLATE");
  });

  it("활성 행은 update, 미존재는 create로 처리", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findMany.mockResolvedValue([
      { id: TPL_ID },
      { id: TPL_ID2 },
    ]);
    // LUNCH는 활성 행 존재, DINNER는 없음
    mockPrisma.lineupMealTemplateMap.findMany.mockResolvedValue([
      { id: "m-lunch", slotType: "LUNCH", deletedAt: null },
    ]);
    mockPrisma.lineupMealTemplateMap.update.mockResolvedValue({
      id: "m-lunch",
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
    });
    mockPrisma.lineupMealTemplateMap.create.mockResolvedValue({
      id: "m-dinner",
      slotType: "DINNER",
      mealTemplateId: TPL_ID2,
    });

    const result = await bulkUpsertLineupTemplateMaps(COMPANY_ID, LINEUP_ID, {
      items: [
        { slotType: "LUNCH", mealTemplateId: TPL_ID },
        { slotType: "DINNER", mealTemplateId: TPL_ID2 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(mockPrisma.lineupMealTemplateMap.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.lineupMealTemplateMap.create).toHaveBeenCalledTimes(1);
  });

  it("soft-deleted 행 복원 + update 처리", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.mealTemplate.findMany.mockResolvedValue([{ id: TPL_ID }]);
    // LUNCH soft-deleted 1건만 존재
    mockPrisma.lineupMealTemplateMap.findMany.mockResolvedValue([
      { id: "m-deleted", slotType: "LUNCH", deletedAt: new Date() },
    ]);
    mockPrisma.lineupMealTemplateMap.update.mockResolvedValue({
      id: "m-deleted",
      slotType: "LUNCH",
      mealTemplateId: TPL_ID,
      deletedAt: null,
    });

    await bulkUpsertLineupTemplateMaps(COMPANY_ID, LINEUP_ID, {
      items: [{ slotType: "LUNCH", mealTemplateId: TPL_ID }],
    });

    const updateArgs = mockPrisma.lineupMealTemplateMap.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "m-deleted" });
    expect(updateArgs.data).toEqual({
      mealTemplateId: TPL_ID,
      deletedAt: null,
    });
    expect(mockPrisma.lineupMealTemplateMap.create).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════
// deleteLineupTemplateMap
// ════════════════════════════════════════

describe("deleteLineupTemplateMap", () => {
  it("정상 soft-delete", async () => {
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue({
      id: "m1",
      lineup: { companyId: COMPANY_ID },
    });
    mockPrisma.lineupMealTemplateMap.update.mockResolvedValue({ id: "m1" });

    await deleteLineupTemplateMap(COMPANY_ID, "m1");

    const args = mockPrisma.lineupMealTemplateMap.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: "m1" });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });

  it("매핑 미존재 시 NOT_FOUND", async () => {
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue(null);

    await expect(
      deleteLineupTemplateMap(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });

  it("다른 회사 매핑이면 FORBIDDEN", async () => {
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue({
      id: "m1",
      lineup: { companyId: "other-company" },
    });

    await expect(
      deleteLineupTemplateMap(COMPANY_ID, "m1")
    ).rejects.toThrow("FORBIDDEN");
    expect(mockPrisma.lineupMealTemplateMap.update).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════
// deleteLineupTemplateMapBySlot
// ════════════════════════════════════════

describe("deleteLineupTemplateMapBySlot", () => {
  it("(lineupId, slotType)로 활성 매핑 soft-delete", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue({
      id: "m-lunch",
    });
    mockPrisma.lineupMealTemplateMap.update.mockResolvedValue({
      id: "m-lunch",
    });

    await deleteLineupTemplateMapBySlot(COMPANY_ID, LINEUP_ID, "LUNCH");

    const findArgs = mockPrisma.lineupMealTemplateMap.findFirst.mock.calls[0][0];
    expect(findArgs.where).toEqual({
      lineupId: LINEUP_ID,
      slotType: "LUNCH",
      deletedAt: null,
    });
    const updArgs = mockPrisma.lineupMealTemplateMap.update.mock.calls[0][0];
    expect(updArgs.where).toEqual({ id: "m-lunch" });
    expect(updArgs.data.deletedAt).toBeInstanceOf(Date);
  });

  it("해당 슬롯에 활성 매핑이 없으면 NOT_FOUND", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue({ id: LINEUP_ID });
    mockPrisma.lineupMealTemplateMap.findFirst.mockResolvedValue(null);

    await expect(
      deleteLineupTemplateMapBySlot(COMPANY_ID, LINEUP_ID, "DINNER")
    ).rejects.toThrow("NOT_FOUND");
  });

  it("라인업 미존재 시 NOT_FOUND", async () => {
    mockPrisma.lineup.findFirst.mockResolvedValue(null);

    await expect(
      deleteLineupTemplateMapBySlot(COMPANY_ID, "nonexistent", "LUNCH")
    ).rejects.toThrow("NOT_FOUND");
  });
});
