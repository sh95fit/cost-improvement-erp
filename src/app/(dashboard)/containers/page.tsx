"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getContainerGroupsAction,
  createContainerGroupAction,
  updateContainerGroupAction,
  deleteContainerGroupAction,
  addContainerSlotAction,
  updateContainerSlotAction,
  deleteContainerSlotAction,
  addContainerAccessoryAction,
  deleteContainerAccessoryAction,
} from "@/features/container/actions/container.action";
import {
  Plus, Trash2, Pencil, Search, ChevronLeft, ChevronRight, Loader2, Box,
} from "lucide-react";

type SlotRow = { id: string; slotIndex: number; label: string; volumeMl: number | null };
type AccessoryRow = { id: string; name: string; description: string | null };
type GroupRow = {
  id: string; name: string; code: string;
  createdAt: string; updatedAt: string;
  slots: SlotRow[]; accessories: AccessoryRow[];
};

export default function ContainersPage() {
  const [items, setItems] = useState<GroupRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // 생성/수정
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [saving, setSaving] = useState(false);

  // 상세 (슬롯/부속품 관리)
  const [selectedGroup, setSelectedGroup] = useState<GroupRow | null>(null);

  // 슬롯 추가
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotVolume, setNewSlotVolume] = useState("");
  const [slotSaving, setSlotSaving] = useState(false);

  // 부속품 추가
  const [newAccName, setNewAccName] = useState("");
  const [newAccDesc, setNewAccDesc] = useState("");
  const [accSaving, setAccSaving] = useState(false);

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getContainerGroupsAction({
        page, limit: 20, search: search || undefined, sortBy: "name", sortOrder: "asc",
      });
      if (result.success) {
        setItems(result.data.items as unknown as GroupRow[]);
        setPagination(result.data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // 그룹 생성
  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setSaving(true);
    try {
      const result = await createContainerGroupAction({ name: newGroupName.trim() });
      if (result.success) {
        setNewGroupName("");
        setShowCreateForm(false);
        fetchData(1);
      }
    } finally {
      setSaving(false);
    }
  };

  // 그룹 수정
  const handleUpdate = async () => {
    if (!editingGroupId || !editingGroupName.trim()) return;
    setSaving(true);
    try {
      const result = await updateContainerGroupAction(editingGroupId, { name: editingGroupName.trim() });
      if (result.success) {
        setEditingGroupId(null);
        setEditingGroupName("");
        fetchData(pagination.page);
        if (selectedGroup?.id === editingGroupId) {
          setSelectedGroup({ ...selectedGroup, name: editingGroupName.trim() });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // 슬롯 추가
  const handleAddSlot = async () => {
    if (!selectedGroup || !newSlotLabel.trim()) return;
    setSlotSaving(true);
    try {
      const nextIndex = selectedGroup.slots.length > 0
        ? Math.max(...selectedGroup.slots.map((s) => s.slotIndex)) + 1
        : 0;
      const result = await addContainerSlotAction(selectedGroup.id, {
        slotIndex: nextIndex,
        label: newSlotLabel.trim(),
        volumeMl: newSlotVolume ? parseFloat(newSlotVolume) : undefined,
      });
      if (result.success) {
        setNewSlotLabel("");
        setNewSlotVolume("");
        await refreshSelectedGroup();
      }
    } finally {
      setSlotSaving(false);
    }
  };

  // 부속품 추가
  const handleAddAccessory = async () => {
    if (!selectedGroup || !newAccName.trim()) return;
    setAccSaving(true);
    try {
      const result = await addContainerAccessoryAction(selectedGroup.id, {
        name: newAccName.trim(),
        description: newAccDesc.trim() || undefined,
      });
      if (result.success) {
        setNewAccName("");
        setNewAccDesc("");
        await refreshSelectedGroup();
      }
    } finally {
      setAccSaving(false);
    }
  };

  // 상세 새로고침
  const refreshSelectedGroup = async () => {
    fetchData(pagination.page);
    // items에서 다시 찾기 위해 짧은 딜레이 후 재조회
    if (selectedGroup) {
      const result = await getContainerGroupsAction({
        page: 1, limit: 200, sortBy: "name", sortOrder: "asc",
      });
      if (result.success) {
        const found = (result.data.items as unknown as GroupRow[]).find((g) => g.id === selectedGroup.id);
        if (found) setSelectedGroup(found);
      }
    }
  };

  // 삭제 처리
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    if (type === "group") {
      const result = await deleteContainerGroupAction(id);
      if (result.success) {
        if (selectedGroup?.id === id) setSelectedGroup(null);
        fetchData(pagination.page);
      }
    } else if (type === "slot") {
      const result = await deleteContainerSlotAction(id);
      if (result.success) await refreshSelectedGroup();
    } else if (type === "accessory") {
      const result = await deleteContainerAccessoryAction(id);
      if (result.success) await refreshSelectedGroup();
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">용기 관리</h1>
        <p className="text-sm text-gray-500">용기 그룹, 슬롯(칸), 부속품을 관리합니다</p>
      </div>

      {/* 검색 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="그룹명, 코드로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          용기 그룹 등록
        </Button>
      </div>

      {/* 생성 폼 */}
      {showCreateForm && (
        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">용기 그룹명</Label>
              <Input
                placeholder="예: 3칸 도시락, 5칸 식판"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-9"
              />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              등록
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreateForm(false); setNewGroupName(""); }}>
              취소
            </Button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>그룹명</TableHead>
              <TableHead className="w-[80px] text-center">슬롯 수</TableHead>
              <TableHead className="w-[80px] text-center">부속품</TableHead>
              <TableHead className="w-[100px]">등록일</TableHead>
              <TableHead className="w-[80px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  등록된 용기 그룹이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedGroup(item)}
                >
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>
                    {editingGroupId === item.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          className="h-7 text-sm"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                        />
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleUpdate}>저장</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingGroupId(null)}>취소</Button>
                      </div>
                    ) : (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {item.slots.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.accessories.length > 0 ? (
                      <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {item.accessories.length}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditingGroupId(item.id); setEditingGroupName(item.name); }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setDeleteTarget({ type: "group", id: item.id, name: item.name })}
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
            총 {pagination.total}건
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchData(pagination.page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════ 상세 다이얼로그 ══════ */}
      <Dialog open={!!selectedGroup} onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Box className="h-5 w-5 text-blue-600" />
                  <span>{selectedGroup.name}</span>
                  <span className="text-sm font-mono text-gray-400">{selectedGroup.code}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* ── 슬롯 관리 ── */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">슬롯 (칸)</h3>

                  {selectedGroup.slots.length > 0 && (
                    <div className="rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px] text-xs">인덱스</TableHead>
                            <TableHead className="text-xs">라벨</TableHead>
                            <TableHead className="text-xs text-right">용량(ml)</TableHead>
                            <TableHead className="w-[40px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroup.slots.map((slot) => (
                            <TableRow key={slot.id}>
                              <TableCell className="text-xs font-mono">{slot.slotIndex}</TableCell>
                              <TableCell className="text-xs font-medium">{slot.label}</TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {slot.volumeMl ?? "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  onClick={() => setDeleteTarget({ type: "slot", id: slot.id, name: slot.label })}
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

                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">라벨</Label>
                      <Input
                        placeholder="예: 밥, 국, 반찬1"
                        className="h-8 text-xs"
                        value={newSlotLabel}
                        onChange={(e) => setNewSlotLabel(e.target.value)}
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs">용량(ml)</Label>
                      <Input
                        type="number" placeholder="선택"
                        className="h-8 text-xs"
                        value={newSlotVolume}
                        onChange={(e) => setNewSlotVolume(e.target.value)}
                      />
                    </div>
                    <Button size="sm" className="h-8 text-xs" onClick={handleAddSlot} disabled={slotSaving}>
                      {slotSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                      추가
                    </Button>
                  </div>
                </div>

                {/* ── 부속품 관리 ── */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">부속품</h3>

                  {selectedGroup.accessories.length > 0 && (
                    <div className="rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">부속품명</TableHead>
                            <TableHead className="text-xs">설명</TableHead>
                            <TableHead className="w-[40px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroup.accessories.map((acc) => (
                            <TableRow key={acc.id}>
                              <TableCell className="text-xs font-medium">{acc.name}</TableCell>
                              <TableCell className="text-xs text-gray-400">{acc.description || "-"}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  onClick={() => setDeleteTarget({ type: "accessory", id: acc.id, name: acc.name })}
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

                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">부속품명</Label>
                      <Input
                        placeholder="예: 뚜껑, 수저세트"
                        className="h-8 text-xs"
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">설명</Label>
                      <Input
                        placeholder="선택"
                        className="h-8 text-xs"
                        value={newAccDesc}
                        onChange={(e) => setNewAccDesc(e.target.value)}
                      />
                    </div>
                    <Button size="sm" className="h-8 text-xs" onClick={handleAddAccessory} disabled={accSaving}>
                      {accSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                      추가
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteTarget?.name}&apos;을(를) 삭제하시겠습니까?
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
    </div>
  );
}
