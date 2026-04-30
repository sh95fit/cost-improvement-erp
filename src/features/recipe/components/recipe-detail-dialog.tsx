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
  updateRecipeBOMBaseWeightAction,
  deleteRecipeBOMAction,
  addRecipeBOMSlotAction,
  deleteRecipeBOMSlotAction,
  addRecipeBOMSlotItemAction,
  deleteRecipeBOMSlotItemAction,
} from "../actions/recipe.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  Archive,
  RotateCcw,
  AlertTriangle,
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

  // 슬롯 아이템 추가 폼
  const [addingItemSlotId, setAddingItemSlotId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<"MATERIAL" | "SEMI_PRODUCT">("MATERIAL");
  const [newItemId, setNewItemId] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  // BOM 기준 중량 편집
  const [editingWeightBomId, setEditingWeightBomId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");

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

  const loadOptions = useCallback(async () => {
    const matResult = await getMaterialsAction({ page: 1, limit: 200, sortBy: "name", sortOrder: "asc" });
    if (matResult.success) {
      setMaterialOptions(
        matResult.data.items.map((m) => ({ id: m.id, name: m.name, code: m.code, unit: m.unit }))
      );
    }
    // 용기 그룹은 레시피 BOM에서 가져온 데이터로 설정 (별도 API 없으면 기존 데이터 활용)
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
  }, [recipeBoms]);

  useEffect(() => {
    if (open) {
      loadDetail();
    }
  }, [open, loadDetail]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

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
  const handleCreateRecipeBOM = async () => {
    const result = await createRecipeBOMWithAutoVersionAction({
      recipeId: recipe.id,
      baseWeightG: 500,
    });
    if (result.success) {
      loadDetail();
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

  // ── 기준 중량 저장 ──
  const handleSaveBaseWeight = async (bomId: string) => {
    const weight = parseFloat(editWeight);
    if (isNaN(weight) || weight <= 0) return;
    const result = await updateRecipeBOMBaseWeightAction(bomId, { baseWeightG: weight });
    if (result.success) {
      setEditingWeightBomId(null);
      loadDetail();
    }
  };

  // ── 슬롯 추가 ──
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

  // ── 슬롯 아이템 추가 ──
  const handleAddSlotItem = async (slotId: string) => {
    if (!newItemId || !newItemWeight) return;
    setItemSaving(true);
    try {
      const result = await addRecipeBOMSlotItemAction(slotId, {
        ingredientType: newItemType,
        ...(newItemType === "MATERIAL"
          ? { materialMasterId: newItemId }
          : { semiProductId: newItemId }),
        weightG: parseFloat(newItemWeight),
        unit: "g",
        sortOrder: 0,
      });
      if (result.success) {
        setAddingItemSlotId(null);
        setNewItemId("");
        setNewItemWeight("");
        loadDetail();
      }
    } finally {
      setItemSaving(false);
    }
  };

  // ── 슬롯 아이템 삭제 ──
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

  // ── 기본정보 탭 ──
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
      </div>
    );
  };

  // ── 재료 + BOM 탭 ──
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
        {/* 에러 메시지 */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* ── 재료 섹션 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">재료 목록</h3>
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
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
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
                  {/* BOM 헤더 */}
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
                        <p className="text-xs text-gray-500">
                          기준 중량: {bom.baseWeightG}g · 슬롯 {bom.slots.length}개
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {/* DRAFT → ACTIVE */}
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
                      {/* ACTIVE → ARCHIVED */}
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
                      {/* ★ ARCHIVED → ACTIVE (복원) */}
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
                      {/* 삭제 (ACTIVE는 불가) */}
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

                  {/* BOM 확장 영역 */}
                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {/* 기준 중량 편집 */}
                      <div className="flex items-center gap-3">
                        <Label className="text-xs text-gray-500">기준 중량(g):</Label>
                        {editingWeightBomId === bom.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-7 w-24 text-xs"
                              value={editWeight}
                              onChange={(e) => setEditWeight(e.target.value)}
                            />
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveBaseWeight(bom.id)}>
                              저장
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingWeightBomId(null)}>
                              취소
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium">{bom.baseWeightG}g</span>
                            {bom.status === "DRAFT" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => {
                                  setEditingWeightBomId(bom.id);
                                  setEditWeight(String(bom.baseWeightG));
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 슬롯 목록 */}
                      {bom.slots.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-2">슬롯이 없습니다</p>
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
                              <div className="flex items-center gap-1">
                                {bom.status === "DRAFT" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-blue-600"
                                      onClick={() => {
                                        setAddingItemSlotId(slot.id);
                                        setNewItemType("MATERIAL");
                                        setNewItemId("");
                                        setNewItemWeight("");
                                      }}
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      재료
                                    </Button>
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
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 슬롯 아이템 추가 폼 */}
                            {addingItemSlotId === slot.id && (
                              <div className="rounded border border-dashed border-blue-300 bg-blue-50/30 p-3 space-y-2">
                                <div className="grid grid-cols-4 gap-2">
                                  <Select value={newItemType} onValueChange={(v) => { setNewItemType(v as "MATERIAL" | "SEMI_PRODUCT"); setNewItemId(""); }}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="MATERIAL">식자재</SelectItem>
                                      <SelectItem value="SEMI_PRODUCT">반제품</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select value={newItemId} onValueChange={setNewItemId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                                    <SelectContent>
                                      {materialOptions.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.id}>{opt.name} ({opt.code})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    min={0.01}
                                    step="any"
                                    placeholder="중량(g)"
                                    className="h-8 text-xs"
                                    value={newItemWeight}
                                    onChange={(e) => setNewItemWeight(e.target.value)}
                                  />
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-8 text-xs" onClick={() => handleAddSlotItem(slot.id)} disabled={itemSaving}>
                                      {itemSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "추가"}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingItemSlotId(null)}>
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 슬롯 아이템 목록 */}
                            {slot.items.length > 0 && (
                              <div className="ml-2 space-y-1">
                                {slot.items.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between text-xs text-gray-600 py-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex rounded px-1 py-0.5 ${
                                        item.ingredientType === "MATERIAL"
                                          ? "bg-blue-50 text-blue-600"
                                          : "bg-purple-50 text-purple-600"
                                      }`}>
                                        {item.ingredientType === "MATERIAL" ? "자재" : "반제품"}
                                      </span>
                                      <span>{item.materialMaster?.name ?? item.semiProduct?.name ?? "-"}</span>
                                      <span className="font-mono">{item.weightG}{item.unit}</span>
                                    </div>
                                    {bom.status === "DRAFT" && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() =>
                                          setDeleteConfirm({
                                            type: "slotItem",
                                            id: item.id,
                                            name: item.materialMaster?.name ?? item.semiProduct?.name ?? "",
                                          })
                                        }
                                      >
                                        <Trash2 className="h-2.5 w-2.5 text-red-400" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {/* 슬롯 추가 */}
                      {bom.status === "DRAFT" && (
                        <>
                          {addingSlotBomId === bom.id ? (
                            <div className="rounded border border-dashed border-green-300 bg-green-50/30 p-3 space-y-2">
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
                                <Input type="number" placeholder="중량(g)" className="h-8 text-xs" value={newSlotWeight} onChange={(e) => setNewSlotWeight(e.target.value)} />
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
                              슬롯 추가
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{recipe.name}</span>
              <span className="text-sm font-mono text-gray-400">{recipe.code}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">기본정보</TabsTrigger>
              <TabsTrigger value="ingredients" className="flex-1">
                재료 / BOM ({ingredients.length} / {recipeBoms.length})
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

      {/* 삭제 확인 다이얼로그 */}
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
