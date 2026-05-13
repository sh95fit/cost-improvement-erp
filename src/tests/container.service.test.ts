// src/tests/container.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getContainerSubsidiaries,
  getContainerSubsidiaryById,
  addContainerSlot,
  updateContainerSlot,
  deleteContainerSlot,
  checkContainerDependency,
  checkContainerSlotDependency,
} from "@/features/container/services/container.service";

const COMPANY_ID = "company-001";

const mockSubsidiary = {
  id: "sub-001",
  companyId: COMPANY_ID,
  name: "5칸 도시락",
  code: "SUB-CTG-001",
  subsidiaryType: "CONTAINER",
  deletedAt: null,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
  containerSlots: [],
};

const mockSlot = {
  id: "slot-001",
  subsidiaryMasterId: "sub-001",
  slotIndex: 1,
  label: "밥칸",
  volumeMl: 300,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════
// 용기(SubsidiaryMaster) 조회
// ════════════════════════════════════════

describe("getContainerSubsidiaries", () => {
  it("페이지네이션과 함께 CONTAINER 목록을 반환한다", async () => {
    const items = [{ ...mockSubsidiary, containerSlots: [mockSlot] }];
    mockPrisma.subsidiaryMaster.findMany.mockResolvedValue(items);
    mockPrisma.subsidiaryMaster.count.mockResolvedValue(1);

    const result = await getContainerSubsidiaries(COMPANY_ID, {
      page: 1,
      limit: 20,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].slots).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("검색어가 있으면 OR 조건에 포함한다", async () => {
    mockPrisma.subsidiaryMaster.findMany.mockResolvedValue([]);
    mockPrisma.subsidiaryMaster.count.mockResolvedValue(0);

    await getContainerSubsidiaries(COMPANY_ID, {
      page: 1,
      limit: 20,
      search: "도시락",
      sortBy: "name",
      sortOrder: "asc",
    });

    const callArgs = mockPrisma.subsidiaryMaster.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR[0].name.contains).toBe("도시락");
  });
});

describe("getContainerSubsidiaryById", () => {
  it("정상 조회 시 용기를 반환한다", async () => {
    mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue({
      ...mockSubsidiary,
      containerSlots: [mockSlot],
    });

    const result = await getContainerSubsidiaryById(COMPANY_ID, "sub-001");
    expect(result.id).toBe("sub-001");
    expect(result.slots).toHaveLength(1);
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.subsidiaryMaster.findFirst.mockResolvedValue(null);

    await expect(
      getContainerSubsidiaryById(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });
});

// ════════════════════════════════════════
// ContainerSlot
// ════════════════════════════════════════

describe("addContainerSlot", () => {
  it("기존 슬롯이 있으면 다음 인덱스로 생성한다", async () => {
    mockPrisma.containerSlot.findFirst.mockResolvedValue({ slotIndex: 3 });
    mockPrisma.containerSlot.create.mockResolvedValue({ ...mockSlot, slotIndex: 4 });

    const result = await addContainerSlot("sub-001", { label: "반찬칸", volumeMl: 200 });
    expect(result.slotIndex).toBe(4);
    const createArgs = mockPrisma.containerSlot.create.mock.calls[0][0];
    expect(createArgs.data.slotIndex).toBe(4);
    expect(createArgs.data.subsidiaryMasterId).toBe("sub-001");
  });

  it("첫 슬롯이면 인덱스 1로 생성한다", async () => {
    mockPrisma.containerSlot.findFirst.mockResolvedValue(null);
    mockPrisma.containerSlot.create.mockResolvedValue({ ...mockSlot, slotIndex: 1 });

    await addContainerSlot("sub-001", { label: "밥칸" });
    const createArgs = mockPrisma.containerSlot.create.mock.calls[0][0];
    expect(createArgs.data.slotIndex).toBe(1);
  });
});

describe("updateContainerSlot", () => {
  it("정상 수정 시 업데이트된 슬롯을 반환한다", async () => {
    mockPrisma.containerSlot.update.mockResolvedValue({ ...mockSlot, label: "수정된 칸" });

    const result = await updateContainerSlot("slot-001", { label: "수정된 칸" });
    expect(result.label).toBe("수정된 칸");
  });
});

describe("deleteContainerSlot", () => {
  it("의존성 없으면 삭제한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      subsidiaryMasterId: "sub-001",
      slotIndex: 1,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
    mockPrisma.containerSlot.delete.mockResolvedValue(mockSlot);

    const result = await deleteContainerSlot("slot-001");
    expect(result.id).toBe("slot-001");
  });

  it("RecipeBOMSlot 의존성이 있으면 DEPENDENCY 에러를 던진다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      subsidiaryMasterId: "sub-001",
      slotIndex: 1,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(3);

    await expect(deleteContainerSlot("slot-001")).rejects.toThrow("DEPENDENCY:");
  });
});

// ════════════════════════════════════════
// checkContainerDependency
// ════════════════════════════════════════

describe("checkContainerDependency", () => {
  it("의존성이 없으면 hasDependency false를 반환한다", async () => {
    mockPrisma.mealTemplateContainer.count.mockResolvedValue(0);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
    mockPrisma.containerSlot.count.mockResolvedValue(0);

    const result = await checkContainerDependency("sub-001");
    expect(result.hasDependency).toBe(false);
  });

  it("MealTemplateContainer 참조가 있으면 details에 포함한다", async () => {
    mockPrisma.mealTemplateContainer.count.mockResolvedValue(5);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
    mockPrisma.containerSlot.count.mockResolvedValue(0);

    const result = await checkContainerDependency("sub-001");
    expect(result.hasDependency).toBe(true);
    expect(result.details[0]).toContain("식단 템플릿 5건");
  });
});

describe("checkContainerSlotDependency", () => {
  it("슬롯이 없으면 의존성 없음을 반환한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue(null);

    const result = await checkContainerSlotDependency("nonexistent");
    expect(result.hasDependency).toBe(false);
  });

  it("RecipeBOMSlot 참조가 있으면 의존성 있음을 반환한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      subsidiaryMasterId: "sub-001",
      slotIndex: 2,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(3);

    const result = await checkContainerSlotDependency("slot-002");
    expect(result.hasDependency).toBe(true);
  });
});
