// src/app/(dashboard)/meal-plans/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  PlusCircle,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Copy,
  Eye,
  Package,
  Truck,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import {
  getMealPlanGroupsAction,
  getMealPlanGroupByIdAction,
  createMealPlanGroupAction,
  updateMealPlanGroupAction,
  deleteMealPlanGroupAction,
  copyMealPlanGroupAction,
  createMealPlanAction,
  deleteMealPlanAction,
  deleteMealPlanSlotAction,
  updateMealPlanSlotAction,         
  upsertMealCountAction,
  deleteMealCountAction,
  getActiveProductionLinesAction,
  bulkCreateContainerSlotsAction,
  applyMealTemplateAction,
  createMealPlanAccessoryAction,   
  updateMealPlanAccessoryAction,   
  deleteMealPlanAccessoryAction,    
} from "@/features/meal-plan/actions/meal-plan.action";

import { getMealTemplatesAction } from "@/features/meal-template/actions/meal-template.action";
import { getContainerGroupsAction } from "@/features/container/actions/container.action";
import { getSubsidiariesAction as getMaterialSubsidiariesAction } from "@/features/material/actions/material.action";
import { getEligibleRecipesForContainerSlotAction } from "@/features/recipe/actions/recipe-bom.action";
import { loadAllPages } from "@/lib/action-helpers";
import type { PaginatedFetcher } from "@/lib/action-helpers";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { LineupSelect } from "@/components/lineup/lineup-select";
import {
  getActiveCompanyMealSlotsAction,
  type CompanyMealSlotOption,
} from "@/features/company-meal-slot/actions/company-meal-slot.action";

import {
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_ORDER,
  ALLOWED_FORWARD_TRANSITIONS,
  CONSUMPTION_MODE_LABEL,
} from "@/features/meal-plan/constants/status-label";

// ══════════════════════════════════════════════════════════════
// 타입 (Phase 5-R v2 도메인 — service의 GROUP_DETAIL_INCLUDE 응답에 맞춤)
// ══════════════════════════════════════════════════════════════

type LineupInfo = { id: string; name: string; code: string };
type RecipeInfo = { id: string; name: string; code: string };
type SubsidiaryInfo = { id: string; name: string; code: string };
type SupplierItemInfo = {
  id: string;
  productName: string;
  supplierItemCode: string | null;
  supplier: { id: string; name: string };
};
type ProductionLineInfo = { id: string; name: string };
type MealTemplateInfo = { id: string; name: string };

// SlotKind에 따라 표시되는 필드가 다름 — 둘 다 옵셔널로 받음
type MealPlanSlotRow = {
  id: string;
  kind: "CONTAINER" | "DIRECT";
  sortOrder: number;
  // ★ Phase 9-D-Sym: 슬롯 수량 대칭 분리
  //   - estimatedQuantity: 식단 작성 시 입력 (CONFIRMED→IN_PROGRESS 검증 대상)
  //   - finalQuantity:     실제 사용 후 입력 (IN_PROGRESS→COMPLETED 검증 대상, nullable)
  estimatedQuantity: number;
  finalQuantity: number | null;
  note: string | null;
  containerSlotIndex: number | null;
  recipe: RecipeInfo | null;
  subsidiaryMaster: SubsidiaryInfo | null;
  supplierItem: SupplierItemInfo | null;
  productionLine: ProductionLineInfo | null;
};

type MealPlanAccessoryRow = {
  id: string;
  subsidiaryMasterId: string;
  consumptionMode: "PER_MEAL_COUNT" | "FIXED_QUANTITY";
  fixedQuantity: number | null;
  required: boolean;
  quantity: number;
  note: string | null;
  subsidiaryMaster: SubsidiaryInfo;
};

type CompanyMealSlotInfo = {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
};

type MealPlanRow = {
  id: string;
  companyMealSlotId: string;
  companyMealSlot: CompanyMealSlotInfo | null;
  lineupId: string;
  mealTemplateId: string | null;
  note: string | null;
  lineup: LineupInfo;
  mealTemplate: MealTemplateInfo | null;
  slots: MealPlanSlotRow[];
  accessories: MealPlanAccessoryRow[];
};

type MealCountRow = {
  id: string;
  companyMealSlotId: string;
  companyMealSlot: CompanyMealSlotInfo | null;
  lineupId: string;
  estimatedCount: number | null;
  finalCount: number | null;
  lineup: LineupInfo;
};

type MealPlanGroupRow = {
  id: string;
  planDate: string;
  status: string;
  note: string | null;
  mealPlans?: MealPlanRow[];
  mealCounts?: MealCountRow[];
  _count?: { mealPlans: number; mealCounts: number };
};

type TemplateOption = { id: string; name: string };

// Phase 5-R Step 7-A: 슬롯 에디터 옵션
type ContainerSlotOption = {
  id: string;
  slotIndex: number;
  label: string;
  volumeMl: number | null;
};
type ContainerOption = {
  id: string;
  name: string;
  code: string;
  slots: ContainerSlotOption[];
};
type RecipeOption = { id: string; name: string; code: string };
type AccessoryOption = {
  id: string;
  name: string;
  code: string;
  unit: string;
  subsidiaryType: "CONTAINER" | "ACCESSORY" | "CONSUMABLE";
};
type ProductionLineOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

// ══════════════════════════════════════════════════════════════

export default function MealPlansPage() {
  // ── 목록 상태 ──
  const [items, setItems] = useState<MealPlanGroupRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ── 상세 ──
  const [detailGroup, setDetailGroup] = useState<MealPlanGroupRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── 생성 다이얼로그 ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formPlanDate, setFormPlanDate] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // ── 복사 다이얼로그 ──
  const [copySource, setCopySource] = useState<MealPlanGroupRow | null>(null);
  const [copyDate, setCopyDate] = useState("");
  const [copyAccessories, setCopyAccessories] = useState(true);
  const [copyMealCounts, setCopyMealCounts] = useState(false);
  const [copySaving, setCopySaving] = useState(false);

  // ── 식단(MealPlan) 추가 다이얼로그 ──
  const [addMealGroupId, setAddMealGroupId] = useState<string | null>(null);
  const [addMealCompanyMealSlotId, setAddMealCompanyMealSlotId] =
    useState<string>("");
  const [slotOptions, setSlotOptions] = useState<CompanyMealSlotOption[]>([]);
  const [addMealLineupId, setAddMealLineupId] = useState(""); // 임시: ID 직접 입력
  const [addMealTemplateId, setAddMealTemplateId] = useState("");
  const [addMealNote, setAddMealNote] = useState("");
  const [mealSaving, setMealSaving] = useState(false);

  // ── 식수(MealCount) 편집 다이얼로그 — MealPlan에 1:1 매칭 ──
  const [editMealCountTarget, setEditMealCountTarget] = useState<{
    groupId: string;
    mealPlanId: string;
    companyMealSlotId: string;
    companyMealSlotLabel: string;
    lineupId: string;
    lineupLabel: string;
    existingMealCountId: string | null;
  } | null>(null);
  const [editMealCountEstimated, setEditMealCountEstimated] = useState<string>("");
  const [editMealCountFinal, setEditMealCountFinal] = useState<string>("");
  const [mealCountSaving, setMealCountSaving] = useState(false);

  // ── 템플릿 옵션 ──
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);

  // ── Phase 7-A3: 용기 그룹 일괄 배정 다이얼로그 ──
  const [containerOptions, setContainerOptions] = useState<ContainerOption[]>(
    [],
  );
  // Phase 7-F2/F3: (subsidiaryId:slotIndex) → 적격 레시피 캐시
  const [eligibleRecipesCache, setEligibleRecipesCache] = useState<
    Record<string, RecipeOption[]>
  >({});
  const [productionLineOptions, setProductionLineOptions] = useState<
    ProductionLineOption[]
  >([]);

  // Phase 7-C2: 부자재 옵션 (CONTAINER 제외 — ACCESSORY + CONSUMABLE)
  const [accessoryOptions, setAccessoryOptions] = useState<AccessoryOption[]>(
    [],
  );  

  // 일괄 배정 다이얼로그 대상 식단
  const [bulkSlotMealPlan, setBulkSlotMealPlan] = useState<{
    mealPlanId: string;
    title: string;
  } | null>(null);
  // 선택한 용기 그룹
  const [bulkSlotContainerId, setBulkSlotContainerId] = useState("");
  // 다이얼로그 상단의 기본 생산라인 ("" = 미지정)
  const [bulkSlotDefaultLineId, setBulkSlotDefaultLineId] = useState("");
  // 슬롯별 입력 (key = ContainerSlot.slotIndex)
  // - recipeId: "" 이면 미배정
  // - productionLineId: "" 이면 기본 라인 따름
  const [bulkSlotRows, setBulkSlotRows] = useState<
    Record<
      number,
      {
        recipeId: string;
        productionLineId: string;
        quantity: string;
        note: string;
      }
    >
  >({});
  const [bulkSlotSaving, setBulkSlotSaving] = useState(false);

  // ══════════════════════════════════════════════════════════════
  // Phase 7-B1: 슬롯 행 인라인 편집
  // ══════════════════════════════════════════════════════════════
  // editingSlotId !== null 이면 해당 행이 편집 모드
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  // 편집 중인 필드 (CONTAINER 기준; DIRECT는 quantity/line/note만 사용)
  const [editSlotForm, setEditSlotForm] = useState<{
    kind: "CONTAINER" | "DIRECT";
    recipeId: string; // CONTAINER 전용 ("" = 미배정)
    productionLineId: string; // "" = 미지정
    // ★ Phase 9-D-Sym: 슬롯 수량 대칭 편집
    //   - estimatedQuantity: 작성중→준비중→진행중 단계 입력
    //   - finalQuantity:     진행중→완료 단계 입력 (빈 문자열 = null)
    estimatedQuantity: string;
    finalQuantity: string;
    note: string;
  } | null>(null);
  const [slotUpdating, setSlotUpdating] = useState(false);

  // ══════════════════════════════════════════════════════════════
  // Phase 7-B2: 부자재 CRUD
  // ══════════════════════════════════════════════════════════════
  // 추가 다이얼로그 (mealPlanId가 null이 아니면 열림)
  const [accessoryAddTarget, setAccessoryAddTarget] = useState<{
    mealPlanId: string;
    mealPlanLabel: string;
  } | null>(null);
  // 수정 다이얼로그 (기존 부자재 행 정보)
  const [accessoryEditTarget, setAccessoryEditTarget] =
    useState<MealPlanAccessoryRow | null>(null);
  // 폼 상태 (add/edit 공용)
  const [accessoryFormSubsidiaryId, setAccessoryFormSubsidiaryId] =
    useState("");
  const [accessoryFormMode, setAccessoryFormMode] = useState<
    "PER_MEAL_COUNT" | "FIXED_QUANTITY"
  >("PER_MEAL_COUNT");
  const [accessoryFormFixedQuantity, setAccessoryFormFixedQuantity] =
    useState("");
  const [accessoryFormRequired, setAccessoryFormRequired] = useState(true);
  const [accessoryFormNote, setAccessoryFormNote] = useState("");
  const [accessorySaving, setAccessorySaving] = useState(false);

  // 템플릿 자동 적용 충돌 확인 다이얼로그 (Phase 7-A2: E1 + F1)
  const [templateApplyConfirm, setTemplateApplyConfirm] = useState<{
    mealPlanId: string;
    mealPlanLabel: string;
    mealTemplateId: string;
    mealTemplateName: string;
  } | null>(null);
  const [templateApplying, setTemplateApplying] = useState(false);

  // ── 삭제 확인 ──
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "group" | "meal" | "slot" | "mealCount" | "accessory"; 
    id: string;
    name: string;
  } | null>(null);

  // ── 상태 변경 ──
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    currentStatus: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState("");

  // ══════════════════════════════════════
  // 데이터 로딩
  // ══════════════════════════════════════

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const result = await getMealPlanGroupsAction({
          page,
          limit: 20,
          search: search.trim() || undefined, // service에서 note 검색으로 매핑
          status: statusFilter || undefined,
          sortBy: "planDate",
          sortOrder: "desc",
        });
        if (result.success) {
          setItems(result.data.items as unknown as MealPlanGroupRow[]);
          setPagination(result.data.pagination);
        } else {
          toast.error("식단 그룹 목록 조회에 실패했습니다");
          setItems([]);
        }
      } catch (err) {
        logger.error("[MealPlansPage.fetchData]", err);
        toast.error("목록 조회 중 오류가 발생했습니다");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter],
  );

  const loadTemplateOptions = useCallback(async () => {
    try {
      const { items } = await loadAllPages<TemplateOption>(
        getMealTemplatesAction as PaginatedFetcher<TemplateOption>,
        "name",
      );
      setTemplateOptions(items);
    } catch (err) {
      logger.error("[MealPlansPage.loadTemplateOptions]", err);
    }
  }, []);

  // Phase 5-R Step 3.2b-2-α: 회사별 활성 슬롯 옵션 로딩
  const loadSlotOptions = useCallback(async () => {
    try {
      const result = await getActiveCompanyMealSlotsAction();
      if (result.success) {
        setSlotOptions(result.data);
      } else {
        logger.error(
          "[MealPlansPage.loadSlotOptions]",
          result.error?.message ?? "unknown",
        );
      }
    } catch (err) {
      logger.error("[MealPlansPage.loadSlotOptions]", err);
    }
  }, []);

  // Phase 5-R Step 7-A: 슬롯 에디터용 옵션(용기/레시피/생산라인) 로딩
  const loadSlotEditorOptions = useCallback(async () => {
    try {
      const [containers, lines] = await Promise.all([
        loadAllPages<ContainerOption>(
          getContainerGroupsAction as PaginatedFetcher<ContainerOption>,
          "name",
        ),
        getActiveProductionLinesAction(),
      ]);
      if (containers.error) {
        logger.error("[MealPlansPage.loadSlotEditorOptions.containers]", containers.error);
      } else {
        setContainerOptions(containers.items);
      }
      if (lines.success) {
        setProductionLineOptions(lines.data);
      } else {
        logger.error(
          "[MealPlansPage.loadSlotEditorOptions.lines]",
          lines.error?.message ?? "unknown",
        );
      }           
    } catch (err) {
      logger.error("[MealPlansPage.loadSlotEditorOptions]", err);
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // Phase 7-F2/F3: 슬롯 컨텍스트별 적격 레시피 로더 (캐시 지원)
  // ──────────────────────────────────────────────────────────────
  // R1/R2/R3 조건을 만족하는 레시피만 서버에서 받아온다.
  // - cacheKey: "{subsidiaryId}:{slotIndex}"
  // - 동일 키 재호출 시 캐시 반환 (네트워크 절약)
  // - 결과를 setEligibleRecipesCache로 저장하여 SearchableSelect가 즉시 반영
  // ══════════════════════════════════════════════════════════════
  const loadEligibleRecipesForSlot = useCallback(
    async (
      subsidiaryMasterId: string,
      containerSlotIndex: number,
    ): Promise<RecipeOption[]> => {
      const cacheKey = `${subsidiaryMasterId}:${containerSlotIndex}`;
      // 이미 캐시 존재 시 즉시 반환
      const cached = eligibleRecipesCache[cacheKey];
      if (cached) return cached;

      try {
        const result = await getEligibleRecipesForContainerSlotAction(
          subsidiaryMasterId,
          containerSlotIndex,
        );
        if (!result.success) {
          logger.error(
            "[MealPlansPage.loadEligibleRecipesForSlot]",
            result.error?.message ?? "unknown",
          );
          setEligibleRecipesCache((prev) => ({ ...prev, [cacheKey]: [] }));
          return [];
        }
        const opts: RecipeOption[] = result.data.map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
        }));
        setEligibleRecipesCache((prev) => ({ ...prev, [cacheKey]: opts }));
        return opts;
      } catch (err) {
        logger.error("[MealPlansPage.loadEligibleRecipesForSlot]", err);
        setEligibleRecipesCache((prev) => ({ ...prev, [cacheKey]: [] }));
        return [];
      }
    },
    [eligibleRecipesCache],
  );

  // Phase 7-C2: 부자재 옵션 로드 (CONTAINER 제외 — ACCESSORY + CONSUMABLE)
  const loadAccessoryOptions = useCallback(async () => {
    try {
      // subsidiaryListQuerySchema.limit max=100 / paginated 응답
      // ACCESSORY + CONSUMABLE을 별도 조회 후 합침 (CONTAINER는 슬롯 배정 전용)
      const [accessoryRes, consumableRes] = await Promise.all([
        getMaterialSubsidiariesAction({
          page: 1,
          limit: 100,
          subsidiaryType: "ACCESSORY",
          sortBy: "name",
          sortOrder: "asc",
        }),
        getMaterialSubsidiariesAction({
          page: 1,
          limit: 100,
          subsidiaryType: "CONSUMABLE",
          sortBy: "name",
          sortOrder: "asc",
        }),
      ]);

      const merged: AccessoryOption[] = [];

      if (accessoryRes.success) {
        const items = accessoryRes.data.items as Array<{
          id: string;
          name: string;
          code: string;
          unit: string;
          subsidiaryType: "CONTAINER" | "ACCESSORY" | "CONSUMABLE";
        }>;
        merged.push(...items);
      } else {
        logger.error(
          "[MealPlansPage.loadAccessoryOptions.ACCESSORY]",
          accessoryRes.error?.message ?? "unknown",
        );
      }

      if (consumableRes.success) {
        const items = consumableRes.data.items as Array<{
          id: string;
          name: string;
          code: string;
          unit: string;
          subsidiaryType: "CONTAINER" | "ACCESSORY" | "CONSUMABLE";
        }>;
        merged.push(...items);
      } else {
        logger.error(
          "[MealPlansPage.loadAccessoryOptions.CONSUMABLE]",
          consumableRes.error?.message ?? "unknown",
        );
      }

      // name 가나다 정렬 (두 결과 합쳐서 재정렬)
      merged.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      setAccessoryOptions(merged);
    } catch (err) {
      logger.error("[MealPlansPage.loadAccessoryOptions]", err);
    }
  }, []);

  useEffect(() => {
    fetchData(1);
    loadTemplateOptions();
    loadSlotOptions();
    loadSlotEditorOptions();
    loadAccessoryOptions();
  }, [
    fetchData,
    loadTemplateOptions,
    loadSlotOptions,
    loadSlotEditorOptions,
    loadAccessoryOptions,
  ]);

  // ── 상세 ──
  const openDetail = async (groupId: string) => {
    setDetailLoading(true);
    try {
      const result = await getMealPlanGroupByIdAction(groupId);
      if (result.success && result.data) {
        setDetailGroup(result.data as unknown as MealPlanGroupRow);
      } else {
        toast.error("식단 그룹 조회에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.openDetail]", err);
      toast.error("상세 조회 중 오류가 발생했습니다");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailGroup) return;
    await openDetail(detailGroup.id);
  };

  // ══════════════════════════════════════
  // 그룹 CRUD
  // ══════════════════════════════════════

  const handleCreateGroup = async () => {
    if (!formPlanDate) return;
    setFormSaving(true);
    try {
      const result = await createMealPlanGroupAction({
        planDate: formPlanDate,
        note: formNote.trim() || undefined,
      });
      if (result.success) {
        toast.success("식단 그룹이 생성되었습니다");
        setShowCreateDialog(false);
        setFormPlanDate("");
        setFormNote("");
        fetchData(1);
      } else {
        toast.error(result.error?.message ?? "생성에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleCreateGroup]", err);
      toast.error("생성 중 오류가 발생했습니다");
    } finally {
      setFormSaving(false);
    }
  };

  const handleCopyGroup = async () => {
    if (!copySource || !copyDate) return;
    setCopySaving(true);
    try {
      const result = await copyMealPlanGroupAction({
        sourceMealPlanGroupId: copySource.id,
        targetPlanDate: copyDate,
        copyAccessories,
        copyMealCounts,
      });
      if (result.success) {
        toast.success("식단이 복사되었습니다");
        setCopySource(null);
        setCopyDate("");
        setCopyAccessories(true);
        setCopyMealCounts(false);
        fetchData(1);
      } else {
        toast.error(result.error?.message ?? "복사에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleCopyGroup]", err);
      toast.error("복사 중 오류가 발생했습니다");
    } finally {
      setCopySaving(false);
    }
  };
  
  // ══════════════════════════════════════════════════════════════
  // Phase 9-C-Fix-R1-5: 레시피 그룹 단위 슬롯 수량 검증
  // ──────────────────────────────────────────────────────────────
  // 서버 validateSlotQuantitiesForMealPlan 와 동일 정책 (recipeId 그룹화):
  //   - 그룹 내 모두 quantity=0      → OK_FALLBACK
  //   - 그룹 내 일부 0 + 일부 양수    → PARTIAL_INPUT
  //   - 동일 레시피 ≥ 2슬롯 + 0 포함  → MULTI_LINE_REQUIRES_QUANTITY
  //   - 전부 양수 + 합계 = mealCount → OK_DISTRIBUTED
  //   - 전부 양수 + 합계 ≠ mealCount → SUM_MISMATCH
  // ══════════════════════════════════════════════════════════════
  type RecipeGroupCheck =
    | { kind: "OK_FALLBACK"; recipeId: string | null; recipeName: string; mealCount: number; slotCount: number }
    | { kind: "OK_DISTRIBUTED"; recipeId: string | null; recipeName: string; mealCount: number; slotsSum: number; slotCount: number }
    | { kind: "PARTIAL_INPUT"; recipeId: string | null; recipeName: string; mealCount: number; zeroCount: number; slotCount: number }
    | { kind: "SUM_MISMATCH"; recipeId: string | null; recipeName: string; mealCount: number; slotsSum: number; slotCount: number }
    | { kind: "MULTI_LINE_REQUIRES_QUANTITY"; recipeId: string | null; recipeName: string; mealCount: number; slotCount: number };

  type MealPlanCheckResult =
    | { kind: "NO_SLOTS" }
    | { kind: "NO_MEAL_COUNT" }
    | { kind: "BY_RECIPE"; groups: RecipeGroupCheck[]; hasViolation: boolean };

  const checkMealPlanSlotQty = useCallback(
    (
      mp: MealPlanRow,
      mealCount: number | null,
      // ★ Phase 9-D-Sym: countSource에 따라 검증 대상 컬럼 분리
      //   - ESTIMATED (기본): 작성중→준비중→진행중 단계에서 estimatedQuantity 검증
      //   - FINAL:            진행중→완료 단계에서 finalQuantity 검증
      countSource: "ESTIMATED" | "FINAL" = "ESTIMATED",
    ): MealPlanCheckResult => {
      const containers = mp.slots.filter((s) => s.kind === "CONTAINER");
      if (containers.length === 0) return { kind: "NO_SLOTS" };
      if (mealCount == null) return { kind: "NO_MEAL_COUNT" };
  
      // countSource별 슬롯 수량 추출 (finalQuantity가 null이면 0으로 간주)
      const getQty = (s: MealPlanSlotRow): number =>
        countSource === "ESTIMATED"
          ? s.estimatedQuantity
          : (s.finalQuantity ?? 0);
  
      // recipeId별 그룹화 (미배정은 null 키)
      const groupMap = new Map<string | null, MealPlanSlotRow[]>();
      for (const s of containers) {
        const key = s.recipe?.id ?? null;
        const arr = groupMap.get(key) ?? [];
        arr.push(s);
        groupMap.set(key, arr);
      }
  
      const groups: RecipeGroupCheck[] = [];
      for (const [recipeId, slots] of groupMap.entries()) {
        const recipeName =
          slots[0].recipe?.name ?? (recipeId === null ? "(미배정)" : "—");
        const positive = slots.filter((s) => getQty(s) > 0);
        const zero = slots.filter((s) => getQty(s) === 0);
  
        // 동일 레시피가 2개 이상 슬롯에 걸쳐 있고 0이 섞이면 MULTI_LINE
        if (slots.length >= 2 && positive.length > 0 && zero.length > 0) {
          groups.push({
            kind: "MULTI_LINE_REQUIRES_QUANTITY",
            recipeId, recipeName, mealCount, slotCount: slots.length,
          });
          continue;
        }
        if (positive.length === 0) {
          groups.push({
            kind: "OK_FALLBACK",
            recipeId, recipeName, mealCount, slotCount: slots.length,
          });
          continue;
        }
        if (zero.length > 0) {
          groups.push({
            kind: "PARTIAL_INPUT",
            recipeId, recipeName, mealCount,
            zeroCount: zero.length, slotCount: slots.length,
          });
          continue;
        }
        const sum = positive.reduce((a, s) => a + getQty(s), 0);
        if (sum !== mealCount) {
          groups.push({
            kind: "SUM_MISMATCH",
            recipeId, recipeName, mealCount, slotsSum: sum, slotCount: slots.length,
          });
          continue;
        }
        groups.push({
          kind: "OK_DISTRIBUTED",
          recipeId, recipeName, mealCount, slotsSum: sum, slotCount: slots.length,
        });
      }
  
      const hasViolation = groups.some(
        (g) =>
          g.kind === "PARTIAL_INPUT" ||
          g.kind === "SUM_MISMATCH" ||
          g.kind === "MULTI_LINE_REQUIRES_QUANTITY",
      );
      return { kind: "BY_RECIPE", groups, hasViolation };
    },
    [],
  );

  // R1-5: 위반 그룹을 사람이 읽을 수 있는 문자열로 요약
  const describeRecipeGroupIssue = (g: RecipeGroupCheck): string => {
    if (g.kind === "PARTIAL_INPUT")
      return `[${g.recipeName}] ${g.zeroCount}/${g.slotCount} 슬롯 수량 미입력`;
    if (g.kind === "SUM_MISMATCH")
      return `[${g.recipeName}] 합계 ${g.slotsSum.toLocaleString()} ≠ 예상식수 ${g.mealCount.toLocaleString()}`;
    if (g.kind === "MULTI_LINE_REQUIRES_QUANTITY")
      return `[${g.recipeName}] 다중 라인 ${g.slotCount}개 — 모든 슬롯 수량 입력 필요`;
    return "";
  };

  /**
   * R1-5: 그룹 단위 위반 식단 수집 — 레시피 그룹별 위반을 평탄화.
   * 서버 K-2/R1-6 정책과 정합: estimatedCount 우선, 없으면 finalCount fallback.
   */
  const collectGroupSlotQtyIssues = useCallback(
    (
      group: MealPlanGroupRow,
    ): Array<{ mp: MealPlanRow; issue: RecipeGroupCheck | { kind: "NO_MEAL_COUNT" } }> => {
      if (!group.mealPlans) return [];
      const issues: Array<{ mp: MealPlanRow; issue: RecipeGroupCheck | { kind: "NO_MEAL_COUNT" } }> = [];
      for (const mp of group.mealPlans) {
        const mc = group.mealCounts?.find(
          (c) =>
            c.companyMealSlotId === mp.companyMealSlotId &&
            c.lineupId === mp.lineupId,
        );
        const mealCount = mc?.estimatedCount ?? mc?.finalCount ?? null;
        const check = checkMealPlanSlotQty(mp, mealCount);

        if (
          check.kind === "NO_MEAL_COUNT" &&
          mp.slots.some((s) => s.kind === "CONTAINER")
        ) {
          issues.push({ mp, issue: { kind: "NO_MEAL_COUNT" } });
        } else if (check.kind === "BY_RECIPE") {
          for (const g of check.groups) {
            if (
              g.kind === "PARTIAL_INPUT" ||
              g.kind === "SUM_MISMATCH" ||
              g.kind === "MULTI_LINE_REQUIRES_QUANTITY"
            ) {
              issues.push({ mp, issue: g });
            }
          }
        }
      }
      return issues;
    },
    [checkMealPlanSlotQty],
  );

  const handleStatusChange = async () => {
    if (!statusChangeTarget || !newStatus) return;

    // ── R1-5 (1): 허용 전환 검사 ──
    const allowed = ALLOWED_FORWARD_TRANSITIONS[statusChangeTarget.currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      toast.error(
        `${STATUS_LABEL[statusChangeTarget.currentStatus]} → ${STATUS_LABEL[newStatus]} 전환은 허용되지 않습니다`,
      );
      return;
    }

    // ── R1-5 (2): 서버 R1-6 정책과 정합한 사전 검증 ──
    if (detailGroup?.id === statusChangeTarget.id) {
      // CONFIRMED → IN_PROGRESS: 슬롯 수량 + 예상식수 전체
      if (
        statusChangeTarget.currentStatus === "CONFIRMED" &&
        newStatus === "IN_PROGRESS"
      ) {
        const issues = collectGroupSlotQtyIssues(detailGroup);
        if (issues.length > 0) {
          const first = issues[0];
          const label = `${first.mp.companyMealSlot?.displayName ?? "-"} · ${first.mp.lineup?.name ?? "—"}`;
          const detail =
            first.issue.kind === "NO_MEAL_COUNT"
              ? "예상식수 미입력"
              : describeRecipeGroupIssue(first.issue);
          const more = issues.length > 1 ? ` 외 ${issues.length - 1}건` : "";
          toast.error(`진행중 전환 불가: ${label} — ${detail}${more}`);
          return;
        }
        // 예상식수 전체 입력 확인
        const missing = (detailGroup.mealPlans ?? []).filter((mp) => {
          const mc = detailGroup.mealCounts?.find(
            (c) =>
              c.companyMealSlotId === mp.companyMealSlotId &&
              c.lineupId === mp.lineupId,
          );
          return mc?.estimatedCount == null;
        });
        if (missing.length > 0) {
          toast.error(`예상식수 미입력 식단 ${missing.length}건 — 모두 입력 후 진행하세요`);
          return;
        }
      }
      // IN_PROGRESS → COMPLETED: 확정식수 전체
      if (
        statusChangeTarget.currentStatus === "IN_PROGRESS" &&
        newStatus === "COMPLETED"
      ) {
        const missing = (detailGroup.mealPlans ?? []).filter((mp) => {
          const mc = detailGroup.mealCounts?.find(
            (c) =>
              c.companyMealSlotId === mp.companyMealSlotId &&
              c.lineupId === mp.lineupId,
          );
          return mc?.finalCount == null;
        });
        if (missing.length > 0) {
          toast.error(`확정식수 미입력 식단 ${missing.length}건 — 모두 입력 후 완료하세요`);
          return;
        }
      }
    }

    try {
      const result = await updateMealPlanGroupAction(statusChangeTarget.id, {
        status: newStatus,
      });
      if (result.success) {
        toast.success("상태가 변경되었습니다");
        setStatusChangeTarget(null);
        setNewStatus("");
        fetchData(pagination.page);
        if (detailGroup?.id === statusChangeTarget.id) refreshDetail();
      } else {
        toast.error(result.error?.message ?? "상태 변경에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleStatusChange]", err);
      toast.error("상태 변경 중 오류가 발생했습니다");
    }
  };

  // ── 식단(MealPlan) 추가 (Phase 7-A2 E1: 템플릿 선택 시 자동 applyMealTemplate) ──
  const handleAddMeal = async () => {
    if (!addMealGroupId || !addMealCompanyMealSlotId || !addMealLineupId.trim())
      return;
    setMealSaving(true);
    try {
      const result = await createMealPlanAction(addMealGroupId, {
        companyMealSlotId: addMealCompanyMealSlotId,
        lineupId: addMealLineupId.trim(),
        mealTemplateId: addMealTemplateId || undefined,
        note: addMealNote.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? "식단 추가에 실패했습니다");
        return;
      }

      const slotLabel =
        slotOptions.find((o) => o.id === addMealCompanyMealSlotId)
          ?.displayName ?? "식단";
      toast.success(`${slotLabel} 식단이 추가되었습니다`);

      // 템플릿이 지정된 경우, 새로 만든 식단에 즉시 적용 (replaceExisting=true는
      // 신규 식단이라 슬롯이 없으므로 의미상 안전)
      const newPlan = result.data as { id?: string } | undefined;
      if (addMealTemplateId && newPlan?.id) {
        const applyRes = await applyMealTemplateAction(newPlan.id, {
          mealTemplateId: addMealTemplateId,
          replaceExisting: true,
        });
        if (applyRes.success) {
          toast.success("템플릿 구성이 적용되었습니다");
        } else {
          toast.error(
            applyRes.error?.message ??
              "템플릿 적용에 실패했습니다 (식단은 생성됨)",
          );
        }
      }

      setAddMealGroupId(null);
      setAddMealCompanyMealSlotId("");
      setAddMealLineupId("");
      setAddMealTemplateId("");
      setAddMealNote("");
      await refreshDetail();
    } catch (err) {
      logger.error("[MealPlansPage.handleAddMeal]", err);
      toast.error("식단 추가 중 오류가 발생했습니다");
    } finally {
      setMealSaving(false);
    }
  };

  // ── 식수(MealCount) 편집 열기 ──
  const openMealCountEditor = (mp: MealPlanRow) => {
    if (!detailGroup) return;
    const existing = detailGroup.mealCounts?.find(
      (c) =>
        c.companyMealSlotId === mp.companyMealSlotId &&
        c.lineupId === mp.lineupId,
    );
    setEditMealCountTarget({
      groupId: detailGroup.id,
      mealPlanId: mp.id,
      companyMealSlotId: mp.companyMealSlotId,
      companyMealSlotLabel: mp.companyMealSlot?.displayName ?? "-",
      lineupId: mp.lineupId,
      lineupLabel: `${mp.lineup?.name ?? "—"}${mp.lineup?.code ? ` (${mp.lineup.code})` : ""}`,
      existingMealCountId: existing?.id ?? null,
    });
    setEditMealCountEstimated(
      existing?.estimatedCount != null ? String(existing.estimatedCount) : "",
    );
    setEditMealCountFinal(
      existing?.finalCount != null ? String(existing.finalCount) : "",
    );
  };

  const closeMealCountEditor = () => {
    setEditMealCountTarget(null);
    setEditMealCountEstimated("");
    setEditMealCountFinal("");
  };

  // ── 식수(MealCount) 저장 — 식단에 1:1로 upsert ──
  const handleSaveMealCount = async () => {
    if (!editMealCountTarget) return;

    const estimated = Number(editMealCountEstimated);
    if (
      editMealCountEstimated === "" ||
      Number.isNaN(estimated) ||
      estimated < 0
    ) {
      toast.error("예상 식수는 0 이상의 숫자여야 합니다");
      return;
    }
    const finalRaw = editMealCountFinal.trim();
    const finalCount = finalRaw === "" ? null : Number(finalRaw);
    if (finalCount !== null && (Number.isNaN(finalCount) || finalCount < 0)) {
      toast.error("확정 식수는 0 이상의 숫자여야 합니다");
      return;
    }

    setMealCountSaving(true);
    try {
      const result = await upsertMealCountAction(editMealCountTarget.groupId, {
        companyMealSlotId: editMealCountTarget.companyMealSlotId,
        lineupId: editMealCountTarget.lineupId,
        estimatedCount: estimated,
        finalCount,
      });
      if (result.success) {
        toast.success("식수가 저장되었습니다");
        closeMealCountEditor();
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "식수 저장에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleSaveMealCount]", err);
      toast.error("식수 저장 중 오류가 발생했습니다");
    } finally {
      setMealCountSaving(false);
    }
  };

  // ══════════════════════════════════════
  // Phase 7-A3: 용기 그룹 일괄 배정
  // ══════════════════════════════════════

  const openBulkSlotEditor = (mp: MealPlanRow) => {
    const title = `${mp.companyMealSlot?.displayName ?? "-"} · ${mp.lineup?.name ?? "—"}`;
    setBulkSlotMealPlan({ mealPlanId: mp.id, title });
    setBulkSlotContainerId("");
    setBulkSlotDefaultLineId("");
    setBulkSlotRows({});
  };

  const closeBulkSlotEditor = () => {
    setBulkSlotMealPlan(null);
    setBulkSlotContainerId("");
    setBulkSlotDefaultLineId("");
    setBulkSlotRows({});
  };

  const selectedBulkContainer = containerOptions.find(
    (c) => c.id === bulkSlotContainerId,
  );

  // ★ Phase 9-C-Fix-H2: 일괄 슬롯 다이얼로그의 placeholder 용 예상식수
  const bulkSlotMealCount = (() => {
    if (!bulkSlotMealPlan || !detailGroup) return null;
    const mp = detailGroup.mealPlans?.find(
      (m) => m.id === bulkSlotMealPlan.mealPlanId,
    );
    if (!mp) return null;
    const mc = detailGroup.mealCounts?.find(
      (c) =>
        c.companyMealSlotId === mp.companyMealSlotId &&
        c.lineupId === mp.lineupId,
    );
    return mc?.estimatedCount ?? mc?.finalCount ?? null;
  })();

  // 용기 그룹 변경 시 슬롯 행 초기화 (각 슬롯에 빈 입력값 채움)
  const handleBulkContainerChange = (containerId: string) => {
    setBulkSlotContainerId(containerId);
    const c = containerOptions.find((co) => co.id === containerId);
    if (!c) {
      setBulkSlotRows({});
      return;
    }
    const initial: Record<
      number,
      { recipeId: string; productionLineId: string; quantity: string; note: string }
    > = {};
    for (const s of c.slots) {
      initial[s.slotIndex] = {
        recipeId: "",
        productionLineId: "",
        quantity: "0",
        note: "",
      };
    }
    setBulkSlotRows(initial);

    // Phase 7-F3: 용기의 각 슬롯에 대해 적격 레시피 사전 로드 (병렬)
    void Promise.all(
      c.slots.map((s) =>
        loadEligibleRecipesForSlot(containerId, s.slotIndex),
      ),
    );
  };

  const updateBulkRow = (
    slotIndex: number,
    patch: Partial<{
      recipeId: string;
      productionLineId: string;
      quantity: string;
      note: string;
    }>,
  ) => {
    setBulkSlotRows((prev) => ({
      ...prev,
      [slotIndex]: {
        ...(prev[slotIndex] ?? {
          recipeId: "",
          productionLineId: "",
          quantity: "0",
          note: "",
        }),
        ...patch,
      },
    }));
  };

  const handleBulkSubmit = async () => {
    if (!bulkSlotMealPlan) return;
    if (!bulkSlotContainerId) {
      toast.error("용기 그룹을 선택하세요");
      return;
    }
    if (!selectedBulkContainer || selectedBulkContainer.slots.length === 0) {
      toast.error("용기 그룹에 등록된 슬롯이 없습니다");
      return;
    }

    // 수량 형식 검증 (음수/문자열 거르기)
    for (const s of selectedBulkContainer.slots) {
      const row = bulkSlotRows[s.slotIndex];
      const q = Number(row?.quantity ?? "0");
      if (Number.isNaN(q) || q < 0) {
        toast.error(`슬롯 #${s.slotIndex + 1}의 수량이 올바르지 않습니다`);
        return;
      }
    }

    const items = selectedBulkContainer.slots.map((s) => {
      const row = bulkSlotRows[s.slotIndex] ?? {
        recipeId: "",
        productionLineId: "",
        quantity: "0",
        note: "",
      };
      return {
        containerSlotIndex: s.slotIndex,
        recipeId: row.recipeId || null,
        productionLineId: row.productionLineId || null,
        quantity: Number(row.quantity || "0"),
        note: row.note.trim() || null,
      };
    });

    setBulkSlotSaving(true);
    try {
      const result = await bulkCreateContainerSlotsAction(
        bulkSlotMealPlan.mealPlanId,
        {
          subsidiaryMasterId: bulkSlotContainerId,
          defaultProductionLineId: bulkSlotDefaultLineId || null,
          items,
        },
      );
      if (result.success) {
        const unassigned = items.filter((it) => !it.recipeId).length;
        toast.success(
          unassigned > 0
            ? `용기 그룹이 배정되었습니다 (미배정 슬롯 ${unassigned}개)`
            : "용기 그룹이 배정되었습니다",
        );
        closeBulkSlotEditor();
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "용기 그룹 배정에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleBulkSubmit]", err);
      toast.error("용기 그룹 배정 중 오류가 발생했습니다");
    } finally {
      setBulkSlotSaving(false);
    }
  };

  // ══════════════════════════════════════
  // Phase 7-A2: 템플릿 재적용 (F1 — 슬롯 있으면 덮어쓰기 확인)
  // ══════════════════════════════════════

  const openTemplateApplyConfirm = (mp: MealPlanRow) => {
    if (!mp.mealTemplate || !mp.mealTemplateId) {
      toast.error("이 식단에는 지정된 템플릿이 없습니다");
      return;
    }
    setTemplateApplyConfirm({
      mealPlanId: mp.id,
      mealPlanLabel: `${mp.companyMealSlot?.displayName ?? "-"} · ${mp.lineup?.name ?? "—"}`,
      mealTemplateId: mp.mealTemplateId,
      mealTemplateName: mp.mealTemplate.name,
    });
  };

  const handleApplyTemplate = async () => {
    if (!templateApplyConfirm) return;
    setTemplateApplying(true);
    try {
      const result = await applyMealTemplateAction(
        templateApplyConfirm.mealPlanId,
        {
          mealTemplateId: templateApplyConfirm.mealTemplateId,
          replaceExisting: true,
        },
      );
      if (result.success) {
        toast.success("템플릿 구성이 다시 적용되었습니다");
        setTemplateApplyConfirm(null);
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "템플릿 적용에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleApplyTemplate]", err);
      toast.error("템플릿 적용 중 오류가 발생했습니다");
    } finally {
      setTemplateApplying(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // Phase 7-B1: 슬롯 행 인라인 편집
  // ══════════════════════════════════════════════════════════════

  const openSlotEdit = (slot: MealPlanSlotRow) => {
    setEditingSlotId(slot.id);
    setEditSlotForm({
      kind: slot.kind,
      recipeId: slot.recipe?.id ?? "",
      productionLineId: slot.productionLine?.id ?? "",
      // ★ Phase 9-D-Sym
      estimatedQuantity: String(slot.estimatedQuantity ?? 0),
      finalQuantity: slot.finalQuantity != null ? String(slot.finalQuantity) : "",
      note: slot.note ?? "",
    });
    // Phase 7-F2: CONTAINER 슬롯이면 (subsidiary, slotIndex) 적격 레시피 사전 로드
    if (
      slot.kind === "CONTAINER" &&
      slot.subsidiaryMaster?.id &&
      slot.containerSlotIndex !== null
    ) {
      void loadEligibleRecipesForSlot(
        slot.subsidiaryMaster.id,
        slot.containerSlotIndex,
      );
    }
  };

  const closeSlotEdit = () => {
    setEditingSlotId(null);
    setEditSlotForm(null);
  };

  const handleSaveSlot = async () => {
    if (!editingSlotId || !editSlotForm) return;
  
    // ★ Phase 9-D-Sym: estimatedQuantity 검증 (필수, 정수, 0 이상)
    const est = Number(editSlotForm.estimatedQuantity);
    if (
      editSlotForm.estimatedQuantity === "" ||
      Number.isNaN(est) ||
      est < 0 ||
      !Number.isInteger(est)
    ) {
      toast.error("예상수량은 0 이상의 정수여야 합니다");
      return;
    }
  
    // ★ Phase 9-D-Sym: finalQuantity 검증 (선택, 빈 문자열이면 null로 전달)
    const finalRaw = editSlotForm.finalQuantity.trim();
    let finalQty: number | null = null;
    if (finalRaw !== "") {
      const f = Number(finalRaw);
      if (Number.isNaN(f) || f < 0 || !Number.isInteger(f)) {
        toast.error("확정수량은 0 이상의 정수여야 합니다");
        return;
      }
      finalQty = f;
    }
  
    // kind 별 payload 구성 (Zod discriminatedUnion 충족)
    const payload =
      editSlotForm.kind === "CONTAINER"
        ? {
            kind: "CONTAINER" as const,
            recipeId: editSlotForm.recipeId || null,
            productionLineId: editSlotForm.productionLineId || null,
            estimatedQuantity: est,
            finalQuantity: finalQty,
            note: editSlotForm.note.trim() || null,
          }
        : {
            kind: "DIRECT" as const,
            productionLineId: editSlotForm.productionLineId || null,
            estimatedQuantity: est,
            finalQuantity: finalQty,
            note: editSlotForm.note.trim() || null,
          };  

    setSlotUpdating(true);
    try {
      const result = await updateMealPlanSlotAction(editingSlotId, payload);
      if (result.success) {
        toast.success("슬롯이 수정되었습니다");
        closeSlotEdit();
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "슬롯 수정에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleSaveSlot]", err);
      toast.error("슬롯 수정 중 오류가 발생했습니다");
    } finally {
      setSlotUpdating(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // Phase 7-B2: 부자재 CRUD
  // ══════════════════════════════════════════════════════════════

  // 폼 초기화 헬퍼
  const resetAccessoryForm = () => {
    setAccessoryFormSubsidiaryId("");
    setAccessoryFormMode("PER_MEAL_COUNT");
    setAccessoryFormFixedQuantity("");
    setAccessoryFormRequired(true);
    setAccessoryFormNote("");
  };

  const openAccessoryAdd = (mp: MealPlanRow) => {
    setAccessoryAddTarget({
      mealPlanId: mp.id,
      mealPlanLabel: `${mp.companyMealSlot?.displayName ?? "-"} · ${mp.lineup?.name ?? "—"}`,
    });
    resetAccessoryForm();
  };

  const openAccessoryEdit = (acc: MealPlanAccessoryRow) => {
    setAccessoryEditTarget(acc);
    setAccessoryFormSubsidiaryId(acc.subsidiaryMasterId);
    setAccessoryFormMode(acc.consumptionMode);
    setAccessoryFormFixedQuantity(
      acc.fixedQuantity != null ? String(acc.fixedQuantity) : "",
    );
    setAccessoryFormRequired(acc.required);
    setAccessoryFormNote(acc.note ?? "");
  };

  const closeAccessoryDialog = () => {
    setAccessoryAddTarget(null);
    setAccessoryEditTarget(null);
    resetAccessoryForm();
  };

  // 폼 검증 공통 로직 → payload 반환 (검증 실패 시 null)
  const buildAccessoryPayload = (): {
    subsidiaryMasterId: string;
    consumptionMode: "PER_MEAL_COUNT" | "FIXED_QUANTITY";
    fixedQuantity: number | null;
    required: boolean;
    note: string | null;
  } | null => {
    if (!accessoryFormSubsidiaryId) {
      toast.error("부자재를 선택하세요");
      return null;
    }
    let fixedQuantity: number | null = null;
    if (accessoryFormMode === "FIXED_QUANTITY") {
      const v = Number(accessoryFormFixedQuantity);
      if (
        accessoryFormFixedQuantity === "" ||
        Number.isNaN(v) ||
        v < 0 ||
        !Number.isInteger(v)
      ) {
        toast.error("고정수량은 0 이상의 정수여야 합니다");
        return null;
      }
      fixedQuantity = v;
    }
    return {
      subsidiaryMasterId: accessoryFormSubsidiaryId,
      consumptionMode: accessoryFormMode,
      fixedQuantity,
      required: accessoryFormRequired,
      note: accessoryFormNote.trim() || null,
    };
  };

  const handleSaveAccessory = async () => {
    const payload = buildAccessoryPayload();
    if (!payload) return;

    setAccessorySaving(true);
    try {
      if (accessoryEditTarget) {
        // 수정
        const result = await updateMealPlanAccessoryAction(
          accessoryEditTarget.id,
          payload,
        );
        if (result.success) {
          toast.success("부자재가 수정되었습니다");
          closeAccessoryDialog();
          await refreshDetail();
        } else {
          toast.error(result.error?.message ?? "부자재 수정에 실패했습니다");
        }
      } else if (accessoryAddTarget) {
        // 추가
        const result = await createMealPlanAccessoryAction(
          accessoryAddTarget.mealPlanId,
          payload,
        );
        if (result.success) {
          toast.success("부자재가 추가되었습니다");
          closeAccessoryDialog();
          await refreshDetail();
        } else {
          toast.error(result.error?.message ?? "부자재 추가에 실패했습니다");
        }
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleSaveAccessory]", err);
      toast.error("부자재 저장 중 오류가 발생했습니다");
    } finally {
      setAccessorySaving(false);
    }
  };

  // ── 삭제 ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      let result;
      if (type === "group") {
        result = await deleteMealPlanGroupAction(id);
        if (result.success) {
          toast.success("식단 그룹이 삭제되었습니다");
          if (detailGroup?.id === id) setDetailGroup(null);
          fetchData(pagination.page);
        }
      } else if (type === "meal") {
        result = await deleteMealPlanAction(id);
        if (result.success) {
          toast.success("식단이 삭제되었습니다");
          await refreshDetail();
        }
      } else if (type === "slot") {
        result = await deleteMealPlanSlotAction(id);
        if (result.success) {
          toast.success("슬롯이 삭제되었습니다");
          await refreshDetail();
        }
      } else if (type === "mealCount") {
        result = await deleteMealCountAction(id);
        if (result.success) {
          toast.success("식수가 삭제되었습니다");
          await refreshDetail();
        }
      } else if (type === "accessory") {
        result = await deleteMealPlanAccessoryAction(id);
        if (result.success) {
          toast.success("부자재가 삭제되었습니다");
          await refreshDetail();
        }
      }
      if (result && !result.success) {
        toast.error(result.error?.message ?? "삭제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleConfirmDelete]", err);
      toast.error("삭제 중 오류가 발생했습니다");
    }
    setDeleteTarget(null);
  };

  // ══════════════════════════════════════
  // 상세 뷰
  // ══════════════════════════════════════

  if (detailGroup) {
    const groupDateLabel = new Date(detailGroup.planDate).toLocaleDateString(
      "ko-KR",
      { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" },
    );

    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailGroup(null)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> 목록으로
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{groupDateLabel}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLOR[detailGroup.status] ?? ""
                }`}
              >
                {STATUS_LABEL[detailGroup.status] ?? detailGroup.status}
              </span>
              {/* R1-5 후속: 허용된 다음 상태로 직접 전환하는 버튼 그룹 */}
              {(ALLOWED_FORWARD_TRANSITIONS[detailGroup.status] ?? []).map(
                (target) => {
                  // 정/역방향 구분 (STATUS_ORDER 기준)
                  const currentIdx = STATUS_ORDER.indexOf(detailGroup.status);
                  const targetIdx = STATUS_ORDER.indexOf(target);
                  const isCancel = target === "CANCELLED";
                  const isRevert =
                    !isCancel && targetIdx >= 0 && currentIdx >= 0 && targetIdx < currentIdx;
                  const isRestore =
                    detailGroup.status === "CANCELLED" && target === "DRAFT";

                  // 버튼 스타일: 정방향=primary, 역방향=outline+회색, 취소=outline+빨강
                  const cls = isCancel
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : isRevert || isRestore
                      ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                      : "border-blue-300 text-blue-700 hover:bg-blue-50";

                  const prefix = isCancel
                    ? "→"
                    : isRevert || isRestore
                      ? "↶"
                      : "→";

                  return (
                    <Button
                      key={target}
                      variant="outline"
                      size="sm"
                      className={cls}
                      onClick={() => {
                        setStatusChangeTarget({
                          id: detailGroup.id,
                          currentStatus: detailGroup.status,
                        });
                        setNewStatus(target);
                      }}
                    >
                      {prefix} {STATUS_LABEL[target]}
                    </Button>
                  );
                },
              )}
              {detailGroup.note && (
                <span className="text-sm text-gray-500">
                  · {detailGroup.note}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddMealGroupId(detailGroup.id)}
          >
            <Plus className="mr-1 h-4 w-4" /> 식단 추가
          </Button>
        </div>

        {/* 식단/식수 통합 현황 */}
        <section className="rounded-lg border bg-gray-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">식단/식수 현황</h2>
            <span className="text-xs text-gray-400">
              ※ 식수는 등록된 식단별로 입력합니다 (1:1)
            </span>
          </div>
          {!detailGroup.mealPlans || detailGroup.mealPlans.length === 0 ? (
            <p className="text-sm text-gray-500">
              아직 등록된 식단이 없습니다. 우측 상단의{" "}
              <span className="font-semibold">&ldquo;식단 추가&rdquo;</span>{" "}
              버튼으로 먼저 식단을 등록하세요.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">식사</TableHead>
                  <TableHead>라인업</TableHead>
                  <TableHead className="w-[100px] text-right">예상</TableHead>
                  <TableHead className="w-[100px] text-right">확정</TableHead>
                  <TableHead className="w-[100px] text-center">상태</TableHead>
                  <TableHead className="w-[100px] text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailGroup.mealPlans.map((mp) => {
                  const mc = detailGroup.mealCounts?.find(
                    (c) =>
                      c.companyMealSlotId === mp.companyMealSlotId &&
                      c.lineupId === mp.lineupId,
                  );
                  const hasEstimated = mc?.estimatedCount != null;
                  const hasFinal = mc?.finalCount != null;
                  let statusBadge: { label: string; cls: string };
                  if (!mc) {
                    statusBadge = {
                      label: "미입력",
                      cls: "bg-gray-100 text-gray-500",
                    };
                  } else if (hasFinal) {
                    statusBadge = {
                      label: "확정",
                      cls: "bg-emerald-100 text-emerald-700",
                    };
                  } else if (hasEstimated) {
                    statusBadge = {
                      label: "예상만",
                      cls: "bg-amber-100 text-amber-700",
                    };
                  } else {
                    statusBadge = {
                      label: "—",
                      cls: "bg-gray-100 text-gray-500",
                    };
                  }
                  return (
                    <TableRow key={mp.id}>
                      <TableCell>
                        {mp.companyMealSlot?.displayName ?? "-"}
                      </TableCell>
                      <TableCell>
                        {mp.lineup?.name ?? "—"}{" "}
                        {mp.lineup?.code && (
                          <span className="text-xs text-gray-400">
                            ({mp.lineup.code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {mc?.estimatedCount ?? (
                          <span className="text-gray-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {mc?.finalCount ?? (
                          <span className="text-gray-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openMealCountEditor(mp)}
                          >
                            {mc ? "수정" : "입력"}
                          </Button>
                          {mc && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "mealCount",
                                  id: mc.id,
                                  name: `${mp.companyMealSlot?.displayName ?? "-"} · ${mp.lineup?.name ?? ""} 식수`,
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        {/* 식단 목록 */}
        {detailLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 불러오는 중...
          </div>
        ) : (
          <div className="space-y-4">
            {!detailGroup.mealPlans || detailGroup.mealPlans.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                등록된 식단이 없습니다. &ldquo;식단 추가&rdquo; 버튼으로 라인업
                × 식사타입 조합 식단을 추가하세요.
              </div>
            ) : (
              detailGroup.mealPlans.map((mp) => (
                <div key={mp.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {mp.companyMealSlot?.displayName ?? "-"}{" "}
                        <span className="text-base font-normal text-gray-600">
                          · {mp.lineup?.name ?? "—"}
                          {mp.lineup?.code && (
                            <span className="ml-1 text-sm text-gray-400">
                              ({mp.lineup.code})
                            </span>
                          )}
                        </span>
                      </h3>
                      {mp.mealTemplate && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          템플릿: {mp.mealTemplate.name}
                        </p>
                      )}
                      {mp.note && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          비고: {mp.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openBulkSlotEditor(mp)}
                      >
                        <PlusCircle className="mr-1 h-3.5 w-3.5" />
                        용기 그룹 배정
                      </Button>
                      {mp.mealTemplateId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openTemplateApplyConfirm(mp)}
                          title="템플릿 구성을 다시 적용 (기존 슬롯/부자재 덮어쓰기)"
                        >
                          템플릿 재적용
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setDeleteTarget({
                            type: "meal",
                            id: mp.id,
                            name: `${mp.companyMealSlot?.displayName ?? "-"} · ${mp.lineup?.name ?? ""}`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* 슬롯 테이블 */}
                  {(() => {
                    // ── Phase 9-C-Fix-H2: 이 MealPlan의 예상식수 조회 ──
                    const _mcRow = detailGroup.mealCounts?.find(
                      (c) =>
                        c.companyMealSlotId === mp.companyMealSlotId &&
                        c.lineupId === mp.lineupId,
                    );
                    const _mealCountForMp =
                      _mcRow?.estimatedCount ?? _mcRow?.finalCount ?? null;

                    // ── Phase 9-C-Fix-K3: 슬롯 수량 실시간 검증 배지 ──
                    const _check = checkMealPlanSlotQty(mp, _mealCountForMp);

                    return (
                      <>
                        {/* R1-5: 레시피 그룹별 배지 — 검증 결과별 색상 분기 */}
                        {_check.kind === "NO_MEAL_COUNT" && (
                          <div className="mt-2 inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            예상식수 미입력 — 상태 진행 전 입력 필요
                          </div>
                        )}
                        {_check.kind === "BY_RECIPE" && _check.groups.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {_check.groups.map((g, idx) => {
                              const base =
                                "inline-flex items-center rounded border px-2 py-0.5 text-xs";
                              // ★ R1-5b: OK 배지는 "같은 recipeId가 2개 이상 슬롯으로 분리된 경우"에만 표시.
                              //    단일 슬롯 그룹은 분배 이슈가 없어 시각 노이즈만 됨.
                              //    위반(PARTIAL_INPUT/SUM_MISMATCH/MULTI_LINE_REQUIRES_QUANTITY)은 항상 표시.
                              const isOk =
                                g.kind === "OK_FALLBACK" || g.kind === "OK_DISTRIBUTED";
                              if (isOk && g.slotCount < 2) return null;

                              if (g.kind === "OK_FALLBACK")
                                return (
                                  <span
                                    key={idx}
                                    className={`${base} border-blue-300 bg-blue-50 text-blue-700`}
                                  >
                                    [{g.recipeName}] 예상식수 {g.mealCount.toLocaleString()}식 전량 적용 ({g.slotCount}슬롯)
                                  </span>
                                );
                              if (g.kind === "OK_DISTRIBUTED")
                                return (
                                  <span
                                    key={idx}
                                    className={`${base} border-emerald-300 bg-emerald-50 text-emerald-700`}
                                  >
                                    [{g.recipeName}] 슬롯 분배 합계 일치 ({g.slotsSum.toLocaleString()}식 · {g.slotCount}슬롯)
                                  </span>
                                );
                              if (g.kind === "PARTIAL_INPUT")
                                return (
                                  <span
                                    key={idx}
                                    className={`${base} border-orange-300 bg-orange-50 text-orange-700`}
                                  >
                                    [{g.recipeName}] {g.zeroCount}/{g.slotCount}개 슬롯 수량 미입력
                                  </span>
                                );
                              if (g.kind === "SUM_MISMATCH")
                                return (
                                  <span
                                    key={idx}
                                    className={`${base} border-rose-300 bg-rose-50 text-rose-700`}
                                  >
                                    [{g.recipeName}] 합계 {g.slotsSum.toLocaleString()} ≠ 예상식수 {g.mealCount.toLocaleString()}
                                  </span>
                                );
                              if (g.kind === "MULTI_LINE_REQUIRES_QUANTITY")
                                return (
                                  <span
                                    key={idx}
                                    className={`${base} border-red-300 bg-red-50 text-red-700`}
                                  >
                                    [{g.recipeName}] 다중 라인 — 모든 슬롯 수량 입력 필요 ({g.slotCount}개)
                                  </span>
                                );
                              return null;
                            })}
                          </div>
                        )}
                        {mp.slots.length === 0 ? (
                          <p className="mt-3 text-sm text-gray-400">
                            배정된 슬롯이 없습니다.
                          </p>
                        ) : (
                    <Table className="mt-3">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">순서</TableHead>
                          <TableHead className="w-[100px]">종류</TableHead>
                          <TableHead>내용</TableHead>
                          <TableHead className="w-[120px]">생산라인</TableHead>
                          <TableHead className="w-[90px] text-right">
                            예상/확정
                          </TableHead>
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // ══════════════════════════════════════
                          // Phase 7-C1: 슬롯을 용기 그룹별로 묶어서 렌더링
                          // ══════════════════════════════════════
                          type SlotGroup = {
                            key: string;
                            kind: "CONTAINER" | "DIRECT";
                            // CONTAINER 그룹용
                            subsidiaryName: string | null;
                            subsidiaryCode: string | null;
                            // 모든 그룹 공용
                            slots: MealPlanSlotRow[];
                            firstSortOrder: number;
                          };

                          const groupMap = new Map<string, SlotGroup>();

                          for (const slot of mp.slots) {
                            let key: string;
                            let kind: "CONTAINER" | "DIRECT";
                            let subsidiaryName: string | null = null;
                            let subsidiaryCode: string | null = null;

                            if (slot.kind === "DIRECT") {
                              key = "__direct__";
                              kind = "DIRECT";
                            } else if (slot.subsidiaryMaster) {
                              key = `container:${slot.subsidiaryMaster.id}`;
                              kind = "CONTAINER";
                              subsidiaryName = slot.subsidiaryMaster.name;
                              subsidiaryCode =
                                slot.subsidiaryMaster.code ?? null;
                            } else {
                              key = "__container_unassigned__";
                              kind = "CONTAINER";
                            }

                            const existing = groupMap.get(key);
                            if (existing) {
                              existing.slots.push(slot);
                            } else {
                              groupMap.set(key, {
                                key,
                                kind,
                                subsidiaryName,
                                subsidiaryCode,
                                slots: [slot],
                                firstSortOrder: slot.sortOrder,
                              });
                            }
                          }

                          const groups = Array.from(groupMap.values()).sort(
                            (a, b) => a.firstSortOrder - b.firstSortOrder,
                          );

                          // 그룹 헤더 라벨/배정 카운트 계산
                          const renderGroupHeader = (g: SlotGroup) => {
                            const total = g.slots.length;
                            let assignedLabel = "";
                            let headerLabel = "";
                            let headerIcon = (
                              <Package className="h-3.5 w-3.5 text-blue-600" />
                            );
                            let headerBg = "bg-blue-50/60";

                            if (g.kind === "DIRECT") {
                              const assigned = g.slots.filter(
                                (s) => s.supplierItem !== null,
                              ).length;
                              assignedLabel = `${assigned}/${total} 배정`;
                              headerLabel = "직배송";
                              headerIcon = (
                                <Truck className="h-3.5 w-3.5 text-amber-600" />
                              );
                              headerBg = "bg-amber-50/60";
                            } else {
                              const assigned = g.slots.filter(
                                (s) => s.recipe !== null,
                              ).length;
                              assignedLabel = `${assigned}/${total} 배정`;
                              if (g.subsidiaryName) {
                                headerLabel = g.subsidiaryName;
                              } else {
                                headerLabel = "용기 미지정";
                                headerBg = "bg-gray-50/80";
                              }
                            }

                            return (
                              <TableRow
                                key={`group-header-${g.key}`}
                                className={`${headerBg} hover:${headerBg}`}
                              >
                                <TableCell
                                  colSpan={6}
                                  className="py-1.5 text-xs font-medium"
                                >
                                  <div className="flex items-center gap-2">
                                    {headerIcon}
                                    <span className="text-gray-800">
                                      {headerLabel}
                                    </span>
                                    {g.subsidiaryCode && (
                                      <span className="text-gray-400">
                                        · {g.subsidiaryCode}
                                      </span>
                                    )}
                                    <span className="ml-auto text-gray-500">
                                      {assignedLabel}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          };

                          return groups.flatMap((g) => [
                            renderGroupHeader(g),
                            ...g.slots.map((slot) => {
                              const isEditing = editingSlotId === slot.id;

                              // ── 편집 모드 ──
                              if (isEditing && editSlotForm) {
                                return (
                                  <TableRow
                                    key={slot.id}
                                    className="bg-amber-50/40"
                                  >
                                    <TableCell className="text-center">
                                      {slot.sortOrder + 1}
                                    </TableCell>
                                    <TableCell>
                                      {slot.kind === "CONTAINER" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                          <Package className="h-3 w-3" /> 용기
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                          <Truck className="h-3 w-3" /> 직배송
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {slot.kind === "CONTAINER" ? (
                                        <div className="space-y-1">
                                          {(() => {
                                            // Phase 7-F2: (subsidiary, slotIndex)별 적격 레시피만 표시
                                            const cacheKey =
                                              slot.subsidiaryMaster &&
                                              slot.containerSlotIndex !== null
                                                ? `${slot.subsidiaryMaster.id}:${slot.containerSlotIndex}`
                                                : null;
                                            const eligible = cacheKey
                                              ? (eligibleRecipesCache[
                                                  cacheKey
                                                ] ?? null)
                                              : null;
                                            // 로드 중 (cacheKey는 있는데 캐시는 아직 없음)
                                            const isLoading =
                                              cacheKey !== null &&
                                              eligible === null;
                                            const hasNoEligible =
                                              !isLoading &&
                                              eligible !== null &&
                                              eligible.length === 0;
                                            return (
                                              <>
                                                <SearchableSelect
                                                  options={(eligible ?? []).map<SearchableOption>(
                                                    (r) => ({
                                                      id: r.id,
                                                      label: r.name,
                                                      sublabel: r.code,
                                                    }),
                                                  )}
                                                  value={editSlotForm.recipeId}
                                                  onChange={(v) =>
                                                    setEditSlotForm({
                                                      ...editSlotForm,
                                                      recipeId: v,
                                                    })
                                                  }
                                                  placeholder={
                                                    isLoading
                                                      ? "적격 레시피 조회 중..."
                                                      : hasNoEligible
                                                        ? "배정 가능한 레시피 없음"
                                                        : "레시피 미배정"
                                                  }
                                                  searchPlaceholder="레시피 이름 또는 코드 검색..."
                                                  emptyText={
                                                    hasNoEligible
                                                      ? "이 용기 슬롯에 배정 가능한 레시피가 없습니다. 레시피 BOM에서 해당 용기 슬롯의 중량을 등록·확정하세요."
                                                      : "등록된 레시피가 없습니다"
                                                  }
                                                  allowClear
                                                  clearLabel="미배정"
                                                  size="sm"
                                                  disabled={isLoading}
                                                />
                                                {hasNoEligible && (
                                                  <p className="text-[10px] text-amber-700">
                                                    ⚠ 이 슬롯에 배정 가능한 ACTIVE BOM이 없습니다
                                                  </p>
                                                )}
                                              </>
                                            );
                                          })()}
                                          {slot.subsidiaryMaster && (
                                            <div className="text-xs text-gray-500">
                                              {slot.subsidiaryMaster.name}
                                              {slot.containerSlotIndex !==
                                                null &&
                                                ` · 슬롯 #${slot.containerSlotIndex + 1}`}
                                            </div>
                                          )}
                                          <Input
                                            value={editSlotForm.note}
                                            onChange={(e) =>
                                              setEditSlotForm({
                                                ...editSlotForm,
                                                note: e.target.value,
                                              })
                                            }
                                            placeholder="비고 (선택)"
                                            className="h-7 text-xs"
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <div className="text-sm">
                                            {slot.supplierItem?.productName ?? (
                                              <span className="text-gray-400">
                                                품목 미배정
                                              </span>
                                            )}
                                          </div>
                                          {slot.supplierItem?.supplier && (
                                            <div className="text-xs text-gray-500">
                                              {slot.supplierItem.supplier.name}
                                              {slot.supplierItem
                                                .supplierItemCode &&
                                                ` · ${slot.supplierItem.supplierItemCode}`}
                                            </div>
                                          )}
                                          <Input
                                            value={editSlotForm.note}
                                            onChange={(e) =>
                                              setEditSlotForm({
                                                ...editSlotForm,
                                                note: e.target.value,
                                              })
                                            }
                                            placeholder="비고 (선택)"
                                            className="h-7 text-xs"
                                          />
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <SearchableSelect
                                        options={productionLineOptions.map<SearchableOption>(
                                          (p) => ({
                                            id: p.id,
                                            label: p.name,
                                            sublabel:
                                              p.locationName || undefined,
                                          }),
                                        )}
                                        value={editSlotForm.productionLineId}
                                        onChange={(v) =>
                                          setEditSlotForm({
                                            ...editSlotForm,
                                            productionLineId: v,
                                          })
                                        }
                                        placeholder="미지정"
                                        searchPlaceholder="라인 검색..."
                                        emptyText="등록된 라인이 없습니다"
                                        allowClear
                                        clearLabel="미지정"
                                        size="sm"
                                      />
                                    </TableCell>
                                    {/* ★ Phase 9-D-Sym: 예상/확정 수량 인라인 편집 (위/아래 2칸) */}
                                    <TableCell className="text-right">
                                      <div className="flex flex-col items-end gap-1">
                                        <Input
                                          type="number"
                                          min={0}
                                          value={editSlotForm.estimatedQuantity}
                                          onChange={(e) =>
                                            setEditSlotForm({
                                              ...editSlotForm,
                                              estimatedQuantity: e.target.value,
                                            })
                                          }
                                          placeholder={
                                            _mealCountForMp != null
                                              ? String(_mealCountForMp)
                                              : "0"
                                          }
                                          title={
                                            _mealCountForMp != null
                                              ? `비워두거나 0 입력 시 예상식수 ${_mealCountForMp.toLocaleString()}식이 전량 적용됩니다 (예상수량)`
                                              : "예상수량"
                                          }
                                          className="h-7 w-20 text-right text-xs"
                                        />
                                        <Input
                                          type="number"
                                          min={0}
                                          value={editSlotForm.finalQuantity}
                                          onChange={(e) =>
                                            setEditSlotForm({
                                              ...editSlotForm,
                                              finalQuantity: e.target.value,
                                            })
                                          }
                                          placeholder="확정 —"
                                          title="확정수량 (진행중→완료 단계 입력. 비우면 미입력 상태로 저장)"
                                          className="h-7 w-20 text-right text-xs border-emerald-200 text-emerald-700 placeholder:text-emerald-300"
                                        />
                                      </div>
                                    </TableCell>

                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-0.5">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={handleSaveSlot}
                                          disabled={slotUpdating}
                                          title="저장"
                                        >
                                          {slotUpdating ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Check className="h-3 w-3 text-emerald-600" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={closeSlotEdit}
                                          disabled={slotUpdating}
                                          title="취소"
                                        >
                                          <X className="h-3 w-3 text-gray-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              // ── 보기 모드 (기존 동작 유지) ──
                              return (
                                <TableRow key={slot.id}>
                                  <TableCell className="text-center">
                                    {slot.sortOrder + 1}
                                  </TableCell>
                                  <TableCell>
                                    {slot.kind === "CONTAINER" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                        <Package className="h-3 w-3" /> 용기
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                        <Truck className="h-3 w-3" /> 직배송
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {slot.kind === "CONTAINER" ? (
                                      <div>
                                        <div className="text-sm">
                                          {slot.recipe?.name ?? (
                                            <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                              레시피 미배정
                                            </span>
                                          )}
                                        </div>
                                        {slot.subsidiaryMaster && (
                                          <div className="text-xs text-gray-500">
                                            {slot.subsidiaryMaster.name}
                                            {slot.containerSlotIndex !==
                                              null &&
                                              ` · 슬롯 #${slot.containerSlotIndex + 1}`}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="text-sm">
                                          {slot.supplierItem?.productName ?? (
                                            <span className="text-gray-400">
                                              품목 미배정
                                            </span>
                                          )}
                                        </div>
                                        {slot.supplierItem?.supplier && (
                                          <div className="text-xs text-gray-500">
                                            {slot.supplierItem.supplier.name}
                                            {slot.supplierItem
                                              .supplierItemCode &&
                                              ` · ${slot.supplierItem.supplierItemCode}`}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {slot.note && (
                                      <div className="mt-0.5 text-xs text-gray-400">
                                        {slot.note}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-gray-600">
                                    {slot.productionLine?.name ?? "—"}
                                  </TableCell>
                                  {/* ★ Phase 9-D-Sym: 예상/확정 수량 분리 표시
                                      - 상단: 예상수량 (estimatedQuantity) — 기존 fallback 표시 로직 유지
                                      - 하단: 확정수량 (finalQuantity) — null이면 흐릿한 "—" 표시 */}
                                  <TableCell className="text-right">
                                    <div className="flex flex-col items-end leading-tight">
                                      {/* 예상수량 (estimatedQuantity) */}
                                      {slot.estimatedQuantity > 0 ? (
                                        <span className="font-medium">
                                          {slot.estimatedQuantity.toLocaleString()}
                                        </span>
                                      ) : _mealCountForMp != null ? (
                                        <span
                                          className="italic text-gray-400"
                                          title={`예상수량 미입력 → 예상식수 ${_mealCountForMp.toLocaleString()}식 전량 적용`}
                                        >
                                          {_mealCountForMp.toLocaleString()}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                      {/* 확정수량 (finalQuantity) */}
                                      {slot.finalQuantity != null ? (
                                        <span className="text-xs text-emerald-700">
                                          확정 {slot.finalQuantity.toLocaleString()}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-gray-300">확정 —</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => openSlotEdit(slot)}
                                        title="수정"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-500" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          setDeleteTarget({
                                            type: "slot",
                                            id: slot.id,
                                            name: `슬롯 ${slot.sortOrder + 1}`,
                                          })
                                        }
                                        title="삭제"
                                      >
                                        <X className="h-3 w-3 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }),
                          ]);
                        })()}
                      </TableBody>
                    </Table>
                        )}
                      </>
                    );
                  })()}

                  {/* 부자재 */}
                  <div className="mt-3 border-t pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">
                        부자재
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => openAccessoryAdd(mp)}
                      >
                        <Plus className="mr-1 h-3 w-3" /> 추가
                      </Button>
                    </div>
                    {mp.accessories.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        등록된 부자재가 없습니다.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {mp.accessories.map((acc) => (
                          <div
                            key={acc.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-700"
                          >
                            <span className="font-medium">
                              {acc.subsidiaryMaster.name}
                            </span>
                            <span className="text-orange-500">
                              {CONSUMPTION_MODE_LABEL[acc.consumptionMode]}
                              {acc.consumptionMode === "FIXED_QUANTITY" &&
                                acc.fixedQuantity != null &&
                                ` · ${acc.fixedQuantity}`}
                            </span>
                            {acc.required && (
                              <span className="rounded bg-orange-200 px-1 text-[10px] text-orange-800">
                                필수
                              </span>
                            )}
                            {acc.note && (
                              <span
                                className="text-orange-400"
                                title={acc.note}
                              >
                                · {acc.note.length > 12
                                  ? acc.note.slice(0, 12) + "…"
                                  : acc.note}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openAccessoryEdit(acc)}
                              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-orange-200"
                              title="수정"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "accessory",
                                  id: acc.id,
                                  name: `부자재 ${acc.subsidiaryMaster.name}`,
                                })
                              }
                              className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-red-200"
                              title="삭제"
                            >
                              <X className="h-2.5 w-2.5 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 식단 추가 다이얼로그 */}
        <Dialog
          open={!!addMealGroupId}
          onOpenChange={(open) => !open && setAddMealGroupId(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>식단 추가</DialogTitle>
              <DialogDescription>
                같은 그룹 안에서 (식사타입, 라인업) 조합은 1개만 허용됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-meal-slot">슬롯</Label>
                <Select
                  value={addMealCompanyMealSlotId}
                  onValueChange={setAddMealCompanyMealSlotId}
                >
                  <SelectTrigger id="add-meal-slot">
                    <SelectValue placeholder="슬롯을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {slotOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>라인업 *</Label>
                <LineupSelect
                  value={addMealLineupId}
                  onChange={(lineupId) => setAddMealLineupId(lineupId)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-meal-template">식단 템플릿 (선택)</Label>
                <SearchableSelect
                  options={templateOptions.map<SearchableOption>((t) => ({
                    id: t.id,
                    label: t.name,
                  }))}
                  value={addMealTemplateId}
                  onChange={setAddMealTemplateId}
                  placeholder="템플릿 선택"
                  searchPlaceholder="템플릿 이름 검색..."
                  emptyText="등록된 템플릿이 없습니다"
                  allowClear
                  clearLabel="없음"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-meal-note">비고 (선택)</Label>
                <Textarea
                  rows={2}
                  value={addMealNote}
                  onChange={(e) => setAddMealNote(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddMealGroupId(null)}
                >
                  취소
                </Button>
                <Button
                  onClick={handleAddMeal}
                  disabled={
                    mealSaving || !addMealCompanyMealSlotId || !addMealLineupId.trim()
                  }
                >
                  {mealSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  추가
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 식수 편집 다이얼로그 — 식단에 1:1 매칭 */}
        <Dialog
          open={!!editMealCountTarget}
          onOpenChange={(open) => !open && closeMealCountEditor()}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editMealCountTarget?.existingMealCountId ? "식수 수정" : "식수 입력"}
              </DialogTitle>
              <DialogDescription>
                선택한 식단의 예상/확정 식수를 입력합니다. 같은 (식사 × 라인업)
                식수는 1행만 유지됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border bg-white px-3 py-2 text-sm">
                <div className="text-xs text-gray-500">대상 식단</div>
                <div className="mt-0.5 font-medium">
                  {editMealCountTarget?.companyMealSlotLabel} ·{" "}
                  {editMealCountTarget?.lineupLabel}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-mc-est">예상 식수 *</Label>
                  <Input
                    id="edit-mc-est"
                    type="number"
                    min={0}
                    value={editMealCountEstimated}
                    onChange={(e) => setEditMealCountEstimated(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-mc-final">확정 식수 (선택)</Label>
                  <Input
                    id="edit-mc-final"
                    type="number"
                    min={0}
                    value={editMealCountFinal}
                    onChange={(e) => setEditMealCountFinal(e.target.value)}
                    placeholder="미입력 시 null"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeMealCountEditor}>
                  취소
                </Button>
                <Button
                  onClick={handleSaveMealCount}
                  disabled={mealCountSaving || editMealCountEstimated === ""}
                >
                  {mealCountSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Phase 7-A3: 용기 그룹 일괄 배정 다이얼로그 */}
        <Dialog
          open={!!bulkSlotMealPlan}
          onOpenChange={(open) => !open && closeBulkSlotEditor()}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
            <DialogTitle>용기 그룹 일괄 배정</DialogTitle>
              <DialogDescription>
                <strong>{bulkSlotMealPlan?.title}</strong> 식단에 용기 그룹을
                추가합니다. 선택한 용기 그룹의 모든 슬롯이 한 번에 펼쳐지며,
                슬롯별로 레시피·생산라인을 지정합니다. 레시피를 비워두면 "미배정"
                슬롯으로 저장됩니다 (나중에 채울 수 있음).
                {bulkSlotMealCount != null && (
                  <span className="mt-1 block text-xs text-gray-600">
                    ※ 수량을 0으로 두면 예상식수{" "}
                    <b>{bulkSlotMealCount.toLocaleString()}식</b>이 전량
                    적용됩니다. 입력 시 모든 슬롯의 합계가 예상식수와 일치해야
                    합니다.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 상단: 용기 그룹 + 기본 라인 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="bulk-container">용기 그룹 *</Label>
                    <SearchableSelect
                      options={containerOptions.map<SearchableOption>((c) => ({
                        id: c.id,
                        label: c.name,
                        sublabel: c.code,
                        rightLabel: `슬롯 ${c.slots.length}개`,
                      }))}
                      value={bulkSlotContainerId}
                      onChange={handleBulkContainerChange}
                      placeholder="용기 그룹을 선택하세요"
                      searchPlaceholder="용기 이름 또는 코드 검색..."
                      emptyText="등록된 용기 그룹이 없습니다"
                    />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="bulk-default-line">
                    기본 생산 라인 (선택)
                  </Label>
                  <SearchableSelect
                    options={productionLineOptions.map<SearchableOption>((p) => ({
                      id: p.id,
                      label: p.name,
                      sublabel: p.locationName || undefined,
                    }))}
                    value={bulkSlotDefaultLineId}
                    onChange={setBulkSlotDefaultLineId}
                    placeholder="미지정"
                    searchPlaceholder="라인 이름 또는 위치 검색..."
                    emptyText="등록된 라인이 없습니다"
                    allowClear
                    clearLabel="미지정"
                  />
                </div>
              </div>

              {/* 슬롯 행 테이블 */}
              {selectedBulkContainer ? (
                selectedBulkContainer.slots.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
                    이 용기 그룹에 등록된 슬롯이 없습니다. 용기 관리에서 슬롯을
                    먼저 추가하세요.
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-gray-50">
                        <TableRow>
                          <TableHead className="w-[80px]">슬롯</TableHead>
                          <TableHead>레시피</TableHead>
                          <TableHead className="w-[180px]">생산라인</TableHead>
                          <TableHead className="w-[90px] text-right">
                            예상/확정
                          </TableHead>
                          <TableHead className="w-[160px]">비고</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBulkContainer.slots.map((s) => {
                          const row = bulkSlotRows[s.slotIndex] ?? {
                            recipeId: "",
                            productionLineId: "",
                            quantity: "0",
                            note: "",
                          };
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-xs">
                                <div className="font-medium">
                                  #{s.slotIndex + 1}
                                </div>
                                <div className="text-gray-500">{s.label}</div>
                                {s.volumeMl != null && (
                                  <div className="text-gray-400">
                                    {s.volumeMl}ml
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  // Phase 7-F3: (선택된 용기, 슬롯)별 적격 레시피만 표시
                                  const cacheKey = `${bulkSlotContainerId}:${s.slotIndex}`;
                                  const eligible =
                                    eligibleRecipesCache[cacheKey] ?? null;
                                  const isLoading = eligible === null;
                                  const hasNoEligible =
                                    !isLoading && eligible.length === 0;
                                  return (
                                    <div className="space-y-1">
                                      <SearchableSelect
                                        options={(eligible ?? []).map<SearchableOption>(
                                          (r) => ({
                                            id: r.id,
                                            label: r.name,
                                            sublabel: r.code,
                                          }),
                                        )}
                                        value={row.recipeId}
                                        onChange={(v) =>
                                          updateBulkRow(s.slotIndex, {
                                            recipeId: v,
                                          })
                                        }
                                        placeholder={
                                          isLoading
                                            ? "조회 중..."
                                            : hasNoEligible
                                              ? "배정 가능한 레시피 없음"
                                              : "미배정"
                                        }
                                        searchPlaceholder="레시피 이름 또는 코드 검색..."
                                        emptyText={
                                          hasNoEligible
                                            ? "이 슬롯에 배정 가능한 레시피가 없습니다"
                                            : "등록된 레시피가 없습니다"
                                        }
                                        allowClear
                                        clearLabel="미배정"
                                        size="sm"
                                        disabled={isLoading}
                                      />
                                      {hasNoEligible && (
                                        <p className="text-[10px] text-amber-700">
                                          ⚠ ACTIVE BOM 없음
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <SearchableSelect
                                  options={productionLineOptions.map<SearchableOption>(
                                    (p) => ({
                                      id: p.id,
                                      label: p.name,
                                      sublabel: p.locationName || undefined,
                                    }),
                                  )}
                                  value={row.productionLineId}
                                  onChange={(v) =>
                                    updateBulkRow(s.slotIndex, {
                                      productionLineId: v,
                                    })
                                  }
                                  placeholder="기본 라인 따름"
                                  searchPlaceholder="라인 이름 또는 위치 검색..."
                                  emptyText="등록된 라인이 없습니다"
                                  allowClear
                                  clearLabel="기본 라인 따름"
                                  size="sm"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateBulkRow(s.slotIndex, {
                                      quantity: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    bulkSlotMealCount != null
                                      ? String(bulkSlotMealCount)
                                      : "0"
                                  }
                                  title={
                                    bulkSlotMealCount != null
                                      ? `비워두거나 0 입력 시 예상식수 ${bulkSlotMealCount.toLocaleString()}식이 전량 적용됩니다`
                                      : undefined
                                  }
                                  className="h-8 w-20 text-right text-xs"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.note}
                                  onChange={(e) =>
                                    updateBulkRow(s.slotIndex, {
                                      note: e.target.value,
                                    })
                                  }
                                  placeholder="-"
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
                  먼저 용기 그룹을 선택하면 해당 그룹의 모든 슬롯이 펼쳐집니다.
                </div>
              )}

              {/* 요약 */}
              {selectedBulkContainer && selectedBulkContainer.slots.length > 0 && (
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">총 슬롯</span>
                    <span className="font-medium">
                      {selectedBulkContainer.slots.length}개
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500">레시피 배정</span>
                    <span className="font-medium text-emerald-700">
                      {
                        selectedBulkContainer.slots.filter(
                          (s) => bulkSlotRows[s.slotIndex]?.recipeId,
                        ).length
                      }
                      개
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500">미배정</span>
                    <span className="font-medium text-amber-700">
                      {
                        selectedBulkContainer.slots.filter(
                          (s) => !bulkSlotRows[s.slotIndex]?.recipeId,
                        ).length
                      }
                      개
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeBulkSlotEditor}>
                  취소
                </Button>
                <Button
                  onClick={handleBulkSubmit}
                  disabled={
                    bulkSlotSaving ||
                    !bulkSlotContainerId ||
                    !selectedBulkContainer ||
                    selectedBulkContainer.slots.length === 0
                  }
                >
                  {bulkSlotSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  배정 저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Phase 7-A2: 템플릿 재적용 확인 다이얼로그 */}
        <AlertDialog
          open={!!templateApplyConfirm}
          onOpenChange={(open) => !open && setTemplateApplyConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>템플릿 재적용</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block">
                  <strong>{templateApplyConfirm?.mealPlanLabel}</strong> 식단에
                  템플릿{" "}
                  <strong>{templateApplyConfirm?.mealTemplateName}</strong>의
                  구성을 다시 적용합니다.
                </span>
                <span className="mt-2 block text-amber-700">
                  ⚠ 현재 식단의 슬롯과 부자재가 모두 삭제되고 템플릿 구성으로
                  교체됩니다. 이 작업은 되돌릴 수 없습니다.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={templateApplying}>
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApplyTemplate}
                disabled={templateApplying}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {templateApplying && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                덮어쓰기 적용
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Phase 7-B2: 부자재 추가/수정 다이얼로그 (공용) */}
        <Dialog
          open={!!accessoryAddTarget || !!accessoryEditTarget}
          onOpenChange={(open) => !open && closeAccessoryDialog()}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {accessoryEditTarget ? "부자재 수정" : "부자재 추가"}
              </DialogTitle>
              <DialogDescription>
                {accessoryEditTarget
                  ? `${accessoryEditTarget.subsidiaryMaster.name}의 구성을 수정합니다.`
                  : accessoryAddTarget
                    ? `${accessoryAddTarget.mealPlanLabel} 식단에 부자재를 추가합니다.`
                    : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
            <div className="space-y-2">
                <Label>부자재</Label>
                <SearchableSelect
                  options={accessoryOptions.map<SearchableOption>((s) => ({
                    id: s.id,
                    label: s.name,
                    sublabel: s.code,
                    rightLabel: s.unit,
                  }))}
                  value={accessoryFormSubsidiaryId}
                  onChange={setAccessoryFormSubsidiaryId}
                  placeholder="부자재 선택"
                  searchPlaceholder="부자재 이름 또는 코드 검색..."
                  emptyText="등록된 부자재가 없습니다"
                />
                {accessoryOptions.length === 0 && (
                  <p className="text-xs text-amber-600">
                    등록된 부자재(소모품·악세사리)가 없습니다. 부자재 관리에서
                    먼저 등록해주세요.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>소비 방식</Label>
                <Select
                  value={accessoryFormMode}
                  onValueChange={(v) =>
                    setAccessoryFormMode(
                      v as "PER_MEAL_COUNT" | "FIXED_QUANTITY",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_MEAL_COUNT">
                      식수 비례 (식수 × 1)
                    </SelectItem>
                    <SelectItem value="FIXED_QUANTITY">
                      고정수량 (식수와 무관)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {accessoryFormMode === "FIXED_QUANTITY" && (
                <div className="space-y-2">
                  <Label htmlFor="acc-fixed-qty">고정수량</Label>
                  <Input
                    id="acc-fixed-qty"
                    type="number"
                    min={0}
                    value={accessoryFormFixedQuantity}
                    onChange={(e) =>
                      setAccessoryFormFixedQuantity(e.target.value)
                    }
                    placeholder="예: 50"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="acc-required"
                  checked={accessoryFormRequired}
                  onCheckedChange={(c) =>
                    setAccessoryFormRequired(c === true)
                  }
                />
                <Label htmlFor="acc-required" className="cursor-pointer">
                  필수 항목으로 표시
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-note">비고 (선택)</Label>
                <Textarea
                  id="acc-note"
                  rows={2}
                  value={accessoryFormNote}
                  onChange={(e) => setAccessoryFormNote(e.target.value)}
                  placeholder="-"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={closeAccessoryDialog}
                  disabled={accessorySaving}
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveAccessory}
                  disabled={accessorySaving || !accessoryFormSubsidiaryId}
                >
                  {accessorySaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {accessoryEditTarget ? "수정" : "추가"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 상태 변경 */}
        {/* R1-5b: 상태 전환 확인 다이얼로그 (newStatus는 헤더 버튼에서 미리 설정됨) */}
        <Dialog
          open={!!statusChangeTarget && !!newStatus}
          onOpenChange={(open) => {
            if (!open) {
              setStatusChangeTarget(null);
              setNewStatus("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>상태 전환 확인</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 pt-2 text-sm">
                  {statusChangeTarget && newStatus && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLOR[statusChangeTarget.currentStatus] ?? ""
                        }`}
                      >
                        {STATUS_LABEL[statusChangeTarget.currentStatus] ??
                          statusChangeTarget.currentStatus}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLOR[newStatus] ?? ""
                        }`}
                      >
                        {STATUS_LABEL[newStatus] ?? newStatus}
                      </span>
                    </div>
                  )}
                  {statusChangeTarget?.currentStatus === "CONFIRMED" &&
                    newStatus === "IN_PROGRESS" && (
                      <p className="text-amber-700">
                        ⚠ 모든 식단의 슬롯 수량과 예상식수가 정합해야 합니다.
                      </p>
                    )}
                  {statusChangeTarget?.currentStatus === "IN_PROGRESS" &&
                    newStatus === "COMPLETED" && (
                      <p className="text-amber-700">
                        ⚠ 모든 식단의 확정식수가 입력되어 있어야 합니다.
                      </p>
                    )}
                  {newStatus === "CANCELLED" && (
                    <p className="text-red-600">
                      ⚠ 취소된 식단은 작성중으로 복구할 수 있습니다.
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusChangeTarget(null);
                  setNewStatus("");
                }}
              >
                취소
              </Button>
              <Button onClick={handleStatusChange}>전환</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>삭제 확인</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{deleteTarget?.name}&rdquo;을(를) 삭제하시겠습니까? 이
                작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ══════════════════════════════════════
  // 목록 뷰
  // ══════════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">식단 계획</h1>
        <p className="text-sm text-gray-500">
          날짜별 식단 그룹을 관리합니다. 각 그룹 안에 (식사타입 × 라인업) 조합
          식단을 구성할 수 있습니다.
        </p>
      </div>

      {/* 검색 + 필터 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="비고로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter || "ALL"}
          onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => fetchData(1)} variant="outline" size="sm">
          검색
        </Button>
        <Button onClick={() => setShowCreateDialog(true)} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" /> 식단 그룹 생성
        </Button>
      </div>

      {/* 메인 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>비고</TableHead>
              <TableHead className="w-[80px] text-center">상태</TableHead>
              <TableHead className="w-[80px] text-center">식단 수</TableHead>
              <TableHead className="w-[80px] text-center">식수 행</TableHead>
              <TableHead className="w-[140px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중...
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-gray-500"
                >
                  {search.trim()
                    ? `"${search}" 검색 결과가 없습니다`
                    : "등록된 식단 그룹이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    {new Date(item.planDate).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      weekday: "short",
                    })}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-gray-600">
                    {item.note ?? <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[item.status] ?? ""
                      }`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {item._count?.mealPlans ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {item._count?.mealCounts ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="상세"
                        onClick={() => openDetail(item.id)}
                      >
                        <Eye className="h-3.5 w-3.5 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="복사"
                        onClick={() => {
                          setCopySource(item);
                          setCopyDate("");
                          setCopyAccessories(true);
                          setCopyMealCounts(false);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="삭제"
                        onClick={() =>
                          setDeleteTarget({
                            type: "group",
                            id: item.id,
                            name: new Date(item.planDate).toLocaleDateString(
                              "ko-KR",
                            ),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            전체 {pagination.total}건 중{" "}
            {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchData(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchData(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 그룹 생성 다이얼로그 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>식단 그룹 생성</DialogTitle>
            <DialogDescription>
              날짜와 비고를 입력하세요. 라인업은 그룹 안의 각 식단마다 별도로
              지정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-plan-date">날짜</Label>
              <Input
                id="form-plan-date"
                type="date"
                value={formPlanDate}
                onChange={(e) => setFormPlanDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-note">비고 (선택)</Label>
              <Textarea
                id="form-note"
                rows={2}
                placeholder="예) 중식 2라인업 / 석식 1라인업"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                취소
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={formSaving || !formPlanDate}
              >
                {formSaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 복사 다이얼로그 */}
      <Dialog
        open={!!copySource}
        onOpenChange={(open) => !open && setCopySource(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>식단 복사</DialogTitle>
            <DialogDescription>
              {copySource &&
                new Date(copySource.planDate).toLocaleDateString("ko-KR")}{" "}
              식단을 다른 날짜로 복사합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="copy-date">복사 대상 날짜</Label>
              <Input
                id="copy-date"
                type="date"
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>복사 옵션</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="copy-accessories"
                  checked={copyAccessories}
                  onCheckedChange={(v) => setCopyAccessories(v === true)}
                />
                <label htmlFor="copy-accessories" className="text-sm">
                  부자재 복사 (권장)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="copy-meal-counts"
                  checked={copyMealCounts}
                  onCheckedChange={(v) => setCopyMealCounts(v === true)}
                />
                <label htmlFor="copy-meal-counts" className="text-sm">
                  식수도 복사
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCopySource(null)}>
                취소
              </Button>
              <Button
                onClick={handleCopyGroup}
                disabled={copySaving || !copyDate}
              >
                {copySaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                복사
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo;을(를) 삭제하시겠습니까? 하위
              식단/슬롯/부자재/식수가 모두 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
