"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
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
import { RecipeForm } from "./recipe-form";
import {
  getRecipeByIdAction,
  addIngredientAction,
  deleteIngredientAction,
  createRecipeBOMWithAutoVersionAction,
  updateRecipeBOMStatusAction,
  deleteRecipeBOMAction,
  addRecipeBOMSlotAction,
  deleteRecipeBOMSlotAction,
  updateRecipeBOMSlotItemAction,
  deleteRecipeBOMSlotItemAction,
} from "../actions/recipe.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
// ★ 추가: 용기 그룹 API
import { getContainerGroupsAction } from "@/features/container/actions/container.action";
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  AlertTriangle,
  Save,
} from "lucide-react";
import type { RecipeRow } from "./recipe-list";

// ── 타입 정의 ──

type IngredientRow = {
  id: string;
  ingredientType: string;
  sortOrder: number;
  materialMaster: { id: string; name: string; code: string; unit: string } | null;
  semiProduct: { id: string; name: string; code: string; unit: string } | null;
};

type RecipeBOMSlotItemRow = {
  id: string;
  ingredientType: string;
  weightG: number;
  unit: string;
  sortOrder: number;
  materialMaster: { id: string; name: string; code: string; unit: string } | null;
  semiProduct: { id: string; name: string; code: string; unit: string } | null;
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

export function RecipeDetailDialog({ recipe, open, onOpenChange, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [recipeBoms, setRecipeBoms] = useState<RecipeBOMRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBom, setExpandedBom] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 재료 추가 폼
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [newIngredientType, setNewIngredientType] = useState<"MATERIAL" | "SEMI_PRODUCT">("MATERIAL");
  const [newIngredientId, setNewIngredientId] = useState("");
  const [ingredientSaving, setIngredientSaving] = useState(false);

  // 슬롯 추가 폼
  const [addingSlotBomId, setAddingSlotBomId] = useState<string | null>(null);
  const [newSlotContainerGroupId, setNewSlotContainerGroupId] = useState("");
  const [newSlotIndex, setNewSlotIndex] = useState("0");
  const [newSlotWeight, setNewSlotWeight] = useState("100");
  const [newSlotNote, setNewSlotNote] = useState("");
  const [slotSaving, setSlotSaving] = useState(false);

  // 슬롯 아이템 중량 편집
  const [editingWeights, setEditingWeights] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // 옵션 데이터
  const [materialOptions, setMaterialOptions] = useState<{ id: string; name: string; code: string; unit: string }[]>([]);
  const [containerGroupOptions, setContainerGroupOptions] = useState<{ id: string; name: string; code: string }[]>([]);

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRecipeByIdAction(recipe.id);
      if (result.success && result.data) {
        setIngredients(result.data.ingredients as unknown as IngredientRow[]);
        setRecipeBoms(result.data.recipeBoms as unknown as RecipeBOMRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [recipe.id]);

  // ★ 변경: 용기 그룹을 별도 API에서 로딩
  const loadOptions = useCallback(async () => {
    const matResult = await getMaterialsAction({ page: 1, limit: 200, sortBy: "name", sortOrder: "asc" });
    if (matResult.success) {
      setMaterialOptions(
        matResult.data.items.map((m) => ({ id: m.id, name: m.name, code: m.code, unit: m.unit }))
      );
    }
    // 용기 그룹 로딩
    try {
      const cgResult = await getContainerGroupsAction({ page: 1, limit: 200, sortBy: "name", sortOrder: "asc" });
      if (cgResult.success) {
        setContainerGroupOptions(
          cgResult.data.items.map((g) => ({ id: g.id, name: g.name, code: g.code }))
        );
      }
    } catch {
      // API 실패 시 BOM 데이터에서 추출 (아래 useEffect fallback)
    }
  }, []);

  // ★ fallback: API에서 못 가져오면 BOM 데이터에서 추출
  useEffect(() => {
    if (containerGroupOptions.length > 0) return; // 이미 API에서 로딩됨
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
    if (groups.length > 0) setContainerGroupOptions(groups);
  }, [recipeBoms, containerGroupOptions.length]);

  useEffect(() => {
    if (open) {
      loadDetail();
      loadOptions();
    }
  }, [open, loadDetail, loadOptions]);

  // 에러 메시지 자동 숨김
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // ── 재료 추가 ──
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
        setNewIngredientId("");
        setShowIngredientForm(false);
        loadDetail();
        onUpdated();
      }
    } finally {
      setIngredientSaving(false);
    }
  };

  // ── 재료 삭제 ──
  const handleDeleteIngredient = async (id: string) => {
    const result = await deleteIngredientAction(id);
    if (result.success) {
      loadDetail();
      onUpdated();
    }
  };

  // ── RecipeBOM 생성 ──
  // ★ 변경: 에러 표시 추가
  const handleCreateRecipeBOM = async () => {
    setErrorMessage(null);
    const result = await createRecipeBOMWithAutoVersionAction({
      recipeId: recipe.id,
      baseWeightG: 0,
    });
    if (result.success) {
      loadDetail();
    } else {
      setErrorMessage(result.error?.message ?? "BOM 생성에 실패했습니다");
    }
  };

  // ── RecipeBOM 상태 변경 ──
  const handleBOMStatus = async (bomId: string, status: string) => {
    setErrorMessage(null);
    const result = await updateRecipeBOMStatusAction(bomId, { status });
    if (result.success) {
      loadDetail();
    } else {
      setErrorMessage(result.error.message);
    }
  };

  // ── RecipeBOM 삭제 ──
  const handleDeleteBOM = async (bomId: string) => {
    setErrorMessage(null);
    const result = await deleteRecipeBOMAction(bomId);
    if (result.success) {
      loadDetail();
    } else {
      setErrorMessage(result.error.message);
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
        totalWeightG: parseFloat(newSlotWeight) || 100,
        note: newSlotNote || undefined,
        sortOrder: 0,
      });
      if (result.success) {
        setAddingSlotBomId(null);
        setNewSlotContainerGroupId("");
        setNewSlotIndex("0");
        setNewSlotWeight("100");
        setNewSlotNote("");
        loadDetail();
      }
    } finally {
      setSlotSaving(false);
    }
  };

  // ── 슬롯 삭제 ──
  const handleDeleteSlot = async (slotId: string) => {
    const result = await deleteRecipeBOMSlotAction(slotId);
    if (result.success) loadDetail();
  };

  // ── 슬롯 아이템 중량 저장 ──
  const handleSaveItemWeight = async (itemId: string) => {
    const weightStr = editingWeights[itemId];
    if (!weightStr) return;
    const weight = parseFloat(weightStr);
    if (isNaN(weight) || weight < 0) return;
    setSavingItemId(itemId);
    try {
      const result = await updateRecipeBOMSlotItemAction(itemId, { weightG: weight });
      if (result.success) {
        setEditingWeights((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        loadDetail();
      }
    } finally {
      setSavingItemId(null);
    }
  };

  // ── 슬롯 아이템 삭제 (제외) ──
  const handleDeleteSlotItem = async (itemId: string) => {
    const result = await deleteRecipeBOMSlotItemAction(itemId);
    if (result.success) loadDetail();
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
  // 기본정보 탭 (조회 전용)
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

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
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
            <p className="text-gray-500">등록일</p>
            <p>{new Date(recipe.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
        </div>

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
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${
                          ing.ingredientType === "MATERIAL"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}>
                          {ing.ingredientType === "MATERIAL" ? "식자재" : "반제품"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {ing.materialMaster?.name ?? ing.semiProduct?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {ing.materialMaster?.code ?? ing.semiProduct?.code ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {ing.materialMaster?.unit ?? ing.semiProduct?.unit ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* ── 재료 편집 섹션 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">재료 관리</h3>
            {!showIngredientForm && (
              <Button size="sm" variant="outline" onClick={() => setShowIngredientForm(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                재료 추가
              </Button>
            )}
          </div>

          {showIngredientForm && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">재료 타입</Label>
                  <Select
                    value={newIngredientType}
                    onValueChange={(v) => {
                      setNewIngredientType(v as "MATERIAL" | "SEMI_PRODUCT");
                      setNewIngredientId("");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MATERIAL">식자재</SelectItem>
                      <SelectItem value="SEMI_PRODUCT">반제품</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {newIngredientType === "MATERIAL" ? "식자재" : "반제품"} 선택
                  </Label>
                  <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {materialOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.name} ({opt.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddIngredient} disabled={ingredientSaving}>
                  {ingredientSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  추가
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowIngredientForm(false)}>
                  취소
                </Button>
              </div>
            </div>
          )}

          {ingredients.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">등록된 재료가 없습니다.</p>
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
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${
                          ing.ingredientType === "MATERIAL"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}>
                          {ing.ingredientType === "MATERIAL" ? "식자재" : "반제품"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {ing.materialMaster?.name ?? ing.semiProduct?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {ing.materialMaster?.code ?? ing.semiProduct?.code ?? "-"}
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
                              name: ing.materialMaster?.name ?? ing.semiProduct?.name ?? "",
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
            <h3 className="text-sm font-semibold text-gray-700">레시피 BOM (배식 중량)</h3>
            <Button size="sm" variant="outline" onClick={handleCreateRecipeBOM}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              새 BOM 버전
            </Button>
          </div>

          {recipeBoms.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">BOM이 없습니다.</p>
          ) : (
            recipeBoms.map((bom) => {
              const isExpanded = expandedBom === bom.id;
              return (
                <div key={bom.id} className="rounded-md border">
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50"
                    onClick={() => setExpandedBom(isExpanded ? null : bom.id)}
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
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>생성: {formatDate(bom.createdAt)}</span>
                          <span>적용: {formatDate(bom.activatedAt)}</span>
                          <span>수정: {formatDate(bom.updatedAt)}</span>
                          <span>슬롯 {bom.slots.length}개</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                            setDeleteConfirm({ type: "bom", id: bom.id, name: `v${bom.version}` })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {bom.slots.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-2">
                          슬롯이 없습니다. 슬롯을 추가하면 구성재료가 자동으로 할당됩니다.
                        </p>
                      ) : (
                        bom.slots.map((slot) => (
                          <div key={slot.id} className="rounded border bg-gray-50/50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{slot.containerGroup.name}</span>
                                <span className="text-gray-400">Slot {slot.slotIndex}</span>
                                <span className="font-mono text-blue-700">{slot.totalWeightG}g</span>
                                {slot.note && (
                                  <span className="text-xs text-gray-400">({slot.note})</span>
                                )}
                              </div>
                              {bom.status === "DRAFT" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    setDeleteConfirm({ type: "slot", id: slot.id, name: slot.containerGroup.name })
                                  }
                                >
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </Button>
                              )}
                            </div>

                            {slot.items.length > 0 && (
                              <div className="rounded border bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">구분</TableHead>
                                      <TableHead className="text-xs">재료명</TableHead>
                                      <TableHead className="text-xs text-right">중량(g)</TableHead>
                                      {bom.status === "DRAFT" && (
                                        <TableHead className="w-[80px] text-xs">작업</TableHead>
                                      )}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {slot.items.map((item) => {
                                      const isEditingWeight = editingWeights[item.id] !== undefined;
                                      return (
                                        <TableRow key={item.id}>
                                          <TableCell className="text-xs">
                                            <span className={`inline-flex rounded px-1 py-0.5 ${
                                              item.ingredientType === "MATERIAL"
                                                ? "bg-blue-50 text-blue-600"
                                                : "bg-purple-50 text-purple-600"
                                            }`}>
                                              {item.ingredientType === "MATERIAL" ? "자재" : "반제품"}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-xs font-medium">
                                            {item.materialMaster?.name ?? item.semiProduct?.name ?? "-"}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {bom.status === "DRAFT" ? (
                                              <Input
                                                type="number"
                                                min={0}
                                                step="any"
                                                className="h-7 w-20 text-xs text-right ml-auto"
                                                value={isEditingWeight ? editingWeights[item.id] : String(item.weightG)}
                                                onChange={(e) =>
                                                  setEditingWeights((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                }
                                                onBlur={() => {
                                                  if (isEditingWeight && editingWeights[item.id] !== String(item.weightG)) {
                                                    handleSaveItemWeight(item.id);
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") handleSaveItemWeight(item.id);
                                                }}
                                              />
                                            ) : (
                                              <span className="text-xs font-mono">{item.weightG}g</span>
                                            )}
                                          </TableCell>
                                          {bom.status === "DRAFT" && (
                                            <TableCell>
                                              <div className="flex items-center gap-1">
                                                {isEditingWeight && (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => handleSaveItemWeight(item.id)}
                                                    disabled={savingItemId === item.id}
                                                  >
                                                    {savingItemId === item.id ? (
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
                                                      name: item.materialMaster?.name ?? item.semiProduct?.name ?? "",
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
                          </div>
                        ))
                      )}

                      {bom.status === "DRAFT" && (
                        <>
                          {addingSlotBomId === bom.id ? (
                            <div className="rounded border border-dashed border-green-300 bg-green-50/30 p-3 space-y-2">
                              <p className="text-xs text-gray-500">슬롯 추가 시 해당 레시피의 전체 구성재료가 자동으로 할당됩니다.</p>
                              <div className="grid grid-cols-4 gap-2">
                                {containerGroupOptions.length > 0 ? (
                                  <Select value={newSlotContainerGroupId} onValueChange={setNewSlotContainerGroupId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="용기 그룹" /></SelectTrigger>
                                    <SelectContent>
                                      {containerGroupOptions.map((g) => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    placeholder="용기그룹 ID"
                                    className="h-8 text-xs"
                                    value={newSlotContainerGroupId}
                                    onChange={(e) => setNewSlotContainerGroupId(e.target.value)}
                                  />
                                )}
                                <Input type="number" placeholder="슬롯 인덱스" className="h-8 text-xs" value={newSlotIndex} onChange={(e) => setNewSlotIndex(e.target.value)} />
                                <Input type="number" placeholder="총 중량(g)" className="h-8 text-xs" value={newSlotWeight} onChange={(e) => setNewSlotWeight(e.target.value)} />
                                <Input placeholder="메모(선택)" className="h-8 text-xs" value={newSlotNote} onChange={(e) => setNewSlotNote(e.target.value)} />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleAddSlot(bom.id)} disabled={slotSaving}>
                                  {slotSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "추가"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingSlotBomId(null)}>취소</Button>
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
              <span className="text-sm font-mono text-gray-400">{recipe.code}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">기본정보 (조회)</TabsTrigger>
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteConfirm?.name}&apos;을(를) 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
