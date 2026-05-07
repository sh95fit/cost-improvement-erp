"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getUnitMastersAction,
  createUnitMasterAction,
  updateUnitMasterAction,
  deleteUnitMasterAction,
} from "../actions/unit-master.action";
import { Plus, Pencil, Trash2, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type UnitMasterRow = {
  id: string;
  itemType: string;
  unitCategory: string;
  code: string;
  name: string;
  isSystem: boolean;
  sortOrder: number;
};

type Props = {
  itemType: "MATERIAL" | "SUBSIDIARY";
};

const UNIT_CATEGORY_LABELS: Record<string, string> = {
  WEIGHT: "중량",
  VOLUME: "용량",
  COUNT: "수량",
  LENGTH: "길이",
};

const CATEGORY_STYLES: Record<string, string> = {
  WEIGHT: "bg-blue-50 text-blue-700",
  VOLUME: "bg-cyan-50 text-cyan-700",
  COUNT: "bg-green-50 text-green-700",
  LENGTH: "bg-purple-50 text-purple-700",
};

export function UnitMasterList({ itemType }: Props) {
  const [items, setItems] = useState<UnitMasterRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 등록 Dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("COUNT");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [creating, setCreating] = useState(false);

  // 수정 Dialog
  const [editTarget, setEditTarget] = useState<UnitMasterRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [updating, setUpdating] = useState(false);

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<UnitMasterRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUnitMastersAction({ itemType, limit: 100 });
      if (result.success) {
        const data = result.data as { items: UnitMasterRow[] };
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [itemType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── 약어 → 코드 변환 (소문자 보존, 공백 제거) ──
  const toCode = (name: string) => name.trim().replace(/\s+/g, "");

  // ── 등록 ──
  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const code = toCode(trimmed);
    setCreating(true);
    try {
      const result = await createUnitMasterAction({
        itemType,
        unitCategory: newCategory,
        code,
        name: trimmed,
        sortOrder: Number(newSortOrder) || 0,
      });
      if (result.success) {
        toast.success(`단위 "${code}"가 등록되었습니다`);
        setShowCreate(false);
        setNewName("");
        setNewSortOrder("0");
        fetchData();
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error("단위 등록에 실패했습니다");
    } finally {
      setCreating(false);
    }
  };

  // ── 수정 ──
  const openEdit = (item: UnitMasterRow) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditCategory(item.unitCategory);
    setEditSortOrder(String(item.sortOrder));
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) return;
    setUpdating(true);
    try {
      const result = await updateUnitMasterAction(editTarget.id, {
        name: editName.trim(),
        unitCategory: editCategory,
        sortOrder: Number(editSortOrder) || 0,
      });
      if (result.success) {
        toast.success("단위가 수정되었습니다");
        setEditTarget(null);
        fetchData();
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error("단위 수정에 실패했습니다");
    } finally {
      setUpdating(false);
    }
  };

  // ── 삭제 ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await deleteUnitMasterAction(deleteTarget.id);
      if (result.success) {
        toast.success(`단위 "${deleteTarget.code}"가 삭제되었습니다`);
        fetchData();
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error("단위 삭제에 실패했습니다");
    }
    setDeleteTarget(null);
  };

  // 카테고리별 그룹핑
  const grouped = items.reduce<Record<string, UnitMasterRow[]>>((acc, item) => {
    const cat = item.unitCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {itemType === "MATERIAL" ? "자재" : "부자재"}에서 사용할 단위를 관리합니다.
          시스템 기본 단위는 삭제할 수 없습니다.
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          단위 추가
        </Button>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">등록된 단위가 없습니다</p>
      ) : (
        Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category] ?? "bg-gray-100 text-gray-700"}`}>
                {UNIT_CATEGORY_LABELS[category] ?? category}
              </span>
              <span className="text-xs font-normal text-gray-400">{categoryItems.length}개</span>
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">코드 (약어)</TableHead>
                    <TableHead>표시명</TableHead>
                    <TableHead className="w-[80px] text-center">정렬</TableHead>
                    <TableHead className="w-[80px] text-center">구분</TableHead>
                    <TableHead className="w-[80px] text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-center text-sm text-gray-500">{item.sortOrder}</TableCell>
                      <TableCell className="text-center">
                        {item.isSystem ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <ShieldCheck className="h-3 w-3" /> 시스템
                          </span>
                        ) : (
                          <span className="text-xs text-blue-600">커스텀</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!item.isSystem && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))
      )}

      {/* 등록 Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>단위 추가</DialogTitle>
            <DialogDescription>
              {itemType === "MATERIAL" ? "자재" : "부자재"}용 단위를 추가합니다.
              약어를 입력하면 코드로 자동 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>단위 분류 *</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEIGHT">중량</SelectItem>
                  <SelectItem value="VOLUME">용량</SelectItem>
                  <SelectItem value="COUNT">수량</SelectItem>
                  <SelectItem value="LENGTH">길이</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitName">단위 약어 (= 코드 + 표시명) *</Label>
              <Input
                id="unitName"
                placeholder="예: kg, EA, 개, 봉, 팩"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={20}
              />
              {newName.trim() && (
                <p className="text-xs text-gray-500">
                  코드: <span className="font-mono font-medium text-blue-600">{toCode(newName)}</span> / 표시명: <span className="font-medium">{newName.trim()}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitSort">정렬 순서</Label>
              <Input id="unitSort" type="number" min={0} value={newSortOrder} onChange={(e) => setNewSortOrder(e.target.value)} />
              <p className="text-xs text-gray-500">Select Box에서 표시되는 순서입니다. 숫자가 작을수록 먼저 표시됩니다.</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)}>취소</Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 수정 Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>단위 수정</DialogTitle>
            <DialogDescription>
              {editTarget?.code} 단위의 분류, 표시명, 정렬 순서를 수정합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>단위 코드</Label>
              <Input value={editTarget?.code ?? ""} disabled />
              <p className="text-xs text-gray-500">코드(약어)는 등록 후 변경할 수 없습니다</p>
            </div>
            <div className="space-y-2">
              <Label>단위 분류 *</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEIGHT">중량</SelectItem>
                  <SelectItem value="VOLUME">용량</SelectItem>
                  <SelectItem value="COUNT">수량</SelectItem>
                  <SelectItem value="LENGTH">길이</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editName">표시명 *</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSort">정렬 순서</Label>
              <Input id="editSort" type="number" min={0} value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} />
              <p className="text-xs text-gray-500">Select Box에서 표시되는 순서입니다</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditTarget(null)}>취소</Button>
              <Button onClick={handleUpdate} disabled={updating || !editName.trim()}>
                {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                수정
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>단위를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.code}&quot; ({deleteTarget?.name}) 단위를 삭제합니다.
              사용 중인 단위는 삭제할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
