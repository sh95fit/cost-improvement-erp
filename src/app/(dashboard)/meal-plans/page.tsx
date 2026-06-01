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
  createMealPlanSlotAction,
  deleteMealPlanSlotAction,
  upsertMealCountAction,
  deleteMealCountAction,
  getActiveProductionLinesAction,
} from "@/features/meal-plan/actions/meal-plan.action";
import { getMealTemplatesAction } from "@/features/meal-template/actions/meal-template.action";
import { getContainerGroupsAction } from "@/features/container/actions/container.action";
import { getRecipesAction } from "@/features/recipe/actions/recipe.action";
import { loadAllPages } from "@/lib/action-helpers";
import type { PaginatedFetcher } from "@/lib/action-helpers";
import { LineupSelect } from "@/components/lineup/lineup-select";
import {
  getActiveCompanyMealSlotsAction,
  type CompanyMealSlotOption,
} from "@/features/company-meal-slot/actions/company-meal-slot.action";

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
  quantity: number;
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
type ProductionLineOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

// ══════════════════════════════════════════════════════════════
// 표시 라벨/색상
// ══════════════════════════════════════════════════════════════

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "작성중",
  CONFIRMED: "확정",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-green-100 text-green-700",
  COMPLETED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const CONSUMPTION_MODE_LABEL: Record<string, string> = {
  PER_MEAL_COUNT: "식수 비례",
  FIXED_QUANTITY: "고정수량",
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

  // ── Phase 5-R Step 7-A: 슬롯 에디터 (CONTAINER 슬롯 추가) ──
  const [containerOptions, setContainerOptions] = useState<ContainerOption[]>(
    [],
  );
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([]);
  const [productionLineOptions, setProductionLineOptions] = useState<
    ProductionLineOption[]
  >([]);
  const [addSlotMealPlan, setAddSlotMealPlan] = useState<{
    mealPlanId: string;
    title: string;
    nextSortOrder: number;
  } | null>(null);
  const [addSlotContainerId, setAddSlotContainerId] = useState("");
  const [addSlotContainerSlotIndex, setAddSlotContainerSlotIndex] =
    useState<string>("");
  const [addSlotRecipeId, setAddSlotRecipeId] = useState("");
  const [addSlotProductionLineId, setAddSlotProductionLineId] = useState(""); // "" = 미지정
  const [addSlotQuantity, setAddSlotQuantity] = useState<string>("0");
  const [addSlotNote, setAddSlotNote] = useState("");
  const [slotSaving, setSlotSaving] = useState(false);

  // ── 삭제 확인 ──
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "group" | "meal" | "slot" | "mealCount";
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
      const [containers, recipes, lines] = await Promise.all([
        loadAllPages<ContainerOption>(
          getContainerGroupsAction as PaginatedFetcher<ContainerOption>,
          "name",
        ),
        loadAllPages<RecipeOption>(
          getRecipesAction as PaginatedFetcher<RecipeOption>,
          "name",
        ),
        getActiveProductionLinesAction(),
      ]);
      if (containers.error) {
        logger.error("[MealPlansPage.loadSlotEditorOptions.containers]", containers.error);
      } else {
        setContainerOptions(containers.items);
      }
      if (recipes.error) {
        logger.error("[MealPlansPage.loadSlotEditorOptions.recipes]", recipes.error);
      } else {
        setRecipeOptions(recipes.items);
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

  useEffect(() => {
    fetchData(1);
    loadTemplateOptions();
    loadSlotOptions();
    loadSlotEditorOptions();
  }, [fetchData, loadTemplateOptions, loadSlotOptions, loadSlotEditorOptions]);

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

  const handleStatusChange = async () => {
    if (!statusChangeTarget || !newStatus) return;
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

  // ── 식단(MealPlan) 추가 ──
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
      if (result.success) {
        const slotLabel =
          slotOptions.find((o) => o.id === addMealCompanyMealSlotId)
            ?.displayName ?? "식단";
        toast.success(`${slotLabel} 식단이 추가되었습니다`);
        setAddMealGroupId(null);
        setAddMealCompanyMealSlotId("");
        setAddMealLineupId("");
        setAddMealTemplateId("");
        setAddMealNote("");
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "식단 추가에 실패했습니다");
      }
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

  // ── Phase 5-R Step 7-A: 슬롯(CONTAINER) 추가 ──
  const openSlotEditor = (mp: MealPlanRow) => {
    const title = `${mp.companyMealSlot?.displayName ?? "-"} · ${mp.lineup?.name ?? "—"}`;
    const nextSortOrder =
      mp.slots.length === 0
        ? 0
        : Math.max(...mp.slots.map((s) => s.sortOrder)) + 1;
    setAddSlotMealPlan({ mealPlanId: mp.id, title, nextSortOrder });
    setAddSlotContainerId("");
    setAddSlotContainerSlotIndex("");
    setAddSlotRecipeId("");
    setAddSlotProductionLineId("");
    setAddSlotQuantity("0");
    setAddSlotNote("");
  };

  const closeSlotEditor = () => {
    setAddSlotMealPlan(null);
    setAddSlotContainerId("");
    setAddSlotContainerSlotIndex("");
    setAddSlotRecipeId("");
    setAddSlotProductionLineId("");
    setAddSlotQuantity("0");
    setAddSlotNote("");
  };

  const selectedContainer = containerOptions.find(
    (c) => c.id === addSlotContainerId,
  );

  const handleAddSlot = async () => {
    if (!addSlotMealPlan) return;
    if (!addSlotContainerId) {
      toast.error("용기를 선택하세요");
      return;
    }
    if (addSlotContainerSlotIndex === "") {
      toast.error("용기 슬롯을 선택하세요");
      return;
    }
    if (!addSlotRecipeId) {
      toast.error("레시피를 선택하세요");
      return;
    }
    const slotIndexNum = Number(addSlotContainerSlotIndex);
    if (Number.isNaN(slotIndexNum) || slotIndexNum < 0) {
      toast.error("용기 슬롯 인덱스가 올바르지 않습니다");
      return;
    }
    const quantityNum = Number(addSlotQuantity);
    if (Number.isNaN(quantityNum) || quantityNum < 0) {
      toast.error("수량은 0 이상의 숫자여야 합니다");
      return;
    }

    setSlotSaving(true);
    try {
      const result = await createMealPlanSlotAction(addSlotMealPlan.mealPlanId, {
        kind: "CONTAINER",
        subsidiaryMasterId: addSlotContainerId,
        containerSlotIndex: slotIndexNum,
        recipeId: addSlotRecipeId,
        sortOrder: addSlotMealPlan.nextSortOrder,
        quantity: quantityNum,
        productionLineId: addSlotProductionLineId || null,
        note: addSlotNote.trim() || null,
      });
      if (result.success) {
        toast.success("슬롯이 추가되었습니다");
        closeSlotEditor();
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "슬롯 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleAddSlot]", err);
      toast.error("슬롯 추가 중 오류가 발생했습니다");
    } finally {
      setSlotSaving(false);
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusChangeTarget({
                    id: detailGroup.id,
                    currentStatus: detailGroup.status,
                  });
                  setNewStatus("");
                }}
              >
                상태 변경
              </Button>
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
                        onClick={() => openSlotEditor(mp)}
                      >
                        <PlusCircle className="mr-1 h-3.5 w-3.5" />
                        슬롯 추가
                      </Button>
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
                          <TableHead className="w-[80px] text-right">
                            수량
                          </TableHead>
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mp.slots.map((slot) => (
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
                                      <span className="text-gray-400">
                                        레시피 미배정
                                      </span>
                                    )}
                                  </div>
                                  {slot.subsidiaryMaster && (
                                    <div className="text-xs text-gray-500">
                                      {slot.subsidiaryMaster.name}
                                      {slot.containerSlotIndex !== null &&
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
                                      {slot.supplierItem.supplierItemCode &&
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
                            <TableCell className="text-right">
                              {slot.quantity}
                            </TableCell>
                            <TableCell className="text-right">
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
                              >
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* 부자재 */}
                  {mp.accessories.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-2 text-xs font-semibold text-gray-600">
                        부자재
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {mp.accessories.map((acc) => (
                          <div
                            key={acc.id}
                            className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-700"
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                <Select
                  value={addMealTemplateId || "NONE"}
                  onValueChange={(v) =>
                    setAddMealTemplateId(v === "NONE" ? "" : v)
                  }
                >
                  <SelectTrigger id="add-meal-template">
                    <SelectValue placeholder="템플릿 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">없음</SelectItem>
                    {templateOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* Phase 5-R Step 7-A: 슬롯(CONTAINER) 추가 다이얼로그 */}
        <Dialog
          open={!!addSlotMealPlan}
          onOpenChange={(open) => !open && closeSlotEditor()}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>슬롯 추가 (용기형)</DialogTitle>
              <DialogDescription>
                {addSlotMealPlan?.title} 식단에 새 용기 슬롯을 추가합니다.
                직배송(DIRECT) 슬롯은 다음 단계(7-B)에서 지원됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-slot-container">용기 *</Label>
                <Select
                  value={addSlotContainerId}
                  onValueChange={(v) => {
                    setAddSlotContainerId(v);
                    setAddSlotContainerSlotIndex(""); // 용기 변경 시 슬롯 초기화
                  }}
                >
                  <SelectTrigger id="add-slot-container">
                    <SelectValue placeholder="용기를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {containerOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-gray-400">
                        등록된 용기가 없습니다
                      </div>
                    ) : (
                      containerOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{" "}
                          <span className="text-xs text-gray-400">
                            ({c.code})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-slot-slot-index">용기 슬롯 *</Label>
                <Select
                  value={addSlotContainerSlotIndex}
                  onValueChange={setAddSlotContainerSlotIndex}
                  disabled={!selectedContainer}
                >
                  <SelectTrigger id="add-slot-slot-index">
                    <SelectValue
                      placeholder={
                        selectedContainer
                          ? "슬롯을 선택하세요"
                          : "먼저 용기를 선택하세요"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedContainer?.slots.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-gray-400">
                        용기에 등록된 슬롯이 없습니다
                      </div>
                    ) : (
                      selectedContainer?.slots.map((s) => (
                        <SelectItem key={s.id} value={String(s.slotIndex)}>
                          #{s.slotIndex + 1} {s.label}
                          {s.volumeMl != null && (
                            <span className="ml-1 text-xs text-gray-400">
                              ({s.volumeMl}ml)
                            </span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-slot-recipe">레시피 *</Label>
                <Select
                  value={addSlotRecipeId}
                  onValueChange={setAddSlotRecipeId}
                >
                  <SelectTrigger id="add-slot-recipe">
                    <SelectValue placeholder="레시피를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipeOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-gray-400">
                        등록된 레시피가 없습니다
                      </div>
                    ) : (
                      recipeOptions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}{" "}
                          <span className="text-xs text-gray-400">
                            ({r.code})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="add-slot-line">생산 라인 (선택)</Label>
                  <Select
                    value={addSlotProductionLineId || "NONE"}
                    onValueChange={(v) =>
                      setAddSlotProductionLineId(v === "NONE" ? "" : v)
                    }
                  >
                    <SelectTrigger id="add-slot-line">
                      <SelectValue placeholder="미지정" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">미지정</SelectItem>
                      {productionLineOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.locationName && (
                            <span className="ml-1 text-xs text-gray-400">
                              · {p.locationName}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-slot-quantity">수량</Label>
                  <Input
                    id="add-slot-quantity"
                    type="number"
                    min={0}
                    value={addSlotQuantity}
                    onChange={(e) => setAddSlotQuantity(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-slot-note">비고 (선택)</Label>
                <Textarea
                  id="add-slot-note"
                  rows={2}
                  value={addSlotNote}
                  onChange={(e) => setAddSlotNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeSlotEditor}>
                  취소
                </Button>
                <Button
                  onClick={handleAddSlot}
                  disabled={
                    slotSaving ||
                    !addSlotContainerId ||
                    addSlotContainerSlotIndex === "" ||
                    !addSlotRecipeId
                  }
                >
                  {slotSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  추가
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 상태 변경 */}
        <Dialog
          open={!!statusChangeTarget}
          onOpenChange={(open) => !open && setStatusChangeTarget(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>상태 변경</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-status">새 상태</Label> 
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="new-status">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL)
                      .filter(([k]) => k !== statusChangeTarget?.currentStatus)
                      .map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStatusChangeTarget(null)}
                >
                  취소
                </Button>
                <Button onClick={handleStatusChange} disabled={!newStatus}>
                  변경
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
