// src/features/recipe/components/recipe-detail-dialog.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RecipeForm } from "./recipe-form";
import {
  getRecipeByIdAction,
  addIngredientAction,
  deleteIngredientAction,
  createRecipeBOMWithAutoVersionAction,
  updateRecipeBOMStatusAction,
  updateRecipeBOMBaseWeightAction,
  deleteRecipeBOMAction,
  duplicateRecipeBOMAction,
  addRecipeBOMSlotAction,
  updateRecipeBOMSlotAction,
  deleteRecipeBOMSlotAction,
  addRecipeBOMSlotItemAction,
  updateRecipeBOMSlotItemAction,
  deleteRecipeBOMSlotItemAction,
  getSemiProductsAction,
} from "../actions/recipe.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import {
  getContainerGroupsAction,
  getContainerGroupByIdAction,
} from "@/features/container/actions/container.action";
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  Save,
  Copy,
  Archive,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import { cn } from "@/lib/utils";
import type { RecipeRow } from "./recipe-list";

// ── 타입 정의 ──

type OptionItem = {
  id: string;
  name: string;
  code: string;
  unit: string;
};

type IngredientRow = {
  id: string;
  ingredientType: string;
  sortOrder: number;
  materialMaster: {
    id: string;
    name: string;
    code: string;
    unit: string;
  } | null;
  semiProduct: {
    id: string;
    name: string;
    code: string;
    unit: string;
  } | null;
};

type RecipeBOMSlotItemRow = {
  id: string;
  ingredientType: string;
  weightG: number;
  unit: string;
  sortOrder: number;
  materialMaster: {
    id: string;
    name: string;
    code: string;
    unit: string;
  } | null;
  semiProduct: {
    id: string;
    name: string;
    code: string;
    unit: string;
  } | null;
};

type RecipeBOMSlotRow = {
  id: string;
  slotIndex: number;
  totalWeightG: number;
  note: string | null;
  sortOrder: number;
  containerGroup: { id: string; name: string; code: string };
  items: RecipeBOMSlotItemRow[];
};

type RecipeBOMRow = {
  id: string;
  version: number;
  status: string;
  baseWeightG: number;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  slots: RecipeBOMSlotRow[];
};

type Props = {
  recipe: RecipeRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

const BOM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안",
  ACTIVE: "사용중",
  ARCHIVED: "보관",
};

const BOM_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-orange-50 text-orange-700",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ★ 다중 페이지 전체 로딩 헬퍼 (스키마 max(100) 준수)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAllPages<T>(
  fetcher: (query: Record<string, unknown>) => Promise<any>,
  sortBy: string
): Promise<{ items: T[]; error?: string }> {
  try {
    const first = await fetcher({
      page: 1,
      limit: 100,
      sortBy,
      sortOrder: "asc",
    });
    if (!first.success) {
      return { items: [], error: first.error?.message ?? "조회 실패" };
    }

    const allItems: T[] = [...first.data.items];
    const totalPages: number = first.data.pagination.totalPages;

    if (totalPages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetcher({ page: i + 2, limit: 100, sortBy, sortOrder: "asc" })
        )
      );
      for (const res of remaining) {
        if (res.success) allItems.push(...res.data.items);
      }
    }
    return { items: allItems };
  } catch (err) {
    return { items: [], error: String(err) };
  }
}

// ── Combobox 컴포넌트 (이슈 #4) ──
function IngredientCombobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
}: {
  options: OptionItem[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          {selected ? `${selected.name} (${selected.code})` : placeholder}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="이름 또는 코드 검색..." className="text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-gray-400">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.code}`}
                  onSelect={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === opt.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.name}
                  <span className="ml-1 text-gray-400">({opt.code})</span>
                  <span className="ml-auto text-gray-400">{opt.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function RecipeDetailDialog({
  recipe,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [recipeBoms, setRecipeBoms] = useState<RecipeBOMRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBom, setExpandedBom] = useState<string | null>(null);

  // 재료 추가 폼 — 연속 모드 (이슈 #3)
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [newIngredientType, setNewIngredientType] = useState<
    "MATERIAL" | "SEMI_PRODUCT"
  >("MATERIAL");
  const [newIngredientId, setNewIngredientId] = useState("");
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);

  // 슬롯 추가 폼
  const [addingSlotBomId, setAddingSlotBomId] = useState<string | null>(null);
  const [newSlotContainerGroupId, setNewSlotContainerGroupId] = useState("");
  const [newSlotIndex, setNewSlotIndex] = useState("0");
  const [newSlotWeight, setNewSlotWeight] = useState("100");
  const [newSlotNote, setNewSlotNote] = useState("");
  const [slotSaving, setSlotSaving] = useState(false);

  // 슬롯 아이템 중량 편집
  const [editingWeights, setEditingWeights] = useState<Record<string, string>>(
    {}
  );
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // ★ Phase 6: baseWeightG 인라인 편집
  const [editingBaseWeight, setEditingBaseWeight] = useState<Record<string, string>>({});
  const [savingBaseWeight, setSavingBaseWeight] = useState<string | null>(null);

  // ★ Phase 6: 슬롯 인라인 편집 (totalWeightG, note)
  const [editingSlot, setEditingSlot] = useState<Record<string, { totalWeightG?: string; note?: string }>>({});
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);

  // ★ Phase 6: 슬롯별 재료 추가
  const [addingItemSlotId, setAddingItemSlotId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<"MATERIAL" | "SEMI_PRODUCT">("MATERIAL");
  const [newItemId, setNewItemId] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("0");
  const [itemSaving, setItemSaving] = useState(false);

  // ★ Phase 6: BOM 복제 로딩
  const [duplicatingBomId, setDuplicatingBomId] = useState<string | null>(null);

  // ★ Phase 6: 용기 슬롯 라벨 캐시 (이슈 #6)
  const [slotLabelCache, setSlotLabelCache] = useState<
    Record<string, { slotIndex: number; label: string; volumeMl: number | null }[]>
  >({});

  // 옵션 상태
  const [materialOptions, setMaterialOptions] = useState<OptionItem[]>([]);
  const [semiProductOptions, setSemiProductOptions] = useState<OptionItem[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [containerGroupOptions, setContainerGroupOptions] = useState<
    { id: string; name: string; code: string }[]
  >([]);
  const [containerGroupsLoaded, setContainerGroupsLoaded] = useState(false);

  const [selectedGroupSlots, setSelectedGroupSlots] = useState<
    { slotIndex: number; label: string; volumeMl: number | null }[]
  >([]);

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);

  // ★ Phase 6: 슬롯 라벨 조회 함수
  const getSlotLabel = useCallback(
    (containerGroupId: string, slotIndex: number): string | null => {
      const slots = slotLabelCache[containerGroupId];
      if (!slots) return null;
      const match = slots.find((s) => s.slotIndex === slotIndex);
      return match?.label ?? null;
    },
    [slotLabelCache]
  );

  // ★ Phase 6: 용기 그룹별 슬롯 라벨 일괄 조회
  const loadSlotLabels = useCallback(
    async (groupIds: string[]) => {
      const uncached = groupIds.filter((id) => !slotLabelCache[id]);
      if (uncached.length === 0) return;

      const results = await Promise.allSettled(
        uncached.map((id) => getContainerGroupByIdAction(id))
      );

      const newCache: typeof slotLabelCache = {};
      results.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value.success && result.value.data) {
          newCache[uncached[idx]] = (
            result.value.data.slots as {
              slotIndex: number;
              label: string;
              volumeMl: number | null;
            }[]
          ).map((s) => ({
            slotIndex: s.slotIndex,
            label: s.label,
            volumeMl: s.volumeMl,
          }));
        }
      });

      if (Object.keys(newCache).length > 0) {
        setSlotLabelCache((prev) => ({ ...prev, ...newCache }));
      }
    },
    [slotLabelCache]
  );

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRecipeByIdAction(recipe.id);
      if (result.success && result.data) {
        setIngredients(
          result.data.ingredients as unknown as IngredientRow[]
        );
        const boms = result.data.recipeBoms as unknown as RecipeBOMRow[];
        setRecipeBoms(boms);

        // ★ Phase 6: BOM 슬롯의 용기 그룹 라벨 일괄 로드
        const groupIds = new Set<string>();
        boms.forEach((bom) =>
          bom.slots.forEach((slot) => groupIds.add(slot.containerGroup.id))
        );
        if (groupIds.size > 0) {
          loadSlotLabels(Array.from(groupIds));
        }
      } else {
        toast.error("레시피 상세 조회에 실패했습니다");
      }
    } catch (err) {
      logger.error("[loadDetail] 실패:", err);
      toast.error("레시피 상세 조회 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [recipe.id, loadSlotLabels]);

  // ★ loadOptions — limit: 100 (스키마 max 준수) + 다중 페이지 로딩 + toast 에러
  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [matResult, spResult, cgResult] = await Promise.all([
        loadAllPages<Record<string, unknown>>(getMaterialsAction, "name"),
        loadAllPages<Record<string, unknown>>(getSemiProductsAction, "name"),
        loadAllPages<Record<string, unknown>>(getContainerGroupsAction, "name"),
      ]);

      if (matResult.error) {
        logger.error("[loadOptions] 식자재 로딩 실패:", matResult.error);
        toast.error(`식자재 목록 로딩 실패: ${matResult.error}`);
      } else {
        logger.info(`[loadOptions] 식자재 ${matResult.items.length}건 로드`);
        setMaterialOptions(
          matResult.items.map((m) => ({
            id: m.id as string,
            name: m.name as string,
            code: m.code as string,
            unit: m.unit as string,
          }))
        );
      }

      if (spResult.error) {
        logger.error("[loadOptions] 반제품 로딩 실패:", spResult.error);
        toast.error(`반제품 목록 로딩 실패: ${spResult.error}`);
      } else {
        logger.info(`[loadOptions] 반제품 ${spResult.items.length}건 로드`);
        setSemiProductOptions(
          spResult.items.map((sp) => ({
            id: sp.id as string,
            name: sp.name as string,
            code: sp.code as string,
            unit: sp.unit as string,
          }))
        );
      }

      if (cgResult.error) {
        logger.error("[loadOptions] 용기 그룹 로딩 실패:", cgResult.error);
        toast.error(`용기 그룹 로딩 실패: ${cgResult.error}`);
        setContainerGroupsLoaded(false);
      } else {
        logger.info(`[loadOptions] 용기 그룹 ${cgResult.items.length}건 로드`);
        setContainerGroupOptions(
          cgResult.items.map((g) => ({
            id: g.id as string,
            name: g.name as string,
            code: g.code as string,
          }))
        );
        setContainerGroupsLoaded(true);
      }
    } catch (err) {
      logger.error("[loadOptions] 전체 로딩 실패:", err);
      toast.error("옵션 데이터를 불러오지 못했습니다. 새로고침해 주세요.");
      setContainerGroupsLoaded(false);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  // 용기그룹 선택 시 슬롯 목록 로딩
  const handleContainerGroupChange = async (groupId: string) => {
    setNewSlotContainerGroupId(groupId);
    setNewSlotIndex("");
    setNewSlotWeight("100");
    setSelectedGroupSlots([]);
    if (!groupId) return;
    try {
      const result = await getContainerGroupByIdAction(groupId);
      if (result.success && result.data) {
        const slots = (
          result.data.slots as {
            slotIndex: number;
            label: string;
            volumeMl: number | null;
          }[]
        ).map((s) => ({
          slotIndex: s.slotIndex,
          label: s.label,
          volumeMl: s.volumeMl,
        }));
        setSelectedGroupSlots(slots);
        // ★ Phase 6: 캐시에도 저장
        setSlotLabelCache((prev) => ({ ...prev, [groupId]: slots }));
        logger.info(
          `[handleContainerGroupChange] ${groupId}: 슬롯 ${slots.length}개 로드`
        );
      } else {
        toast.error("용기 그룹 슬롯 조회에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleContainerGroupChange] 슬롯 로딩 실패:", err);
      toast.error("용기 그룹 슬롯 로딩 중 오류가 발생했습니다");
    }
  };

  // fallback — API 실패 시 BOM 데이터에서 용기 그룹 추출
  useEffect(() => {
    if (containerGroupsLoaded) return;
    if (containerGroupOptions.length > 0) return;
    if (recipeBoms.length === 0) return;

    const groups: { id: string; name: string; code: string }[] = [];
    const seen = new Set<string>();
    recipeBoms.forEach((bom) =>
      bom.slots.forEach((slot) => {
        if (!seen.has(slot.containerGroup.id)) {
          seen.add(slot.containerGroup.id);
          groups.push(slot.containerGroup);
        }
      })
    );
    if (groups.length > 0) {
      logger.info(`[fallback] BOM에서 용기 그룹 ${groups.length}건 추출`);
      setContainerGroupOptions(groups);
    }
  }, [recipeBoms, containerGroupOptions.length, containerGroupsLoaded]);

  useEffect(() => {
    if (open) {
      loadDetail();
      loadOptions();
    } else {
      setShowIngredientForm(false);
      setAddingSlotBomId(null);
      setNewIngredientId("");
      setOptionsLoading(false);
      setEditingBaseWeight({});
      setEditingSlot({});
      setAddingItemSlotId(null);
    }
  }, [open, loadDetail, loadOptions]);

  // ── 재료 추가 (연속 모드 지원 — 이슈 #3) ──
  const handleAddIngredient = async () => {
    if (!newIngredientId) return;
    setIngredientSaving(true);
    try {
      const input: Record<string, unknown> = {
        ingredientType: newIngredientType,
        ...(newIngredientType === "MATERIAL"
          ? { materialMasterId: newIngredientId }
          : { semiProductId: newIngredientId }),
        sortOrder: ingredients.length,
      };
      const result = await addIngredientAction(recipe.id, input);
      if (result.success) {
        toast.success("재료가 추가되었습니다");
        setNewIngredientId("");
        if (!continuousMode) {
          setShowIngredientForm(false);
        }
        loadDetail();
        onUpdated();
      } else {
        toast.error(result.error?.message ?? "재료 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleAddIngredient] 실패:", err);
      toast.error("재료 추가 중 오류가 발생했습니다");
    } finally {
      setIngredientSaving(false);
    }
  };

  // ── 재료 삭제 ──
  const handleDeleteIngredient = async (id: string) => {
    try {
      const result = await deleteIngredientAction(id);
      if (result.success) {
        toast.success("재료가 삭제되었습니다");
        loadDetail();
        onUpdated();
      } else {
        toast.error(result.error?.message ?? "재료 삭제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleDeleteIngredient] 실패:", err);
      toast.error("재료 삭제 중 오류가 발생했습니다");
    }
  };

  // ── RecipeBOM 생성 ──
  const handleCreateRecipeBOM = async () => {
    try {
      const result = await createRecipeBOMWithAutoVersionAction({
        recipeId: recipe.id,
        baseWeightG: 0,
      });
      if (result.success) {
        toast.success("새 BOM 버전이 생성되었습니다");
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "BOM 생성에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleCreateRecipeBOM] 실패:", err);
      toast.error("BOM 생성 중 오류가 발생했습니다");
    }
  };

  // ★ Phase 6: RecipeBOM 복제
  const handleDuplicateBOM = async (bomId: string) => {
    setDuplicatingBomId(bomId);
    try {
      const result = await duplicateRecipeBOMAction(bomId);
      if (result.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newBom = result.data as any;
        toast.success(`BOM v${newBom?.version ?? "?"} 복제 완료 (초안)`);
        loadDetail();
        // 복제된 BOM으로 자동 확장
        if (newBom?.id) {
          setExpandedBom(newBom.id);
        }
      } else {
        toast.error(result.error?.message ?? "BOM 복제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleDuplicateBOM] 실패:", err);
      toast.error("BOM 복제 중 오류가 발생했습니다");
    } finally {
      setDuplicatingBomId(null);
    }
  };

  // ── RecipeBOM 상태 변경 ──
  const handleBOMStatus = async (bomId: string, status: string) => {
    try {
      const result = await updateRecipeBOMStatusAction(bomId, { status });
      if (result.success) {
        const label = BOM_STATUS_LABELS[status] ?? status;
        toast.success(`BOM 상태가 '${label}'(으)로 변경되었습니다`);
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "상태 변경에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleBOMStatus] 실패:", err);
      toast.error("BOM 상태 변경 중 오류가 발생했습니다");
    }
  };

  // ── RecipeBOM 삭제 ──
  const handleDeleteBOM = async (bomId: string) => {
    try {
      const result = await deleteRecipeBOMAction(bomId);
      if (result.success) {
        toast.success("BOM이 삭제되었습니다");
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "BOM 삭제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleDeleteBOM] 실패:", err);
      toast.error("BOM 삭제 중 오류가 발생했습니다");
    }
  };

  // ★ Phase 6: baseWeightG 저장
  const handleSaveBaseWeight = async (bomId: string) => {
    const weightStr = editingBaseWeight[bomId];
    if (weightStr === undefined) return;
    const weight = parseFloat(weightStr);
    if (isNaN(weight) || weight < 0) {
      toast.error("올바른 기준 중량을 입력해 주세요");
      return;
    }
    setSavingBaseWeight(bomId);
    try {
      const result = await updateRecipeBOMBaseWeightAction(bomId, {
        baseWeightG: weight,
      });
      if (result.success) {
        toast.success("기준 중량이 저장되었습니다");
        setEditingBaseWeight((prev) => {
          const next = { ...prev };
          delete next[bomId];
          return next;
        });
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "기준 중량 저장에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleSaveBaseWeight] 실패:", err);
      toast.error("기준 중량 저장 중 오류가 발생했습니다");
    } finally {
      setSavingBaseWeight(null);
    }
  };

  // ★ Phase 6: 슬롯 인라인 편집 저장
  const handleSaveSlot = async (slotId: string) => {
    const edits = editingSlot[slotId];
    if (!edits) return;
    const input: Record<string, unknown> = {};
    if (edits.totalWeightG !== undefined) {
      const w = parseFloat(edits.totalWeightG);
      if (isNaN(w) || w < 0) {
        toast.error("올바른 중량 값을 입력해 주세요");
        return;
      }
      input.totalWeightG = w;
    }
    if (edits.note !== undefined) {
      input.note = edits.note || undefined;
    }
    if (Object.keys(input).length === 0) return;

    setSavingSlotId(slotId);
    try {
      const result = await updateRecipeBOMSlotAction(slotId, input);
      if (result.success) {
        toast.success("슬롯 정보가 저장되었습니다");
        setEditingSlot((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "슬롯 수정에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleSaveSlot] 실패:", err);
      toast.error("슬롯 수정 중 오류가 발생했습니다");
    } finally {
      setSavingSlotId(null);
    }
  };

  // ── 슬롯 추가 (구성재료 자동 할당) ──
  const handleAddSlot = async (bomId: string) => {
    if (!newSlotContainerGroupId) return;
    setSlotSaving(true);
    try {
      const result = await addRecipeBOMSlotAction(bomId, {
        containerGroupId: newSlotContainerGroupId,
        slotIndex: parseInt(newSlotIndex) || 0,
        totalWeightG: parseFloat(newSlotWeight) || 0,
        note: newSlotNote || undefined,
        sortOrder: 0,
      });
      if (result.success) {
        toast.success("슬롯이 추가되었습니다 (구성재료 자동 할당)");
        setAddingSlotBomId(null);
        setNewSlotContainerGroupId("");
        setNewSlotIndex("0");
        setNewSlotWeight("100");
        setNewSlotNote("");
        setSelectedGroupSlots([]);
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "슬롯 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleAddSlot] 실패:", err);
      toast.error("슬롯 추가 중 오류가 발생했습니다");
    } finally {
      setSlotSaving(false);
    }
  };

  // ── 슬롯 삭제 ──
  const handleDeleteSlot = async (slotId: string) => {
    try {
      const result = await deleteRecipeBOMSlotAction(slotId);
      if (result.success) {
        toast.success("슬롯이 삭제되었습니다");
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "슬롯 삭제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleDeleteSlot] 실패:", err);
      toast.error("슬롯 삭제 중 오류가 발생했습니다");
    }
  };

  // ── 슬롯 아이템 중량 저장 ──
  const handleSaveItemWeight = async (itemId: string) => {
    const weightStr = editingWeights[itemId];
    if (!weightStr) return;
    const weight = parseFloat(weightStr);
    if (isNaN(weight) || weight < 0) {
      toast.error("올바른 중량 값을 입력해 주세요");
      return;
    }
    setSavingItemId(itemId);
    try {
      const result = await updateRecipeBOMSlotItemAction(itemId, {
        weightG: weight,
      });
      if (result.success) {
        toast.success("중량이 저장되었습니다");
        setEditingWeights((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "중량 저장에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleSaveItemWeight] 실패:", err);
      toast.error("중량 저장 중 오류가 발생했습니다");
    } finally {
      setSavingItemId(null);
    }
  };

  // ★ Phase 6: 슬롯별 재료 추가
  const handleAddSlotItem = async (slotId: string) => {
    if (!newItemId) return;
    setItemSaving(true);
    try {
      const input: Record<string, unknown> = {
        ingredientType: newItemType,
        ...(newItemType === "MATERIAL"
          ? { materialMasterId: newItemId }
          : { semiProductId: newItemId }),
        weightG: parseFloat(newItemWeight) || 0,
        unit: "g",
        sortOrder: 999,
      };
      const result = await addRecipeBOMSlotItemAction(slotId, input);
      if (result.success) {
        toast.success("재료가 슬롯에 추가되었습니다");
        setNewItemId("");
        setNewItemWeight("0");
        setAddingItemSlotId(null);
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "재료 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleAddSlotItem] 실패:", err);
      toast.error("재료 추가 중 오류가 발생했습니다");
    } finally {
      setItemSaving(false);
    }
  };

  // ── 슬롯 아이템 삭제 (제외) ──
  const handleDeleteSlotItem = async (itemId: string) => {
    try {
      const result = await deleteRecipeBOMSlotItemAction(itemId);
      if (result.success) {
        toast.success("아이템이 제외되었습니다");
        loadDetail();
      } else {
        toast.error(result.error?.message ?? "아이템 삭제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[handleDeleteSlotItem] 실패:", err);
      toast.error("아이템 삭제 중 오류가 발생했습니다");
    }
  };

  // ── 삭제 확인 처리 ──
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === "ingredient") await handleDeleteIngredient(id);
    else if (type === "bom") await handleDeleteBOM(id);
    else if (type === "slot") await handleDeleteSlot(id);
    else if (type === "slotItem") await handleDeleteSlotItem(id);
    setDeleteConfirm(null);
  };

  // ══════════════════════════════════════
  // ★ Phase 6: 슬롯별 중량 합계 계산
  // ══════════════════════════════════════
  const calcSlotWeightSum = (items: RecipeBOMSlotItemRow[]) =>
    items.reduce((sum, item) => sum + item.weightG, 0);

  // ══════════════════════════════════════
  // 기본정보 탭 (조회 전용) — 이슈 #7: 배식 구성 섹션 추가
  // ══════════════════════════════════════
  const renderInfoTab = () => {
    if (isEditing) {
      return (
        <RecipeForm
          recipe={recipe}
          onBack={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onUpdated();
          }}
          compact
        />
      );
    }

    const activeBom = recipeBoms.find((b) => b.status === "ACTIVE");

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            수정
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">레시피 코드</p>
            <p className="font-mono font-medium">{recipe.code}</p>
          </div>
          <div>
            <p className="text-gray-500">레시피명</p>
            <p className="font-medium">{recipe.name}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">설명</p>
            <p>{recipe.description || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">재료 수</p>
            <p className="font-medium">{ingredients.length}개</p>
          </div>
          <div>
            <p className="text-gray-500">BOM 버전 수</p>
            <p className="font-medium">{recipeBoms.length}개</p>
          </div>
          <div>
            <p className="text-gray-500">등록일</p>
            <p>{new Date(recipe.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
        </div>

        {/* 구성 재료 */}
        {ingredients.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">구성 재료</h3>
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">구분</TableHead>
                    <TableHead className="text-xs">재료명</TableHead>
                    <TableHead className="text-xs">코드</TableHead>
                    <TableHead className="text-xs">단위</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="text-xs">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-xs ${
                            ing.ingredientType === "MATERIAL"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {ing.ingredientType === "MATERIAL"
                            ? "식자재"
                            : "반제품"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {ing.materialMaster?.name ??
                          ing.semiProduct?.name ??
                          "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {ing.materialMaster?.code ??
                          ing.semiProduct?.code ??
                          "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {ing.materialMaster?.unit ??
                          ing.semiProduct?.unit ??
                          "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ★ Phase 6 / 이슈 #7: 배식 구성 섹션 */}
        {activeBom && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">
              배식 구성 (사용중 BOM v{activeBom.version})
            </h3>
            <div className="text-xs text-gray-500 mb-2">
              기준 중량: <span className="font-mono font-medium">{activeBom.baseWeightG}g</span>
              {" · "}적용일: {formatDate(activeBom.activatedAt)}
            </div>
            {activeBom.slots.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">슬롯이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {activeBom.slots.map((slot) => {
                  const slotLabel = getSlotLabel(
                    slot.containerGroup.id,
                    slot.slotIndex
                  );
                  const weightSum = calcSlotWeightSum(slot.items);
                  return (
                    <div
                      key={slot.id}
                      className="rounded border p-3 bg-gray-50/50"
                    >
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-medium">
                          {slot.containerGroup.name}
                        </span>
                        <span className="text-gray-400">
                          {slotLabel
                            ? `${slotLabel} (#${slot.slotIndex})`
                            : `Slot ${slot.slotIndex}`}
                        </span>
                        <span className="ml-auto font-mono text-blue-700 text-xs">
                          {weightSum}g / {slot.totalWeightG}g
                        </span>
                      </div>
                      {slot.items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {slot.items.map((item) => (
                            <span
                              key={item.id}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                                item.ingredientType === "MATERIAL"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-purple-50 text-purple-700"
                              }`}
                            >
                              {item.materialMaster?.name ??
                                item.semiProduct?.name ??
                                "-"}
                              <span className="font-mono">{item.weightG}g</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {slot.note && (
                        <p className="text-xs text-gray-400 mt-1">
                          {slot.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!activeBom && recipeBoms.length > 0 && (
          <div className="rounded border border-orange-200 bg-orange-50/50 p-3">
            <p className="text-sm text-orange-700">
              사용중인 BOM이 없습니다. &quot;재료 / BOM 편집&quot; 탭에서 BOM을 확정해 주세요.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════
  // 재료 / BOM 탭 (편집)
  // ══════════════════════════════════════
  const renderIngredientsTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* ── 재료 편집 섹션 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">재료 관리</h3>
            {!showIngredientForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowIngredientForm(true);
                  setNewIngredientId("");
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                재료 추가
              </Button>
            )}
          </div>

          {showIngredientForm && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              {optionsLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  식자재/반제품 목록 로딩 중...
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {/* 재료 타입 선택 */}
                <div className="space-y-1">
                  <Label className="text-xs">재료 타입</Label>
                  <Select
                    value={newIngredientType}
                    onValueChange={(v) => {
                      setNewIngredientType(v as "MATERIAL" | "SEMI_PRODUCT");
                      setNewIngredientId("");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MATERIAL">식자재</SelectItem>
                      <SelectItem value="SEMI_PRODUCT">반제품</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ★ Phase 6 / 이슈 #4: Combobox 전환 */}
                <div className="space-y-1">
                  <Label className="text-xs">
                    {newIngredientType === "MATERIAL" ? "식자재" : "반제품"} 선택
                    <span className="ml-1 text-gray-400">
                      ({newIngredientType === "MATERIAL"
                        ? materialOptions.length
                        : semiProductOptions.length}건)
                    </span>
                  </Label>
                  <IngredientCombobox
                    options={
                      newIngredientType === "MATERIAL"
                        ? materialOptions
                        : semiProductOptions
                    }
                    value={newIngredientId}
                    onChange={setNewIngredientId}
                    placeholder={
                      optionsLoading
                        ? "로딩 중..."
                        : "검색하여 선택..."
                    }
                    emptyText={
                      newIngredientType === "MATERIAL"
                        ? "자재 관리에서 식자재를 먼저 등록해 주세요"
                        : "반제품을 먼저 등록해 주세요"
                    }
                    disabled={optionsLoading}
                  />
                </div>
              </div>
              {/* ★ Phase 6 / 이슈 #3: 연속 추가 모드 */}
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddIngredient}
                    disabled={ingredientSaving || !newIngredientId}
                  >
                    {ingredientSaving && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    추가
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowIngredientForm(false);
                      setNewIngredientId("");
                    }}
                  >
                    완료
                  </Button>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={continuousMode}
                    onChange={(e) => setContinuousMode(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  연속 추가 모드
                </label>
              </div>
            </div>
          )}

          {ingredients.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              등록된 재료가 없습니다.
            </p>
          ) : (
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">구분</TableHead>
                    <TableHead className="text-xs">재료명</TableHead>
                    <TableHead className="text-xs">코드</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="text-xs">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-xs ${
                            ing.ingredientType === "MATERIAL"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {ing.ingredientType === "MATERIAL"
                            ? "식자재"
                            : "반제품"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {ing.materialMaster?.name ??
                          ing.semiProduct?.name ??
                          "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {ing.materialMaster?.code ??
                          ing.semiProduct?.code ??
                          "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setDeleteConfirm({
                              type: "ingredient",
                              id: ing.id,
                              name:
                                ing.materialMaster?.name ??
                                ing.semiProduct?.name ??
                                "",
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
            </div>
          )}
        </div>

        {/* ── RecipeBOM 섹션 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              레시피 BOM (배식 중량)
            </h3>
            <Button size="sm" variant="outline" onClick={handleCreateRecipeBOM}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              새 BOM 버전
            </Button>
          </div>

          {recipeBoms.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              BOM이 없습니다.
            </p>
          ) : (
            recipeBoms.map((bom) => {
              const isExpanded = expandedBom === bom.id;
              const isEditingBW = editingBaseWeight[bom.id] !== undefined;
              return (
                <div key={bom.id} className="rounded-md border">
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50"
                    onClick={() =>
                      setExpandedBom(isExpanded ? null : bom.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{bom.version}</span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              BOM_STATUS_STYLES[bom.status] ?? "bg-gray-100"
                            }`}
                          >
                            {BOM_STATUS_LABELS[bom.status] ?? bom.status}
                          </span>
                          {/* ★ Phase 6: baseWeightG 표시 */}
                          <span className="text-xs text-gray-400 font-mono">
                            기준: {bom.baseWeightG}g
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>생성: {formatDate(bom.createdAt)}</span>
                          <span>적용: {formatDate(bom.activatedAt)}</span>
                          <span>수정: {formatDate(bom.updatedAt)}</span>
                          <span>슬롯 {bom.slots.length}개</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* ★ Phase 6: 복제 버튼 — 모든 상태에서 표시 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-blue-600"
                        onClick={() => handleDuplicateBOM(bom.id)}
                        disabled={duplicatingBomId === bom.id}
                      >
                        {duplicatingBomId === bom.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Copy className="mr-1 h-3 w-3" />
                        )}
                        복제
                      </Button>

                      {bom.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-green-600"
                          onClick={() => handleBOMStatus(bom.id, "ACTIVE")}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          확정
                        </Button>
                      )}

                      {/* ★ Phase 6: ACTIVE BOM에 보관 버튼 추가 */}
                      {bom.status === "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-orange-600"
                          onClick={() => handleBOMStatus(bom.id, "ARCHIVED")}
                        >
                          <Archive className="mr-1 h-3 w-3" />
                          보관
                        </Button>
                      )}

                      {bom.status === "ARCHIVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-green-600"
                          onClick={() => handleBOMStatus(bom.id, "ACTIVE")}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          복원
                        </Button>
                      )}

                      {bom.status !== "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setDeleteConfirm({
                              type: "bom",
                              id: bom.id,
                              name: `v${bom.version}`,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {/* ★ Phase 6: ARCHIVED일 때 baseWeightG 인라인 편집 */}
                      {bom.status !== "ARCHIVED" && (
                        <div className="flex items-center gap-3 pb-2 border-b">
                          <Label className="text-xs whitespace-nowrap">기준 중량(g):</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="h-7 w-28 text-xs"
                            value={
                              isEditingBW
                                ? editingBaseWeight[bom.id]
                                : String(bom.baseWeightG)
                            }
                            onChange={(e) =>
                              setEditingBaseWeight((prev) => ({
                                ...prev,
                                [bom.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveBaseWeight(bom.id);
                            }}
                          />
                          {isEditingBW && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleSaveBaseWeight(bom.id)}
                              disabled={savingBaseWeight === bom.id}
                            >
                              {savingBaseWeight === bom.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3 text-green-600" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {bom.slots.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-2">
                          슬롯이 없습니다. 슬롯을 추가하면 구성재료가 자동으로
                          할당됩니다.
                        </p>
                      ) : (
                        bom.slots.map((slot) => {
                          const slotLabel = getSlotLabel(
                            slot.containerGroup.id,
                            slot.slotIndex
                          );
                          const weightSum = calcSlotWeightSum(slot.items);
                          const slotEdits = editingSlot[slot.id];
                          const isEditingSlotFields = !!slotEdits;

                          return (
                            <div
                              key={slot.id}
                              className="rounded border bg-gray-50/50 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium">
                                    {slot.containerGroup.name}
                                  </span>
                                  {/* ★ Phase 6 / 이슈 #6: 실제 슬롯 라벨 표시 */}
                                  <span className="text-gray-400">
                                    {slotLabel
                                      ? `${slotLabel} (#${slot.slotIndex})`
                                      : `Slot ${slot.slotIndex}`}
                                  </span>
                                  {/* ★ Phase 6: 중량 합계 / 총 중량 표시 */}
                                  <span
                                    className={cn(
                                      "font-mono text-xs",
                                      weightSum > slot.totalWeightG && slot.totalWeightG > 0
                                        ? "text-red-600"
                                        : "text-blue-700"
                                    )}
                                  >
                                    {weightSum}g / {slot.totalWeightG}g
                                  </span>
                                  {slot.note && (
                                    <span className="text-xs text-gray-400">
                                      ({slot.note})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {/* ★ Phase 6: 슬롯 인라인 편집 저장 버튼 */}
                                  {isEditingSlotFields && bom.status !== "ARCHIVED" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleSaveSlot(slot.id)}
                                      disabled={savingSlotId === slot.id}
                                    >
                                      {savingSlotId === slot.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Save className="h-3 w-3 text-green-600" />
                                      )}
                                    </Button>
                                  )}
                                  {bom.status === "DRAFT" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          type: "slot",
                                          id: slot.id,
                                          name: slot.containerGroup.name,
                                        })
                                      }
                                    >
                                      <Trash2 className="h-3 w-3 text-red-400" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* ★ Phase 6-b: DRAFT+ACTIVE 슬롯 인라인 편집 (totalWeightG, note) */}
                              {bom.status !== "ARCHIVED" && (
                                <div className="flex items-center gap-3 text-xs">
                                  <Label className="whitespace-nowrap text-gray-500">총 중량(g):</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="h-6 w-20 text-xs"
                                    value={
                                      slotEdits?.totalWeightG !== undefined
                                        ? slotEdits.totalWeightG
                                        : String(slot.totalWeightG)
                                    }
                                    onChange={(e) =>
                                      setEditingSlot((prev) => ({
                                        ...prev,
                                        [slot.id]: {
                                          ...prev[slot.id],
                                          totalWeightG: e.target.value,
                                        },
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveSlot(slot.id);
                                    }}
                                  />
                                  <Label className="whitespace-nowrap text-gray-500">메모:</Label>
                                  <Input
                                    className="h-6 flex-1 text-xs"
                                    placeholder="메모"
                                    value={
                                      slotEdits?.note !== undefined
                                        ? slotEdits.note
                                        : slot.note ?? ""
                                    }
                                    onChange={(e) =>
                                      setEditingSlot((prev) => ({
                                        ...prev,
                                        [slot.id]: {
                                          ...prev[slot.id],
                                          note: e.target.value,
                                        },
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveSlot(slot.id);
                                    }}
                                  />
                                </div>
                              )}

                              {slot.items.length > 0 && (
                                <div className="rounded border bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">
                                          구분
                                        </TableHead>
                                        <TableHead className="text-xs">
                                          재료명
                                        </TableHead>
                                        <TableHead className="text-xs text-right">
                                          중량(g)
                                        </TableHead>
                                        {bom.status !== "ARCHIVED" && (
                                          <TableHead className="w-[80px] text-xs">
                                            작업
                                          </TableHead>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {slot.items.map((item) => {
                                        const isEditingWeight =
                                          editingWeights[item.id] !== undefined;
                                        return (
                                          <TableRow key={item.id}>
                                            <TableCell className="text-xs">
                                              <span
                                                className={`inline-flex rounded px-1 py-0.5 ${
                                                  item.ingredientType ===
                                                  "MATERIAL"
                                                    ? "bg-blue-50 text-blue-600"
                                                    : "bg-purple-50 text-purple-600"
                                                }`}
                                              >
                                                {item.ingredientType ===
                                                "MATERIAL"
                                                  ? "자재"
                                                  : "반제품"}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">
                                              {item.materialMaster?.name ??
                                                item.semiProduct?.name ??
                                                "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {bom.status !== "ARCHIVED" ? (
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step="any"
                                                  className="h-7 w-20 text-xs text-right ml-auto"
                                                  value={
                                                    isEditingWeight
                                                      ? editingWeights[item.id]
                                                      : String(item.weightG)
                                                  }
                                                  onChange={(e) =>
                                                    setEditingWeights((prev) => ({
                                                      ...prev,
                                                      [item.id]: e.target.value,
                                                    }))
                                                  }
                                                  onBlur={() => {
                                                    if (
                                                      isEditingWeight &&
                                                      editingWeights[item.id] !==
                                                        String(item.weightG)
                                                    ) {
                                                      handleSaveItemWeight(
                                                        item.id
                                                      );
                                                    }
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                      handleSaveItemWeight(
                                                        item.id
                                                      );
                                                  }}
                                                />
                                              ) : (
                                                <span className="text-xs font-mono">
                                                  {item.weightG}g
                                                </span>
                                              )}
                                            </TableCell>
                                            {bom.status !== "ARCHIVED" && (
                                              <TableCell>
                                                <div className="flex items-center gap-1">
                                                  {isEditingWeight && (
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-6 w-6"
                                                      onClick={() =>
                                                        handleSaveItemWeight(
                                                          item.id
                                                        )
                                                      }
                                                      disabled={
                                                        savingItemId === item.id
                                                      }
                                                    >
                                                      {savingItemId ===
                                                      item.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        <Save className="h-3 w-3 text-green-600" />
                                                      )}
                                                    </Button>
                                                  )}
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() =>
                                                      setDeleteConfirm({
                                                        type: "slotItem",
                                                        id: item.id,
                                                        name:
                                                          item.materialMaster
                                                            ?.name ??
                                                          item.semiProduct
                                                            ?.name ??
                                                          "",
                                                      })
                                                    }
                                                  >
                                                    <Trash2 className="h-3 w-3 text-red-400" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            )}
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}

                              {/* ★ Phase 6-b: 슬롯별 재료 추가 버튼 (DRAFT+ACTIVE) */}
                              {bom.status !== "ARCHIVED" && (
                                <>
                                  {addingItemSlotId === slot.id ? (
                                    <div className="rounded border border-dashed border-blue-300 bg-blue-50/30 p-2 space-y-2">
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">타입</Label>
                                          <Select
                                            value={newItemType}
                                            onValueChange={(v) => {
                                              setNewItemType(v as "MATERIAL" | "SEMI_PRODUCT");
                                              setNewItemId("");
                                            }}
                                          >
                                            <SelectTrigger className="h-7 text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="MATERIAL">식자재</SelectItem>
                                              <SelectItem value="SEMI_PRODUCT">반제품</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">재료</Label>
                                          <IngredientCombobox
                                            options={
                                              newItemType === "MATERIAL"
                                                ? materialOptions
                                                : semiProductOptions
                                            }
                                            value={newItemId}
                                            onChange={setNewItemId}
                                            placeholder="선택..."
                                            emptyText="등록된 항목이 없습니다"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">중량(g)</Label>
                                          <Input
                                            type="number"
                                            min={0}
                                            step="any"
                                            className="h-8 text-xs"
                                            value={newItemWeight}
                                            onChange={(e) =>
                                              setNewItemWeight(e.target.value)
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="h-6 text-xs"
                                          onClick={() => handleAddSlotItem(slot.id)}
                                          disabled={itemSaving || !newItemId}
                                        >
                                          {itemSaving ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            "추가"
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs"
                                          onClick={() => {
                                            setAddingItemSlotId(null);
                                            setNewItemId("");
                                            setNewItemWeight("0");
                                          }}
                                        >
                                          취소
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-blue-600"
                                      onClick={() => {
                                        setAddingItemSlotId(slot.id);
                                        setNewItemId("");
                                        setNewItemWeight("0");
                                      }}
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      재료 추가
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })
                      )}

                      {bom.status === "DRAFT" && (
                        <>
                          {addingSlotBomId === bom.id ? (
                            <div className="rounded border border-dashed border-green-300 bg-green-50/30 p-3 space-y-3">
                              <p className="text-xs text-gray-500">
                                슬롯 추가 시 해당 레시피의 전체 구성재료가
                                자동으로 할당됩니다.
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                {/* 용기 그룹 선택 */}
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    용기 그룹
                                    <span className="ml-1 text-gray-400">
                                      ({containerGroupOptions.length}건)
                                    </span>
                                  </Label>
                                  <Select
                                    value={newSlotContainerGroupId}
                                    onValueChange={
                                      handleContainerGroupChange
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue
                                        placeholder={
                                          containerGroupOptions.length === 0
                                            ? "용기 그룹을 먼저 등록해 주세요"
                                            : "용기 그룹 선택"
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {containerGroupOptions.length === 0 ? (
                                        <div className="px-2 py-3 text-center text-xs text-gray-400">
                                          용기 관리 페이지에서 먼저 등록해
                                          주세요
                                        </div>
                                      ) : (
                                        containerGroupOptions.map((g) => (
                                          <SelectItem
                                            key={g.id}
                                            value={g.id}
                                          >
                                            {g.name} ({g.code})
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* 슬롯 선택 */}
                                <div className="space-y-1">
                                  <Label className="text-xs">슬롯 (칸)</Label>
                                  {selectedGroupSlots.length > 0 ? (
                                    <Select
                                      value={newSlotIndex}
                                      onValueChange={(v) => {
                                        setNewSlotIndex(v);
                                        const slot = selectedGroupSlots.find(
                                          (s) => String(s.slotIndex) === v
                                        );
                                        if (slot?.volumeMl) {
                                          setNewSlotWeight(
                                            String(slot.volumeMl)
                                          );
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="슬롯 선택" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {selectedGroupSlots.map((s) => (
                                          <SelectItem
                                            key={s.slotIndex}
                                            value={String(s.slotIndex)}
                                          >
                                            {s.label} (#{s.slotIndex}
                                            {s.volumeMl
                                              ? `, ${s.volumeMl}ml`
                                              : ""}
                                            )
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      type="number"
                                      placeholder={
                                        newSlotContainerGroupId
                                          ? "해당 그룹에 슬롯이 없습니다"
                                          : "용기 그룹을 먼저 선택하세요"
                                      }
                                      className="h-8 text-xs"
                                      value={newSlotIndex}
                                      onChange={(e) =>
                                        setNewSlotIndex(e.target.value)
                                      }
                                    />
                                  )}
                                </div>

                                {/* 총 중량 */}
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    총 중량(g) — 선택
                                  </Label>
                                  <Input
                                    type="number"
                                    placeholder="0 (미입력 가능)"
                                    className="h-8 text-xs"
                                    value={newSlotWeight}
                                    onChange={(e) =>
                                      setNewSlotWeight(e.target.value)
                                    }
                                  />
                                </div>

                                {/* 메모 */}
                                <div className="space-y-1">
                                  <Label className="text-xs">메모 (선택)</Label>
                                  <Input
                                    placeholder="메모"
                                    className="h-8 text-xs"
                                    value={newSlotNote}
                                    onChange={(e) =>
                                      setNewSlotNote(e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleAddSlot(bom.id)}
                                  disabled={
                                    slotSaving || !newSlotContainerGroupId
                                  }
                                >
                                  {slotSaving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "추가"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setAddingSlotBomId(null);
                                    setSelectedGroupSlots([]);
                                    setNewSlotContainerGroupId("");
                                  }}
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-green-600"
                              onClick={() => setAddingSlotBomId(bom.id)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              슬롯 추가 (구성재료 자동 할당)
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{recipe.name}</span>
              <span className="text-sm font-mono text-gray-400">
                {recipe.code}
              </span>
            </DialogTitle>
            <DialogDescription>
              레시피 상세 정보 및 BOM 관리
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">
                기본정보 (조회)
              </TabsTrigger>
              <TabsTrigger value="ingredients" className="flex-1">
                재료 / BOM 편집 ({ingredients.length} / {recipeBoms.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              {renderInfoTab()}
            </TabsContent>
            <TabsContent value="ingredients" className="mt-4">
              {renderIngredientsTab()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteConfirm?.name}&apos;을(를) 삭제하시겠습니까?
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
    </>
  );
}
