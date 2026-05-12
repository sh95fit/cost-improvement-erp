// src/tests/meal-template.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getMealTemplates,
  getMealTemplateById,
  createMealTemplate,
  updateMealTemplate,
  deleteMealTemplate,
  addMealTemplateSlot,
  updateMealTemplateSlot,
  deleteMealTemplateSlot,
  addMealTemplateAccessory,
  updateMealTemplateAccessory,
  deleteMealTemplateAccessory,
} from "@/features/meal-template/services/meal-template.service";

// ── 테스트 공통 데이터 ──
const COMPANY_ID = "company-001";

const mockTemplate = {
  id: "tmpl-001",
  companyId: COMPANY_ID,
  name: "5칸 도시락 템플릿",
  containerGroupId: "group-001",
  createdAt: new Date("2026-05-12"),
  updatedAt: new Date("2026-05-12"),
  containerGroup: { id: "group-001", name: "5칸 도시락", code: "CTG-001" },
  slots: [],
  accessories: [],
  _count: { slots: 0, accessories: 0 },
};

const mockSlot = {
  id: "slot-001",
  mealTemplateId: "tmpl-001",
  slotIndex: 0,
  label: "밥칸",
  isRequired: true,
};

const mockAccessory = {
  id: "acc-001",
  mealTemplateId: "tmpl-001",
  name: "젓가락",
  isRequired: false,
};

// ── 테스트 시작 ──

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════
// MealTemplate CRUD
// ════════════════════════════════════════

describe("getMealTemplates", () => {
  it("페이지네이션과 함께 목록을 반환한다", async () => {
    mockPrisma.mealTemplate.findMany.mockResolvedValue([mockTemplate]);
    mockPrisma.mealTemplate.count.mockResolvedValue(1);

    const result = await getMealTemplates(COMPANY_ID, {
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(mockPrisma.mealTemplate.findMany).toHaveBeenCalledOnce();
    expect(mockPrisma.mealTemplate.count).toHaveBeenCalledOnce();
  });

  it("검색어가 있으면 OR 조건에 포함한다", async () => {
    mockPrisma.mealTemplate.findMany.mockResolvedValue([]);
    mockPrisma.mealTemplate.count.mockResolvedValue(0);

    await getMealTemplates(COMPANY_ID, {
      page: 1,
      limit: 20,
      search: "도시락",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const callArgs = mockPrisma.mealTemplate.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(2);
    expect(callArgs.where.OR[0].name.contains).toBe("도시락");
  });

  it("2페이지 요청 시 skip이 올바르다", async () => {
    mockPrisma.mealTemplate.findMany.mockResolvedValue([]);
    mockPrisma.mealTemplate.count.mockResolvedValue(25);

    const result = await getMealTemplates(COMPANY_ID, {
      page: 2,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const callArgs = mockPrisma.mealTemplate.findMany.mock.calls[0][0];
    expect(callArgs.skip).toBe(20);
    expect(callArgs.take).toBe(20);
    expect(result.pagination.totalPages).toBe(2);
  });
});

describe("getMealTemplateById", () => {
  it("정상 조회 시 템플릿을 반환한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(mockTemplate);

    const result = await getMealTemplateById(COMPANY_ID, "tmpl-001");
    expect(result?.id).toBe("tmpl-001");
    expect(result?.name).toBe("5칸 도시락 템플릿");
  });

  it("존재하지 않으면 null을 반환한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(null);

    const result = await getMealTemplateById(COMPANY_ID, "nonexistent");
    expect(result).toBeNull();
  });
});

describe("createMealTemplate", () => {
  it("템플릿을 생성하고 include와 함께 반환한다", async () => {
    mockPrisma.mealTemplate.create.mockResolvedValue(mockTemplate);

    const result = await createMealTemplate(COMPANY_ID, {
      name: "5칸 도시락 템플릿",
      containerGroupId: "group-001",
    });

    expect(result.id).toBe("tmpl-001");
    expect(result.containerGroup.name).toBe("5칸 도시락");
    const createArgs = mockPrisma.mealTemplate.create.mock.calls[0][0];
    expect(createArgs.data.companyId).toBe(COMPANY_ID);
    expect(createArgs.data.name).toBe("5칸 도시락 템플릿");
    expect(createArgs.data.containerGroupId).toBe("group-001");
  });
});

describe("updateMealTemplate", () => {
  it("정상 수정 시 업데이트된 템플릿을 반환한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(mockTemplate);
    mockPrisma.mealTemplate.update.mockResolvedValue({
      ...mockTemplate,
      name: "수정된 템플릿",
    });

    const result = await updateMealTemplate(COMPANY_ID, "tmpl-001", {
      name: "수정된 템플릿",
    });

    expect(result.name).toBe("수정된 템플릿");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(null);

    await expect(
      updateMealTemplate(COMPANY_ID, "nonexistent", { name: "test" })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("deleteMealTemplate", () => {
  it("트랜잭션으로 슬롯·악세서리와 함께 삭제한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(mockTemplate);
    mockPrisma.mealTemplateAccessory.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.mealTemplateSlot.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.mealTemplate.delete.mockResolvedValue(mockTemplate);

    const result = await deleteMealTemplate(COMPANY_ID, "tmpl-001");

    expect(result.id).toBe("tmpl-001");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.mealTemplateAccessory.deleteMany).toHaveBeenCalledWith({
      where: { mealTemplateId: "tmpl-001" },
    });
    expect(mockPrisma.mealTemplateSlot.deleteMany).toHaveBeenCalledWith({
      where: { mealTemplateId: "tmpl-001" },
    });
    expect(mockPrisma.mealTemplate.delete).toHaveBeenCalledWith({
      where: { id: "tmpl-001" },
    });
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(null);

    await expect(
      deleteMealTemplate(COMPANY_ID, "nonexistent")
    ).rejects.toThrow("NOT_FOUND");
  });
});

// ════════════════════════════════════════
// MealTemplateSlot CRUD
// ════════════════════════════════════════

describe("addMealTemplateSlot", () => {
  it("슬롯을 정상 생성한다", async () => {
    mockPrisma.mealTemplateSlot.findFirst.mockResolvedValue(null);
    mockPrisma.mealTemplateSlot.create.mockResolvedValue(mockSlot);

    const result = await addMealTemplateSlot("tmpl-001", {
      slotIndex: 0,
      label: "밥칸",
      isRequired: true,
    });

    expect(result.label).toBe("밥칸");
    expect(result.slotIndex).toBe(0);
    const createArgs = mockPrisma.mealTemplateSlot.create.mock.calls[0][0];
    expect(createArgs.data.mealTemplateId).toBe("tmpl-001");
  });

  it("동일 slotIndex가 이미 있으면 DUPLICATE_SLOT_INDEX 에러를 던진다", async () => {
    mockPrisma.mealTemplateSlot.findFirst.mockResolvedValue(mockSlot);

    await expect(
      addMealTemplateSlot("tmpl-001", {
        slotIndex: 0,
        label: "중복칸",
        isRequired: true,
      })
    ).rejects.toThrow("DUPLICATE_SLOT_INDEX");
  });
});

describe("updateMealTemplateSlot", () => {
  it("정상 수정 시 업데이트된 슬롯을 반환한다", async () => {
    mockPrisma.mealTemplateSlot.findFirst.mockResolvedValue(mockSlot);
    mockPrisma.mealTemplateSlot.update.mockResolvedValue({
      ...mockSlot,
      label: "국칸",
    });

    const result = await updateMealTemplateSlot("slot-001", { label: "국칸" });
    expect(result.label).toBe("국칸");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateSlot.findFirst.mockResolvedValue(null);

    await expect(
      updateMealTemplateSlot("nonexistent", { label: "test" })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("deleteMealTemplateSlot", () => {
  it("정상 삭제 시 삭제된 슬롯을 반환한다", async () => {
    mockPrisma.mealTemplateSlot.findFirst.mockResolvedValue(mockSlot);
    mockPrisma.mealTemplateSlot.delete.mockResolvedValue(mockSlot);

    const result = await deleteMealTemplateSlot("slot-001");
    expect(result.id).toBe("slot-001");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateSlot.findFirst.mockResolvedValue(null);

    await expect(deleteMealTemplateSlot("nonexistent")).rejects.toThrow(
      "NOT_FOUND"
    );
  });
});

// ════════════════════════════════════════
// MealTemplateAccessory CRUD
// ════════════════════════════════════════

describe("addMealTemplateAccessory", () => {
  it("악세서리를 정상 생성한다", async () => {
    mockPrisma.mealTemplateAccessory.create.mockResolvedValue(mockAccessory);

    const result = await addMealTemplateAccessory("tmpl-001", {
      name: "젓가락",
      isRequired: false,
    });

    expect(result.name).toBe("젓가락");
    const createArgs = mockPrisma.mealTemplateAccessory.create.mock.calls[0][0];
    expect(createArgs.data.mealTemplateId).toBe("tmpl-001");
  });
});

describe("updateMealTemplateAccessory", () => {
  it("정상 수정 시 업데이트된 악세서리를 반환한다", async () => {
    mockPrisma.mealTemplateAccessory.findFirst.mockResolvedValue(mockAccessory);
    mockPrisma.mealTemplateAccessory.update.mockResolvedValue({
      ...mockAccessory,
      name: "포크",
    });

    const result = await updateMealTemplateAccessory("acc-001", { name: "포크" });
    expect(result.name).toBe("포크");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateAccessory.findFirst.mockResolvedValue(null);

    await expect(
      updateMealTemplateAccessory("nonexistent", { name: "test" })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("deleteMealTemplateAccessory", () => {
  it("정상 삭제 시 삭제된 악세서리를 반환한다", async () => {
    mockPrisma.mealTemplateAccessory.findFirst.mockResolvedValue(mockAccessory);
    mockPrisma.mealTemplateAccessory.delete.mockResolvedValue(mockAccessory);

    const result = await deleteMealTemplateAccessory("acc-001");
    expect(result.id).toBe("acc-001");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateAccessory.findFirst.mockResolvedValue(null);

    await expect(deleteMealTemplateAccessory("nonexistent")).rejects.toThrow(
      "NOT_FOUND"
    );
  });
});
