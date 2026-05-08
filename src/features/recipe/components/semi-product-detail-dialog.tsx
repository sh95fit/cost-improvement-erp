"use client";

import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
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

export function SemiProductDetailDialog({ semiProduct, open, onOpenChange, onUpdated }: Props) {
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

  // ★ 추가: 인라인 수량 편집
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // 자재 목록
  const [materialOptions, setMaterialOptions] = useState<{ id: string; name: string; code: string; unit: string }[]>([]);

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSemiProductByIdAction(semiProduct.id);
      if (result.success && result.data) {
        setBoms(result.data.boms as unknown as BOMRow[]);
      } else {
        toast.error("반제품 상세 정보를 불러오는데 실패했습니다");
      }
    } catch {
      toast.error("반제품 상세 정보를 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [semiProduct.id]);

  const loadOptions = useCallback(async () => {
    const matResult = await getMaterialsAction({ page: 1, limit: 200, sortBy: "name", sortOrder: "asc" });
    if (matResult.success) {
      setMaterialOptions(
        matResult.data.items.map((m) => ({ id: m.id, name: m.name, code: m.code, unit: m.unit }))
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
    try {
      const result = await createBOMWithAutoVersionAction({
        semiProductId: semiProduct.id,
      });
      if (result.success) {
        toast.success("새 BOM 버전이 생성되었습니다");
        loadDetail();
      } else {
        toast.error(result.error?.message || "BOM 생성에 실패했습니다");
      }
    } catch {
      toast.error("BOM 생성 중 오류가 발생했습니다");
    }
  };

  const handleBOMStatus = async (bomId: string, status: string) => {
    setErrorMessage(null);
    try {
      const result = await updateBOMStatusAction(bomId, { status });
      if (result.success) {
        const statusLabel = BOM_STATUS_LABELS[status] ?? status;
        toast.success(`BOM 상태가 "${statusLabel}"(으)로 변경되었습니다`);
        loadDetail();
      } else {
        toast.error(result.error.message || "상태 변경에 실패했습니다");
        setErrorMessage(result.error.message);
      }
    } catch {
      toast.error("상태 변경 중 오류가 발생했습니다");
    }
  };

  const handleDeleteBOM = async (bomId: string) => {
    setErrorMessage(null);
    try {
      const result = await deleteBOMAction(bomId);
      if (result.success) {
        toast.success("BOM이 삭제되었습니다");
        loadDetail();
      } else {
        toast.error(result.error.message || "BOM 삭제에 실패했습니다");
        setErrorMessage(result.error.message);
      }
    } catch {
      toast.error("BOM 삭제 중 오류가 발생했습니다");
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
        toast.success("자재가 추가되었습니다");
        setAddingItemBomId(null);
        setNewItemId("");
        setNewItemQty("");
        setNewItemUnit("");
        loadDetail();
      } else {
        toast.error(result.error?.message || "자재 추가에 실패했습니다");
      }
    } catch {
      toast.error("자재 추가 중 오류가 발생했습니다");
    } finally {
      setItemSaving(false);
    }
  };

  // ★ 추가: 인라인 수량 저장
  const handleSaveItemQuantity = async (itemId: string) => {
    const qtyStr = editingQuantities[itemId];
    if (!qtyStr) return;
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) return;
    setSavingItemId(itemId);
    try {
      const result = await updateBOMItemAction(itemId, { quantity: qty });
      if (result.success) {
        toast.success("수량이 수정되었습니다");
        setEditingQuantities((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        loadDetail();
      } else {
        toast.error(result.error?.message || "수량 수정에 실패했습니다");
      }
    } catch {
      toast.error("수량 수정 중 오류가 발생했습니다");
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const result = await deleteBOMItemAction(itemId);
      if (result.success) {
        toast.success("자재가 삭제되었습니다");
        loadDetail();
      } else {
        toast.error(result.error?.message || "자재 삭제에 실패했습니다");
      }
    } catch {
      toast.error("자재 삭제 중 오류가 발생했습니다");
    }
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
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">반제품 코드</p>
            <p className="font-mono font-medium">{semiProduct.code}</p>
          </div>
          <div>
            <p className="text-gray-500">반제품명</p>
            <p className="font-medium">{semiProduct.name}</p>
          </div>
          <div>
            <p className="text-gray-500">단위</p>
            <p>{semiProduct.unit}</p>
          </div>
          <div>
            <p className="text-gray-500">등록일</p>
            <p>{new Date(semiProduct.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
          <div>
            <p className="text-gray-500">BOM 수</p>
            <p>{boms.length}개</p>
          </div>
        </div>
      </div>
    );
  };

  // ── BOM 탭 ──
  const renderBOMTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
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

        <Button size="sm" variant="outline" onClick={handleCreateBOM}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          새 BOM 버전
        </Button>

        {boms.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            BOM이 없습니다. 새 BOM 버전을 추가해 주세요.
          </p>
        ) : (
          boms.map((bom) => (
            <div key={bom.id} className="rounded border bg-gray-50/50 p-3 space-y-2">
              {/* BOM 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">v{bom.version}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        BOM_STATUS_STYLES[bom.status] ?? "bg-gray-100"
                      }`}
                    >
                      {BOM_STATUS_LABELS[bom.status] ?? bom.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({bom.baseQuantity} {bom.baseUnit} 기준)
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    생성: {formatDate(bom.createdAt)} · 수정: {formatDate(bom.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {bom.status === "DRAFT" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleBOMStatus(bom.id, "ACTIVE")}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        확정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500"
                        onClick={() =>
                          setDeleteConfirm({
                            type: "bom",
                            id: bom.id,
                            name: `v${bom.version}`,
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {bom.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleBOMStatus(bom.id, "ARCHIVED")}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      보관
                    </Button>
                  )}
                </div>
              </div>

              {/* BOM 아이템 테이블 */}
              <div className="rounded border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>자재</TableHead>
                      <TableHead className="w-[100px] text-right">수량</TableHead>
                      <TableHead className="w-[60px]">단위</TableHead>
                      <TableHead className="w-[80px] text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bom.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-gray-400">
                          구성 자재가 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      bom.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            {item.materialMaster
                              ? `${item.materialMaster.name} (${item.materialMaster.code})`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingQuantities[item.id] !== undefined ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={editingQuantities[item.id]}
                                  onChange={(e) =>
                                    setEditingQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  className="h-7 w-20 text-right text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleSaveItemQuantity(item.id)}
                                  disabled={savingItemId === item.id}
                                >
                                  {savingItemId === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span
                                className={`cursor-pointer text-sm ${bom.status === "DRAFT" ? "text-blue-600 underline" : ""}`}
                                onClick={() => {
                                  if (bom.status === "DRAFT") {
                                    setEditingQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: String(item.quantity),
                                    }));
                                  }
                                }}
                              >
                                {item.quantity}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right">
                            {bom.status === "DRAFT" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  setDeleteConfirm({
                                    type: "item",
                                    id: item.id,
                                    name: item.materialMaster?.name ?? "자재",
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 아이템 추가 폼 */}
              {bom.status === "DRAFT" && (
                <>
                  {addingItemBomId === bom.id ? (
                    <div className="flex items-end gap-2 rounded border bg-white p-2">
                      <div className="flex-1">
                        <Select value={newItemId} onValueChange={(v) => {
                          setNewItemId(v);
                          const mat = materialOptions.find((m) => m.id === v);
                          if (mat) setNewItemUnit(mat.unit);
                        }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="자재 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {materialOptions.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} ({m.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="수량"
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(e.target.value)}
                        className="h-8 w-20 text-xs"
                      />
                      <Input
                        placeholder="단위"
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value)}
                        className="h-8 w-16 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleAddItem(bom.id)}
                        disabled={itemSaving}
                      >
                        {itemSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "추가"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
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
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-gray-500"
                      onClick={() => setAddingItemBomId(bom.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {semiProduct.name}{" "}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {semiProduct.code}
              </span>
            </DialogTitle>
            <DialogDescription>반제품 상세 정보 및 BOM 관리</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="mb-4">
              <TabsTrigger value="info">기본정보</TabsTrigger>
              <TabsTrigger value="bom">BOM ({boms.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="info">{renderInfoTab()}</TabsContent>
            <TabsContent value="bom">{renderBOMTab()}</TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === "bom" ? "BOM을 삭제하시겠습니까?" : "자재를 삭제하시겠습니까?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteConfirm?.name}&apos;을(를) 삭제합니다. 이 작업은 되돌릴 수 없습니다.
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
