"use client";

import { useState, useEffect, useCallback } from "react";
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
import { RecipeForm } from "./recipe-form";
import {
  getRecipeByIdAction,
  getIngredientsByRecipeIdAction,
  addIngredientAction,
  deleteIngredientAction,
  createRecipeBOMWithAutoVersionAction,
  updateRecipeBOMStatusAction,
  deleteRecipeBOMAction,
  addRecipeBOMSlotAction,
  deleteRecipeBOMSlotAction,
  addRecipeBOMSlotItemAction,
  deleteRecipeBOMSlotItemAction,
} from "../actions/recipe.action";
import {
  getMaterialsAction,
} from "@/features/material/actions/material.action";
import {
  Pencil,
  X,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  Archive,
} from "lucide-react";
import type { RecipeRow } from "./recipe-list";

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
  onClose: () => void;
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

export function RecipeDetailPanel({ recipe, onClose, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [recipeBoms, setRecipeBoms] = useState<RecipeBOMRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBom, setExpandedBom] = useState<string | null>(null);

  // 재료 추가 폼
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [newIngredientType, setNewIngredientType] = useState<"MATERIAL" | "SEMI_PRODUCT">("MATERIAL");
  const [newIngredientId, setNewIngredientId] = useState("");
  const [ingredientSaving, setIngredientSaving] = useState(false);

  // 식자재 목록 (재료 선택용)
  const [materialOptions, setMaterialOptions] = useState<{ id: string; name: string; code: string; unit: string }[]>([]);

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
    const matResult = await getMaterialsAction({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" });
    if (matResult.success) {
      setMaterialOptions(
        matResult.data.items.map((m) => ({ id: m.id, name: m.name, code: m.code, unit: m.unit }))
      );
    }
  }, []);

  useEffect(() => {
    loadDetail();
    loadOptions();
  }, [loadDetail, loadOptions]);

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

  // ── RecipeBOM 생성 (자동 버전) ──
  const handleCreateRecipeBOM = async () => {
    const result = await createRecipeBOMWithAutoVersionAction({
      recipeId: recipe.id,
      baseWeightG: 500, // 기본값
    });
    if (result.success) {
      loadDetail();
    }
  };

  // ── RecipeBOM 상태 변경 ──
  const handleBOMStatus = async (bomId: string, status: string) => {
    const result = await updateRecipeBOMStatusAction(bomId, { status });
    if (result.success) {
      loadDetail();
    }
  };

  // ── RecipeBOM 삭제 ──
  const handleDeleteBOM = async (bomId: string) => {
    const result = await deleteRecipeBOMAction(bomId);
    if (result.success) {
      loadDetail();
    }
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
        {/* 재료 섹션 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">재료 목록</h3>
            {showIngredientForm ? null : (
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
                          onClick={() => handleDeleteIngredient(ing.id)}
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

        {/* RecipeBOM 섹션 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">레시피 BOM (배식 중량)</h3>
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
                        <p className="text-xs text-gray-500">
                          기준 중량: {bom.baseWeightG}g · 슬롯 {bom.slots.length}개
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {bom.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-green-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBOMStatus(bom.id, "ACTIVE");
                          }}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          확정
                        </Button>
                      )}
                      {bom.status === "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-orange-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBOMStatus(bom.id, "ARCHIVED");
                          }}
                        >
                          <Archive className="mr-1 h-3 w-3" />
                          보관
                        </Button>
                      )}
                      {bom.status !== "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBOM(bom.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-2">
                      {bom.slots.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-4">
                          슬롯이 없습니다
                        </p>
                      ) : (
                        bom.slots.map((slot) => (
                          <div key={slot.id} className="rounded border bg-gray-50/50 p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{slot.containerGroup.name}</span>
                                <span className="text-gray-400">Slot {slot.slotIndex}</span>
                                <span className="font-mono text-blue-700">{slot.totalWeightG}g</span>
                              </div>
                            </div>
                            {slot.items.length > 0 && (
                              <div className="ml-4 space-y-1">
                                {slot.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
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
                                ))}
                              </div>
                            )}
                          </div>
                        ))
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{recipe.name}</h2>
          <p className="text-sm text-gray-500">{recipe.code}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs defaultValue="info">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">기본정보</TabsTrigger>
            <TabsTrigger value="ingredients" className="flex-1">
              재료 / BOM ({ingredients.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-4">
            {renderInfoTab()}
          </TabsContent>
          <TabsContent value="ingredients" className="mt-4">
            {renderIngredientsTab()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
