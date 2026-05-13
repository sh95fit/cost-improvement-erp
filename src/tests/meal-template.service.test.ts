// src/tests/meal-template.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "./mocks/prisma";

import {
  getMealTemplates,
  getMealTemplateById,
  createMealTemplate,
  updateMealTemplate,
  deleteMealTemplate,
  addMealTemplateContainer,
  updateMealTemplateContainer,
  deleteMealTemplateContainer,
  addMealTemplateAccessory,
  updateMealTemplateAccessory,
  deleteMealTemplateAccessory,
} from "@/features/meal-template/services/meal-template.service";

const COMPANY_ID = "company-001";

const mockTemplate = {
  id: "tmpl-001",
  companyId: COMPANY_ID,
  name: "5칸 도시락 템플릿",
  createdAt: new Date("2026-05-12"),
  updatedAt: new Date("2026-05-12"),
  containers: [],
  accessories: [],
  _count: { containers: 0, accessories: 0 },
};

const mockContainer = {
  id: "cont-001",
  mealTemplateId: "tmpl-001",
  subsidiaryMasterId: "sub-001",
  sortOrder: 0,
  subsidiaryMaster: { id: "sub-001", name: "5칸 도시락", code: "SUB-CTG-001" },
};

const mockAccessory = {
  id: "acc-001",
  mealTemplateId: "tmpl-001",
  subsidiaryMasterId: "sub-002",
  consumptionType: "PER_MEAL_COUNT",
  fixedQuantity: null,
  isRequired: false,
  subsidiaryMaster: { id: "sub-002", name: "수저 세트", code: "SUB-ACC-001" },
};

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
    expect(result.pagination.total).toBe(1);
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
    expect(callArgs.where.OR[0].name.contains).toBe("도시락");
  });
});

describe("getMealTemplateById", () => {
  it("정상 조회 시 템플릿을 반환한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(mockTemplate);

    const result = await getMealTemplateById(COMPANY_ID, "tmpl-001");
    expect(result?.id).toBe("tmpl-001");
  });

  it("존재하지 않으면 null을 반환한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(null);

    const result = await getMealTemplateById(COMPANY_ID, "nonexistent");
    expect(result).toBeNull();
  });
});

describe("createMealTemplate", () => {
  it("템플릿을 생성한다", async () => {
    mockPrisma.mealTemplate.create.mockResolvedValue(mockTemplate);

    const result = await createMealTemplate(COMPANY_ID, { name: "5칸 도시락 템플릿" });
    expect(result.id).toBe("tmpl-001");
    const createArgs = mockPrisma.mealTemplate.create.mock.calls[0][0];
    expect(createArgs.data.companyId).toBe(COMPANY_ID);
    expect(createArgs.data.name).toBe("5칸 도시락 템플릿");
  });
});

describe("updateMealTemplate", () => {
  it("정상 수정 시 업데이트된 템플릿을 반환한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(mockTemplate);
    mockPrisma.mealTemplate.update.mockResolvedValue({ ...mockTemplate, name: "수정된 템플릿" });

    const result = await updateMealTemplate(COMPANY_ID, "tmpl-001", { name: "수정된 템플릿" });
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
  it("트랜잭션으로 컨테이너·악세서리와 함께 삭제한다", async () => {
    mockPrisma.mealTemplate.findFirst.mockResolvedValue(mockTemplate);
    mockPrisma.mealTemplateAccessory.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.mealTemplateContainer.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.mealTemplate.delete.mockResolvedValue(mockTemplate);

    const result = await deleteMealTemplate(COMPANY_ID, "tmpl-001");

    expect(result.id).toBe("tmpl-001");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.mealTemplateAccessory.deleteMany).toHaveBeenCalledWith({
      where: { mealTemplateId: "tmpl-001" },
    });
    expect(mockPrisma.mealTemplateContainer.deleteMany).toHaveBeenCalledWith({
      where: { mealTemplateId: "tmpl-001" },
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
// MealTemplateContainer (v5: Slot 대체)
// ════════════════════════════════════════

describe("addMealTemplateContainer", () => {
  it("컨테이너를 정상 생성한다", async () => {
    mockPrisma.mealTemplateContainer.create.mockResolvedValue(mockContainer);

    const result = await addMealTemplateContainer("tmpl-001", {
      subsidiaryMasterId: "sub-001",
      sortOrder: 0,
    });

    expect(result.subsidiaryMaster.name).toBe("5칸 도시락");
    const createArgs = mockPrisma.mealTemplateContainer.create.mock.calls[0][0];
    expect(createArgs.data.mealTemplateId).toBe("tmpl-001");
  });
});

describe("updateMealTemplateContainer", () => {
  it("정상 수정 시 업데이트된 컨테이너를 반환한다", async () => {
    mockPrisma.mealTemplateContainer.findFirst.mockResolvedValue(mockContainer);
    mockPrisma.mealTemplateContainer.update.mockResolvedValue({ ...mockContainer, sortOrder: 1 });

    const result = await updateMealTemplateContainer("cont-001", { sortOrder: 1 });
    expect(result.sortOrder).toBe(1);
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateContainer.findFirst.mockResolvedValue(null);

    await expect(
      updateMealTemplateContainer("nonexistent", { sortOrder: 0 })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("deleteMealTemplateContainer", () => {
  it("정상 삭제 시 삭제된 컨테이너를 반환한다", async () => {
    mockPrisma.mealTemplateContainer.findFirst.mockResolvedValue(mockContainer);
    mockPrisma.mealTemplateContainer.delete.mockResolvedValue(mockContainer);

    const result = await deleteMealTemplateContainer("cont-001");
    expect(result.id).toBe("cont-001");
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateContainer.findFirst.mockResolvedValue(null);

    await expect(deleteMealTemplateContainer("nonexistent")).rejects.toThrow("NOT_FOUND");
  });
});

// ════════════════════════════════════════
// MealTemplateAccessory (v5: subsidiaryMasterId 기반)
// ════════════════════════════════════════

describe("addMealTemplateAccessory", () => {
  it("악세서리를 정상 생성한다", async () => {
    mockPrisma.mealTemplateAccessory.create.mockResolvedValue(mockAccessory);

    const result = await addMealTemplateAccessory("tmpl-001", {
      subsidiaryMasterId: "sub-002",
      consumptionType: "PER_MEAL_COUNT",
      isRequired: false,
    });

    expect(result.subsidiaryMaster.name).toBe("수저 세트");
    const createArgs = mockPrisma.mealTemplateAccessory.create.mock.calls[0][0];
    expect(createArgs.data.mealTemplateId).toBe("tmpl-001");
  });
});

describe("updateMealTemplateAccessory", () => {
  it("정상 수정 시 업데이트된 악세서리를 반환한다", async () => {
    mockPrisma.mealTemplateAccessory.findFirst.mockResolvedValue(mockAccessory);
    mockPrisma.mealTemplateAccessory.update.mockResolvedValue({
      ...mockAccessory,
      isRequired: true,
    });

    const result = await updateMealTemplateAccessory("acc-001", { isRequired: true });
    expect(result.isRequired).toBe(true);
  });

  it("존재하지 않으면 NOT_FOUND 에러를 던진다", async () => {
    mockPrisma.mealTemplateAccessory.findFirst.mockResolvedValue(null);

    await expect(
      updateMealTemplateAccessory("nonexistent", { isRequired: true })
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

    await expect(deleteMealTemplateAccessory("nonexistent")).rejects.toThrow("NOT_FOUND");
  });
});
