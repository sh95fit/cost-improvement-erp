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
  getVariantsByRecipeIdAction,
  createVariantAction,
  deleteVariantAction,
  createBOMWithAutoVersionAction,
  updateBOMStatusAction,
  deleteBOMAction,
  addBOMItemAction,
  deleteBOMItemAction,
} from "../actions/recipe.action";
import {
  getMaterialsAction,
} from "@/features/material/actions/material.action";
import {
  getSubsidiariesAction,
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

type BOMItemRow = {
  id: string;
  itemType: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  materialMaster: { id: string; name: string; code: string; unit: string } | null;
  subsidiaryMaster: { id: string; name: string; code: string; unit: string } | null;
};

type BOMRow = {
  id: string;
  version: number;
  status: string;
  items: BOMItemRow[];
};

type VariantRow = {
  id: string;
  variantName: string;
  servings: number;
  description: string | null;
  boms: BOMRow[];
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
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

  // 변형 추가 폼
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [newVariantName, setNewVariantName] = useState("");
  const [newServings, setNewServings] = useState("1");
  const [variantSaving, setVariantSaving] = useState(false);

  // BOM 아이템 추가 폼
  const [addingItemBomId, setAddingItemBomId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<"MATERIAL" | "SUBSIDIARY">("MATERIAL");
  const [newItemId, setNewItemId] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  // 자재/부자재 목록 (BOM 아이템 선택용)
  const [materialOptions, setMaterialOptions] = useState<{ id: string; name: string; code: string; unit: string }[]>([]);
  const [subsidiaryOptions, setSubsidiaryOptions] = useState<{ id: string; name: string; code: string; unit: string }[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRecipeByIdAction(recipe.id);
      if (result.success && result.data) {
        setVariants(result.data.variants as unknown as VariantRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [recipe.id]);

  const loadOptions = useCallback(async () => {
    const [matResult, subResult] = await Promise.all([
      getMaterialsAction({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
      getSubsidiariesAction({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
    ]);
    if (matResult.success) {
      setMaterialOptions(
        matResult.data.items.map((m) => ({ id: m.id, name: m.name, code: m.code, unit: m.unit }))
      );
    }
    if (subResult.success) {
      setSubsidiaryOptions(
        subResult.data.items.map((s) => ({ id: s.id, name: s.name, code: s.code, unit: s.unit }))
      );
    }
  }, []);

  useEffect(() => {
    loadDetail();
    loadOptions();
  }, [loadDetail, loadOptions]);

  // ── 변형 추가 ──
  const handleAddVariant = async () => {
    if (!newVariantName.trim()) return;
    setVariantSaving(true);
    try {
      const result = await createVariantAction(recipe.id, {
        variantName: newVariantName,
        servings: Number(newServings) || 1,
      });
      if (result.success) {
        setNewVariantName("");
        setNewServings("1");
        setShowVariantForm(false);
        loadDetail();
        onUpdated();
      }
    } finally {
      setVariantSaving(false);
    }
  };

  // ── 변형 삭제 ──
  const handleDeleteVariant = async (variantId: string) => {
    const result = await deleteVariantAction(variantId);
    if (result.success) {
      loadDetail();
      onUpdated();
    }
  };

  // ── BOM 생성 (자동 버전) ──
  const handleCreateBOM = async (variantId: string) => {
    const result = await createBOMWithAutoVersionAction({
      ownerType: "RECIPE_VARIANT",
      recipeVariantId: variantId,
    });
    if (result.success) {
      loadDetail();
    }
  };

  // ── BOM 상태 변경 ──
  const handleBOMStatus = async (bomId: string, status: string) => {
    const result = await updateBOMStatusAction(bomId, { status });
    if (result.success) {
      loadDetail();
    }
  };

  // ── BOM 삭제 ──
  const handleDeleteBOM = async (bomId: string) => {
    const result = await deleteBOMAction(bomId);
    if (result.success) {
      loadDetail();
    }
  };

  // ── BOM 아이템 추가 ──
  const handleAddItem = async (bomId: string) => {
    if (!newItemId || !newItemQty || !newItemUnit) return;
    setItemSaving(true);
    try {
      const input: Record<string, unknown> = {
        itemType: newItemType,
        quantity: Number(newItemQty),
        unit: newItemUnit,
        ...(newItemType === "MATERIAL"
          ? { materialMasterId: newItemId }
          : { subsidiaryMasterId: newItemId }),
      };
      const result = await addBOMItemAction(bomId, input);
      if (result.success) {
        setAddingItemBomId(null);
        setNewItemId("");
        setNewItemQty("");
        setNewItemUnit("");
        loadDetail();
      }
    } finally {
      setItemSaving(false);
    }
  };

  // ── BOM 아이템 삭제 ──
  const handleDeleteItem = async (itemId: string) => {
    const result = await deleteBOMItemAction(itemId);
    if (result.success) {
      loadDetail();
    }
  };

  // 현재 아이템 타입에 맞는 옵션
  const currentOptions = newItemType === "MATERIAL" ? materialOptions : subsidiaryOptions;

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
            <p className="text-gray-500">변형 수</p>
            <p className="font-medium">{variants.length}개</p>
          </div>
          <div>
            <p className="text-gray-500">등록일</p>
            <p>{new Date(recipe.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
        </div>
      </div>
    );
  };

  // ── 변형 + BOM 탭 ──
  const renderVariantsTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* 변형 추가 */}
        {showVariantForm ? (
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">변형명 *</Label>
                <Input
                  placeholder="예: 기본, 매운맛"
                  value={newVariantName}
                  onChange={(e) => setNewVariantName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">인분 수</Label>
                <Input
                  type="number"
                  min={1}
                  value={newServings}
                  onChange={(e) => setNewServings(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddVariant} disabled={variantSaving}>
                {variantSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                추가
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowVariantForm(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowVariantForm(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            변형 추가
          </Button>
        )}

        {/* 변형 목록 */}
        {variants.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            등록된 변형이 없습니다. 변형을 추가해 주세요.
          </p>
        ) : (
          variants.map((variant) => {
            const isExpanded = expandedVariant === variant.id;
            return (
              <div key={variant.id} className="rounded-md border">
                {/* 변형 헤더 */}
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50"
                  onClick={() => setExpandedVariant(isExpanded ? null : variant.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">{variant.variantName}</p>
                      <p className="text-xs text-gray-500">
                        {variant.servings}인분 · BOM {variant.boms.length}개
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVariant(variant.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>

                {/* BOM 내용 */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateBOM(variant.id)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      새 BOM 버전
                    </Button>

                    {variant.boms.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-4">
                        BOM이 없습니다
                      </p>
                    ) : (
                      variant.boms.map((bom) => (
                        <div key={bom.id} className="rounded border bg-gray-50/50 p-3 space-y-2">
                          {/* BOM 헤더 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">v{bom.version}</span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  BOM_STATUS_STYLES[bom.status] ?? "bg-gray-100"
                                }`}
                              >
                                {BOM_STATUS_LABELS[bom.status] ?? bom.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {bom.status === "DRAFT" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-green-600"
                                  onClick={() => handleBOMStatus(bom.id, "ACTIVE")}
                                  title="확정"
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
                                  onClick={() => handleBOMStatus(bom.id, "ARCHIVED")}
                                  title="보관"
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
                                  onClick={() => handleDeleteBOM(bom.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* BOM 아이템 테이블 */}
                          {bom.items.length > 0 && (
                            <div className="rounded border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">구분</TableHead>
                                    <TableHead className="text-xs">자재/부자재</TableHead>
                                    <TableHead className="text-xs text-right">수량</TableHead>
                                    <TableHead className="text-xs">단위</TableHead>
                                    <TableHead className="w-[40px]" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bom.items.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell className="text-xs">
                                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${
                                          item.itemType === "MATERIAL"
                                            ? "bg-blue-50 text-blue-700"
                                            : "bg-purple-50 text-purple-700"
                                        }`}>
                                          {item.itemType === "MATERIAL" ? "자재" : "부자재"}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs font-medium">
                                        {item.materialMaster?.name ?? item.subsidiaryMaster?.name ?? "-"}
                                        <span className="ml-1 text-gray-400">
                                          ({item.materialMaster?.code ?? item.subsidiaryMaster?.code})
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-mono">
                                        {item.quantity}
                                      </TableCell>
                                      <TableCell className="text-xs">{item.unit}</TableCell>
                                      <TableCell>
                                        {bom.status === "DRAFT" && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleDeleteItem(item.id)}
                                          >
                                            <Trash2 className="h-3 w-3 text-red-400" />
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* BOM 아이템 추가 (DRAFT만) */}
                          {bom.status === "DRAFT" && (
                            <>
                              {addingItemBomId === bom.id ? (
                                <div className="rounded border border-dashed border-blue-300 bg-blue-50/30 p-3 space-y-2">
                                  <div className="grid grid-cols-4 gap-2">
                                    <Select
                                      value={newItemType}
                                      onValueChange={(v) => {
                                        setNewItemType(v as "MATERIAL" | "SUBSIDIARY");
                                        setNewItemId("");
                                        setNewItemUnit("");
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="MATERIAL">자재</SelectItem>
                                        <SelectItem value="SUBSIDIARY">부자재</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={newItemId}
                                      onValueChange={(v) => {
                                        setNewItemId(v);
                                        const opt = currentOptions.find((o) => o.id === v);
                                        if (opt) setNewItemUnit(opt.unit);
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="선택" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {currentOptions.map((opt) => (
                                          <SelectItem key={opt.id} value={opt.id}>
                                            {opt.name} ({opt.code})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      min={0.001}
                                      step="any"
                                      placeholder="수량"
                                      className="h-8 text-xs"
                                      value={newItemQty}
                                      onChange={(e) => setNewItemQty(e.target.value)}
                                    />
                                    <Input
                                      placeholder="단위"
                                      className="h-8 text-xs"
                                      value={newItemUnit}
                                      onChange={(e) => setNewItemUnit(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => handleAddItem(bom.id)}
                                      disabled={itemSaving}
                                    >
                                      {itemSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                      추가
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setAddingItemBomId(null)}
                                    >
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-blue-600"
                                  onClick={() => setAddingItemBomId(bom.id)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  자재/부자재 추가
                                </Button>
                              )}
                            </>
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
            <TabsTrigger value="variants" className="flex-1">
              변형 / BOM ({variants.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-4">
            {renderInfoTab()}
          </TabsContent>
          <TabsContent value="variants" className="mt-4">
            {renderVariantsTab()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
