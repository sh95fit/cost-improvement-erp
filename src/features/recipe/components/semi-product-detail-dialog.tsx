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
import { SemiProductForm } from "./semi-product-form";
import {
  getSemiProductByIdAction,
  createBOMWithAutoVersionAction,
  updateBOMStatusAction,
  deleteBOMAction,
  addBOMItemAction,
  updateBOMItemAction,
  deleteBOMItemAction,
} from "../actions/recipe.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Check,
  RotateCcw,
  AlertTriangle,
  Save,
} from "lucide-react";
import type { SemiProductRow } from "./semi-product-list";

type BOMItemRow = {
  id: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  materialMaster: { id: string; name: string; code: string; unit: string } | null;
};

type BOMRow = {
  id: string;
  version: number;
  status: string;
  baseQuantity: number;
  baseUnit: string;
  createdAt: string;
  updatedAt: string;
  items: BOMItemRow[];
};

type Props = {
  semiProduct: SemiProductRow;
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
  ACTIVE: "bg-green-50 text-green-700 border border-green-200",
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

export function SemiProductDetailDialog({
  semiProduct,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [boms, setBoms] = useState<BOMRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // BOM 아이템 추가 폼
  const [addingItemBomId, setAddingItemBomId] = useState<string | null>(null);
  const [newItemId, setNewItemId] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  // ★ BOM 아이템 수량 인라인 편집
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // 자재 목록
  const [materialOptions, setMaterialOptions] = useState<
    { id: string; name: string; code: string; unit: string }[]
  >([]);

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSemiProductByIdAction(semiProduct.id);
      if (result.success && result.data) {
        setBoms(result.data.boms as unknown as BOMRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [semiProduct.id]);

  const loadOptions = useCallback(async () => {
    const matResult = await getMaterialsAction({
      page: 1,
      limit: 200,
      sortBy: "name",
      sortOrder: "asc",
    });
    if (matResult.success) {
      setMaterialOptions(
        matResult.data.items.map((m) => ({
          id: m.id,
          name: m.name,
          code: m.code,
          unit: m.unit,
        }))
      );
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadDetail();
      loadOptions();
    }
  }, [open, loadDetail, loadOptions]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleCreateBOM = async () => {
    const result = await createBOMWithAutoVersionAction({
      semiProductId: semiProduct.id,
    });
    if (result.success) loadDetail();
  };

  const handleBOMStatus = async (bomId: string, status: string) => {
    setErrorMessage(null);
    const result = await updateBOMStatusAction(bomId, { status });
    if (result.success) {
      loadDetail();
    } else {
      setErrorMessage(result.error.message);
    }
  };

  const handleDeleteBOM = async (bomId: string) => {
    setErrorMessage(null);
    const result = await deleteBOMAction(bomId);
    if (result.success) {
      loadDetail();
    } else {
      setErrorMessage(result.error.message);
    }
  };

  const handleAddItem = async (bomId: string) => {
    if (!newItemId || !newItemQty || !newItemUnit) return;
    setItemSaving(true);
    try {
      const input: Record<string, unknown> = {
        materialMasterId: newItemId,
        quantity: Number(newItemQty),
        unit: newItemUnit,
        sortOrder: 0,
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

  // ★ BOM 아이템 수량 저장
  const handleSaveItemQuantity = async (itemId: string) => {
    const qtyStr = editingQuantities[itemId];
    if (qtyStr === undefined) return;
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty < 0.001) return;
    setSavingItemId(itemId);
    try {
      const result = await updateBOMItemAction(itemId, { quantity: qty });
      if (result.success) {
        setEditingQuantities((prev) => {
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

  const handleDeleteItem = async (itemId: string) => {
    const result = await deleteBOMItemAction(itemId);
    if (result.success) loadDetail();
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === "bom") await handleDeleteBOM(id);
    else if (type === "item") await handleDeleteItem(id);
    setDeleteConfirm(null);
  };

  // ── 기본정보 탭 ──
  const renderInfoTab = () => {
    if (isEditing) {
      return (
        <SemiProductForm
          semiProduct={semiProduct}
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
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">반제품 코드</p>
            <p className="font-mono font-medium">{semiProduct.code}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">반제품명</p>
            <p className="font-medium">{semiProduct.name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">단위</p>
            <p>{semiProduct.unit}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">등록일</p>
            <p>{new Date(semiProduct.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">BOM 수</p>
            <p className="font-medium">{boms.length}개</p>
          </div>
        </div>
      </div>
    );
  };

  // ── BOM 탭 ──
  const renderBOMTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">BOM 버전 관리</h3>
          <Button size="sm" variant="outline" onClick={handleCreateBOM}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            새 BOM 버전
          </Button>
        </div>

        {boms.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            BOM이 없습니다. 새 BOM 버전을 추가해 주세요.
          </p>
        ) : (
          boms.map((bom) => (
            <div key={bom.id} className="rounded-lg border bg-white p-4 space-y-3">
              {/* BOM 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">v{bom.version}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        BOM_STATUS_STYLES[bom.status] ?? "bg-gray-100"
                      }`}
                    >
                      {BOM_STATUS_LABELS[bom.status] ?? bom.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({bom.baseQuantity}
                      {bom.baseUnit} 기준)
                    </span>
                  </div>
                  {/* ★ 날짜 표시 */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    <span>생성: {formatDate(bom.createdAt)}</span>
                    <span>수정: {formatDate(bom.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {bom.status === "DRAFT" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleBOMStatus(bom.id, "ACTIVE")}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      확정
                    </Button>
                  )}
                  {/* ★ ACTIVE 보관 버튼 제거 */}
                  {bom.status === "ARCHIVED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
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

              {/* BOM 아이템 테이블 */}
              {bom.items.length > 0 && (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead className="text-xs">자재</TableHead>
                        <TableHead className="text-xs w-[100px]">코드</TableHead>
                        <TableHead className="text-xs w-[120px] text-right">수량</TableHead>
                        <TableHead className="text-xs w-[60px]">단위</TableHead>
                        {bom.status === "DRAFT" && (
                          <TableHead className="w-[80px] text-xs text-center">작업</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bom.items.map((item) => {
                        const isEditingQty = editingQuantities[item.id] !== undefined;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs font-medium">
                              {item.materialMaster?.name ?? "-"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-400 font-mono">
                              {item.materialMaster?.code ?? "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {bom.status === "DRAFT" ? (
                                <Input
                                  type="number"
                                  min={0.001}
                                  step="any"
                                  className="h-7 w-24 text-xs text-right ml-auto"
                                  value={
                                    isEditingQty
                                      ? editingQuantities[item.id]
                                      : String(item.quantity)
                                  }
                                  onChange={(e) =>
                                    setEditingQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    if (
                                      isEditingQty &&
                                      editingQuantities[item.id] !== String(item.quantity)
                                    ) {
                                      handleSaveItemQuantity(item.id);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveItemQuantity(item.id);
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-mono">{item.quantity}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{item.unit}</TableCell>
                            {bom.status === "DRAFT" && (
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  {isEditingQty && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleSaveItemQuantity(item.id)}
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
                                        type: "item",
                                        id: item.id,
                                        name: item.materialMaster?.name ?? "",
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

              {/* BOM 아이템 추가 (DRAFT만) */}
              {bom.status === "DRAFT" && (
                <>
                  {addingItemBomId === bom.id ? (
                    <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/30 p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">자재</Label>
                          <Select
                            value={newItemId}
                            onValueChange={(v) => {
                              setNewItemId(v);
                              const opt = materialOptions.find((o) => o.id === v);
                              if (opt) setNewItemUnit(opt.unit);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="자재 선택" />
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
                        <div className="space-y-1">
                          <Label className="text-xs">수량</Label>
                          <Input
                            type="number"
                            min={0.001}
                            step="any"
                            placeholder="수량"
                            className="h-9 text-xs"
                            value={newItemQty}
                            onChange={(e) => setNewItemQty(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">단위</Label>
                          <Input
                            placeholder="단위"
                            className="h-9 text-xs"
                            value={newItemUnit}
                            onChange={(e) => setNewItemUnit(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAddItem(bom.id)}
                          disabled={itemSaving || !newItemId || !newItemQty || !newItemUnit}
                        >
                          {itemSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          추가
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingItemBomId(null);
                            setNewItemId("");
                            setNewItemQty("");
                            setNewItemUnit("");
                          }}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => setAddingItemBomId(bom.id)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      자재 추가
                    </Button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <>
      {/* ★ sm:max-w-5xl 명시 */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-lg">{semiProduct.name}</span>
              <span className="text-sm font-mono text-gray-400">{semiProduct.code}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">
                기본정보
              </TabsTrigger>
              <TabsTrigger value="bom" className="flex-1">
                BOM ({boms.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              {renderInfoTab()}
            </TabsContent>
            <TabsContent value="bom" className="mt-4">
              {renderBOMTab()}
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

