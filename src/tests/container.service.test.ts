// src/tests/container.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "./mocks/prisma";

// 서비스 import (mocks/prisma.ts에서 vi.mock 처리 완료)
import {
  getContainerGroups,
  getContainerGroupById,
  createContainerGroup,
  updateContainerGroup,
  deleteContainerGroup,
  addContainerSlot,
  updateContainerSlot,
  deleteContainerSlot,
  checkContainerGroupDependency,
  checkContainerSlotDependency,
  addContainerAccessory,
  updateContainerAccessory,
  deleteContainerAccessory,
} from "@/features/container/services/container.service";

// ── 테스트 공통 데이터 ──
const COMPANY_ID = "company-001";

const mockGroup = {
  id: "group-001",
  companyId: COMPANY_ID,
  name: "5칸 도시락",
  code: "CTG-001",
  deletedAt: null,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
};

const mockSlot = {
  id: "slot-001",
  containerGroupId: "group-001",
  slotIndex: 1,
  label: "밥칸",
  volumeMl: 300,
};

// ── 테스트 시작 ──

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════
// ContainerGroup
// ════════════════════════════════════════

describe("getContainerGroups", () => {
  it("페이지네이션과 함께 목록을 반환한다", async () => {
    const items = [{ ...mockGroup, slots: [mockSlot] }];
    mockPrisma.containerGroup.findMany.mockResolvedValue(items);
    mockPrisma.containerGroup.count.mockResolvedValue(1);

    const result = await getContainerGroups(COMPANY_ID, {
      page: 1,
      limit: 20,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(mockPrisma.containerGroup.findMany).toHaveBeenCalledOnce();
    expect(mockPrisma.containerGroup.count).toHaveBeenCalledOnce();
  });

  it("검색어가 있으면 OR 조건에 포함한다", async () => {
    mockPrisma.containerGroup.findMany.mockResolvedValue([]);
    mockPrisma.containerGroup.count.mockResolvedValue(0);

    await getContainerGroups(COMPANY_ID, {
      page: 1,
      limit: 20,
      search: "도시락",
      sortBy: "name",
      sortOrder: "asc",
    });

    const callArgs = mockPrisma.containerGroup.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(2);
    expect(callArgs.where.OR[0].name.contains).toBe("도시락");
  });

  it("2페이지 요청 시 skip이 올바르다", async () => {
    mockPrisma.containerGroup.findMany.mockResolvedValue([]);
    mockPrisma.containerGroup.count.mockResolvedValue(25);

    const result = await getContainerGroups(COMPANY_ID, {
      page: 2,
      limit: 20,
      sortBy: "name",
      sortOrder: "asc",
    });

    const callArgs = mockPrisma.containerGroup.findMany.mock.calls[0][0];
    expect(callArgs.skip).toBe(20);
    expect(callArgs.take).toBe(20);
    expect(result.pagination.totalPages).toBe(2);
  });
});

describe("getContainerGroupById", () => {
  it("정상 조회 시 그룹을 반환한다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue({
      ...mockGroup,
      slots: [mockSlot],
    });

    const result = await getContainerGroupById(COMPANY_ID, "group-001");
    expect(result.id).toBe("group-001");
    expect(result.name).toBe("5칸 도시락");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(null);

    await expect(
      getContainerGroupById(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("createContainerGroup", () => {
  it("코드를 자동 생성하고 그룹을 생성한다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue({
      code: "CTG-003",
    });
    mockPrisma.containerGroup.create.mockResolvedValue({
      ...mockGroup,
      code: "CTG-004",
      slots: [],
    });

    const result = await createContainerGroup(COMPANY_ID, {
      name: "새 용기",
    });

    expect(mockPrisma.containerGroup.create).toHaveBeenCalledOnce();
    const createArgs = mockPrisma.containerGroup.create.mock.calls[0][0];
    expect(createArgs.data.code).toBe("CTG-004");
    expect(createArgs.data.companyId).toBe(COMPANY_ID);
    expect(result.code).toBe("CTG-004");
  });

  it("첫 그룹이면 CTG-001 코드를 생성한다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(null);
    mockPrisma.containerGroup.create.mockResolvedValue({
      ...mockGroup,
      code: "CTG-001",
      slots: [],
    });

    await createContainerGroup(COMPANY_ID, { name: "첫 용기" });

    const createArgs = mockPrisma.containerGroup.create.mock.calls[0][0];
    expect(createArgs.data.code).toBe("CTG-001");
  });
});

describe("updateContainerGroup", () => {
  it("정상 수정 시 업데이트된 그룹을 반환한다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(mockGroup);
    mockPrisma.containerGroup.update.mockResolvedValue({
      ...mockGroup,
      name: "수정된 용기",
    });

    const result = await updateContainerGroup(COMPANY_ID, "group-001", {
      name: "수정된 용기",
    });

    expect(result.name).toBe("수정된 용기");
    expect(mockPrisma.containerGroup.update).toHaveBeenCalledWith({
      where: { id: "group-001" },
      data: { name: "수정된 용기" },
    });
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(null);

    await expect(
      updateContainerGroup(COMPANY_ID, "nonexistent", { name: "test" })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("deleteContainerGroup", () => {
  it("의존성 없으면 soft-delete 한다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(mockGroup);
    mockPrisma.mealTemplate.count.mockResolvedValue(0);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
    mockPrisma.containerGroup.update.mockResolvedValue({
      ...mockGroup,
      deletedAt: new Date(),
    });

    const result = await deleteContainerGroup(COMPANY_ID, "group-001");
    expect(result.deletedAt).not.toBeNull();
    expect(mockPrisma.containerGroup.update).toHaveBeenCalledWith({
      where: { id: "group-001" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(null);

    await expect(
      deleteContainerGroup(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });

  it("MealTemplate 의존성이 있으면 DEPENDENCY 에러를 던진다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(mockGroup);
    mockPrisma.mealTemplate.count.mockResolvedValue(3);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);

    await expect(
      deleteContainerGroup(COMPANY_ID, "group-001")
    ).rejects.toThrow("DEPENDENCY:");
  });

  it("RecipeBOMSlot 의존성이 있으면 DEPENDENCY 에러를 던진다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(mockGroup);
    mockPrisma.mealTemplate.count.mockResolvedValue(0);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(5);

    await expect(
      deleteContainerGroup(COMPANY_ID, "group-001")
    ).rejects.toThrow("DEPENDENCY:");
  });

  it("양쪽 의존성 모두 있으면 두 사용처를 모두 표시한다", async () => {
    mockPrisma.containerGroup.findFirst.mockResolvedValue(mockGroup);
    mockPrisma.mealTemplate.count.mockResolvedValue(2);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(4);

    try {
      await deleteContainerGroup(COMPANY_ID, "group-001");
      expect.unreachable("에러가 발생해야 합니다");
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).toContain("식단 템플릿 2건");
      expect(msg).toContain("레시피 BOM 슬롯 4건");
    }
  });
});

// ════════════════════════════════════════
// ContainerSlot
// ════════════════════════════════════════

describe("addContainerSlot", () => {
  it("기존 슬롯이 있으면 다음 인덱스로 생성한다", async () => {
    mockPrisma.containerSlot.findFirst.mockResolvedValue({ slotIndex: 3 });
    mockPrisma.containerSlot.create.mockResolvedValue({
      ...mockSlot,
      slotIndex: 4,
    });

    const result = await addContainerSlot("group-001", {
      label: "반찬칸",
      volumeMl: 200,
    });

    expect(result.slotIndex).toBe(4);
    const createArgs = mockPrisma.containerSlot.create.mock.calls[0][0];
    expect(createArgs.data.slotIndex).toBe(4);
  });

  it("첫 슬롯이면 인덱스 1로 생성한다", async () => {
    mockPrisma.containerSlot.findFirst.mockResolvedValue(null);
    mockPrisma.containerSlot.create.mockResolvedValue({
      ...mockSlot,
      slotIndex: 1,
    });

    const result = await addContainerSlot("group-001", {
      label: "밥칸",
    });

    const createArgs = mockPrisma.containerSlot.create.mock.calls[0][0];
    expect(createArgs.data.slotIndex).toBe(1);
    expect(result.slotIndex).toBe(1);
  });

  it("volumeMl이 없으면 null로 저장한다", async () => {
    mockPrisma.containerSlot.findFirst.mockResolvedValue(null);
    mockPrisma.containerSlot.create.mockResolvedValue({
      ...mockSlot,
      volumeMl: null,
    });

    await addContainerSlot("group-001", { label: "밥칸" });

    const createArgs = mockPrisma.containerSlot.create.mock.calls[0][0];
    expect(createArgs.data.volumeMl).toBeNull();
  });
});

describe("updateContainerSlot", () => {
  it("정상 수정 시 업데이트된 슬롯을 반환한다", async () => {
    mockPrisma.containerSlot.update.mockResolvedValue({
      ...mockSlot,
      label: "수정된 칸",
    });

    const result = await updateContainerSlot("slot-001", {
      label: "수정된 칸",
    });

    expect(result.label).toBe("수정된 칸");
    expect(mockPrisma.containerSlot.update).toHaveBeenCalledWith({
      where: { id: "slot-001" },
      data: { label: "수정된 칸" },
    });
  });
});

describe("deleteContainerSlot", () => {
  it("의존성 없으면 삭제한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      containerGroupId: "group-001",
      slotIndex: 1,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);
    mockPrisma.containerSlot.delete.mockResolvedValue(mockSlot);

    const result = await deleteContainerSlot("slot-001");
    expect(result.id).toBe("slot-001");
    expect(mockPrisma.containerSlot.delete).toHaveBeenCalledWith({
      where: { id: "slot-001" },
    });
  });

  it("RecipeBOMSlot 의존성이 있으면 DEPENDENCY 에러를 던진다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      containerGroupId: "group-001",
      slotIndex: 1,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(3);

    await expect(deleteContainerSlot("slot-001")).rejects.toThrow(
      "DEPENDENCY:"
    );
  });

  it("슬롯이 존재하지 않으면 의존성 없이 바로 삭제를 시도한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue(null);
    mockPrisma.containerSlot.delete.mockResolvedValue(mockSlot);

    await deleteContainerSlot("nonexistent");
    expect(mockPrisma.containerSlot.delete).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════
// checkContainerGroupDependency
// ════════════════════════════════════════

describe("checkContainerGroupDependency", () => {
  it("의존성이 없으면 hasDependency false를 반환한다", async () => {
    mockPrisma.mealTemplate.count.mockResolvedValue(0);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);

    const result = await checkContainerGroupDependency("group-001");
    expect(result.hasDependency).toBe(false);
    expect(result.details).toHaveLength(0);
  });

  it("MealTemplate 참조가 있으면 details에 포함한다", async () => {
    mockPrisma.mealTemplate.count.mockResolvedValue(5);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);

    const result = await checkContainerGroupDependency("group-001");
    expect(result.hasDependency).toBe(true);
    expect(result.details[0]).toContain("식단 템플릿 5건");
  });

  it("RecipeBOMSlot 참조가 있으면 details에 포함한다", async () => {
    mockPrisma.mealTemplate.count.mockResolvedValue(0);
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(7);

    const result = await checkContainerGroupDependency("group-001");
    expect(result.hasDependency).toBe(true);
    expect(result.details[0]).toContain("레시피 BOM 슬롯 7건");
  });
});

describe("checkContainerSlotDependency", () => {
  it("슬롯이 없으면 의존성 없음을 반환한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue(null);

    const result = await checkContainerSlotDependency("nonexistent");
    expect(result.hasDependency).toBe(false);
    expect(result.details).toHaveLength(0);
  });

  it("RecipeBOMSlot 참조가 있으면 의존성 있음을 반환한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      containerGroupId: "group-001",
      slotIndex: 2,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(3);

    const result = await checkContainerSlotDependency("slot-002");
    expect(result.hasDependency).toBe(true);
    expect(result.details[0]).toContain("레시피 BOM 슬롯 3건");
  });

  it("RecipeBOMSlot 참조가 없으면 의존성 없음을 반환한다", async () => {
    mockPrisma.containerSlot.findUnique.mockResolvedValue({
      containerGroupId: "group-001",
      slotIndex: 1,
    });
    mockPrisma.recipeBOMSlot.count.mockResolvedValue(0);

    const result = await checkContainerSlotDependency("slot-001");
    expect(result.hasDependency).toBe(false);
    expect(result.details).toHaveLength(0);
  });
});

// ════════════════════════════════════════
// ContainerAccessory
// ════════════════════════════════════════

describe("addContainerAccessory", () => {
  it("부속품을 생성한다", async () => {
    const mockAccessory = {
      id: "acc-001",
      containerGroupId: "group-001",
      name: "젓가락",
      description: "일회용 젓가락",
    };
    mockPrisma.containerAccessory.create.mockResolvedValue(mockAccessory);

    const result = await addContainerAccessory("group-001", {
      name: "젓가락",
      description: "일회용 젓가락",
    });

    expect(result.name).toBe("젓가락");
    expect(mockPrisma.containerAccessory.create).toHaveBeenCalledWith({
      data: {
        name: "젓가락",
        description: "일회용 젓가락",
        containerGroupId: "group-001",
      },
    });
  });
});

describe("updateContainerAccessory", () => {
  it("부속품을 수정한다", async () => {
    mockPrisma.containerAccessory.update.mockResolvedValue({
      id: "acc-001",
      name: "포크",
    });

    const result = await updateContainerAccessory("acc-001", { name: "포크" });
    expect(result.name).toBe("포크");
  });
});

describe("deleteContainerAccessory", () => {
  it("부속품을 삭제한다", async () => {
    mockPrisma.containerAccessory.delete.mockResolvedValue({ id: "acc-001" });

    const result = await deleteContainerAccessory("acc-001");
    expect(result.id).toBe("acc-001");
  });
});
