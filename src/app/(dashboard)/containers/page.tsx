"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
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
  getContainerGroupsAction,
  getContainerGroupByIdAction,
  createContainerGroupAction,
  updateContainerGroupAction,
  deleteContainerGroupAction,
  addContainerSlotAction,
  updateContainerSlotAction,
  deleteContainerSlotAction,
} from "@/features/container/actions/container.action";
import {
  Plus, Trash2, Pencil, Search, ChevronLeft, ChevronRight,
  Loader2, ChevronDown, ChevronUp, Save, X,
} from "lucide-react";

type SlotRow = { id: string; slotIndex: number; label: string; volumeMl: number | null };
type GroupRow = {
  id: string; name: string; code: string;
  createdAt: string; updatedAt: string;
  slots: SlotRow[];
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

  // 아코디언 (행별 슬롯 펼치기)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // 슬롯 추가 모달
  const [addSlotGroupId, setAddSlotGroupId] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotVolume, setNewSlotVolume] = useState("");
  const [slotSaving, setSlotSaving] = useState(false);

  // 슬롯 수정
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState("");
  const [editingSlotVolume, setEditingSlotVolume] = useState("");
  const [slotUpdating, setSlotUpdating] = useState(false);

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string; groupId?: string } | null>(null);

  // 에러 메시지
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

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

  // ── 그룹 새로고침 (단건) ──
  const refreshGroup = async (groupId: string) => {
    try {
      const result = await getContainerGroupByIdAction(groupId);
      if (result.success) {
        const updated = result.data as unknown as GroupRow;
        setItems((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, slots: updated.slots, name: updated.name } : g
          )
        );
      }
    } catch {
      // 삭제된 경우
    }
  };

  // ── 그룹 생성 ──
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

  // ── 그룹 수정 ──
  const handleUpdate = async () => {
    if (!editingGroupId || !editingGroupName.trim()) return;
    setSaving(true);
    try {
      const result = await updateContainerGroupAction(editingGroupId, { name: editingGroupName.trim() });
      if (result.success) {
        setEditingGroupId(null);
        setEditingGroupName("");
        fetchData(pagination.page);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── 슬롯 추가 ──
  const handleAddSlot = async () => {
    if (!addSlotGroupId || !newSlotName.trim()) return;
    setSlotSaving(true);
    const targetGroupId = addSlotGroupId;
    try {
      const result = await addContainerSlotAction(targetGroupId, {
        label: newSlotName.trim(),
        volumeMl: newSlotVolume ? parseFloat(newSlotVolume) : undefined,
      });
      if (result.success) {
        setNewSlotName("");
        setNewSlotVolume("");
        setAddSlotGroupId(null);
        await refreshGroup(targetGroupId);
      } else {
        setErrorMessage(result.error?.message ?? "슬롯 추가에 실패했습니다");
      }
    } finally {
      setSlotSaving(false);
    }
  };

  // ── 슬롯 수정 ──
  const handleUpdateSlot = async () => {
    if (!editingSlotId) return;
    setSlotUpdating(true);
    try {
      const input: Record<string, unknown> = {};
      if (editingSlotName.trim()) input.label = editingSlotName.trim();
      if (editingSlotVolume !== "") input.volumeMl = parseFloat(editingSlotVolume) || null;
      else input.volumeMl = null;

      const result = await updateContainerSlotAction(editingSlotId, input);
      if (result.success) {
        setEditingSlotId(null);
        if (expandedGroupId) await refreshGroup(expandedGroupId);
      }
    } finally {
      setSlotUpdating(false);
    }
  };

  // ── 삭제 처리 ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, groupId } = deleteTarget;
    if (type === "group") {
      const result = await deleteContainerGroupAction(id);
      if (result.success) {
        if (expandedGroupId === id) setExpandedGroupId(null);
        fetchData(pagination.page);
      }
    } else if (type === "slot") {
      const result = await deleteContainerSlotAction(id);
      if (result.success && groupId) {
        await refreshGroup(groupId);
      }
    }
    setDeleteTarget(null);
  };

  // ── 아코디언 토글 ──
  const toggleExpand = (groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
    setEditingSlotId(null);
  };

  // ── 슬롯 확장 행 렌더링 ──
  const renderSlotExpansion = (group: GroupRow) => (
    <TableRow>
      <TableCell colSpan={7} className="p-0">
        <div className="border-t border-blue-100 bg-blue-50/30 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              슬롯 구성
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setAddSlotGroupId(group.id);
                setNewSlotName("");
                setNewSlotVolume("");
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              슬롯 추가
            </Button>
          </div>

          {group.slots.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-3">
              등록된 슬롯이 없습니다. 슬롯을 추가해 주세요.
            </p>
          ) : (
            <div className="rounded border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-xs">번호</TableHead>
                    <TableHead className="text-xs">슬롯명</TableHead>
                    <TableHead className="w-[120px] text-xs text-right">용량(ml)</TableHead>
                    <TableHead className="w-[100px] text-xs text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.slots.map((slot) => (
                    <TableRow key={slot.id}>
                      {editingSlotId === slot.id ? (
                        <>
                          <TableCell className="text-xs font-mono text-gray-400">
                            {slot.slotIndex}
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-7 text-xs"
                              value={editingSlotName}
                              onChange={(e) => setEditingSlotName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleUpdateSlot()}
                              autoFocus
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-7 w-24 text-xs text-right ml-auto"
                              value={editingSlotVolume}
                              onChange={(e) => setEditingSlotVolume(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleUpdateSlot()}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6"
                                onClick={handleUpdateSlot}
                                disabled={slotUpdating}
                              >
                                {slotUpdating
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Save className="h-3 w-3 text-green-600" />
                                }
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => setEditingSlotId(null)}
                              >
                                <X className="h-3 w-3 text-gray-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-xs font-mono">{slot.slotIndex}</TableCell>
                          <TableCell className="text-xs font-medium">{slot.label}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {slot.volumeMl != null ? `${slot.volumeMl}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => {
                                  setEditingSlotId(slot.id);
                                  setEditingSlotName(slot.label);
                                  setEditingSlotVolume(slot.volumeMl != null ? String(slot.volumeMl) : "");
                                }}
                              >
                                <Pencil className="h-3 w-3 text-gray-400" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => setDeleteTarget({ type: "slot", id: slot.id, name: slot.label, groupId: group.id })}
                              >
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">용기 관리</h1>
        <p className="text-sm text-gray-500">
          용기 그룹과 슬롯(칸)을 관리합니다. 부속품(뚜껑, 띠지 등)은 부자재 관리에서 처리합니다.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreateForm(false);
                setNewGroupName("");
              }}
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {/* 테이블 (아코디언 행 포함) */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>그룹명</TableHead>
              <TableHead className="w-[80px] text-center">슬롯 수</TableHead>
              <TableHead className="w-[200px]">슬롯 구성</TableHead>
              <TableHead className="w-[100px]">등록일</TableHead>
              <TableHead className="w-[80px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                  등록된 용기 그룹이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isExpanded = expandedGroupId === item.id;
                return (
                  <Fragment key={item.id}>
                    {/* ── 그룹 행 ── */}
                    <TableRow
                      className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? "bg-blue-50/40" : ""}`}
                      onClick={() => toggleExpand(item.id)}
                    >
                      <TableCell className="w-[40px] px-2">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-blue-500" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />
                        }
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell>
                        {editingGroupId === item.id ? (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              className="h-7 text-sm"
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                            />
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleUpdate}>
                              저장
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingGroupId(null)}>
                              취소
                            </Button>
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
                      <TableCell>
                        {item.slots.length > 0 ? (
                          <span className="text-xs text-gray-500">
                            {item.slots.map((s) => s.label).join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">미설정</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => {
                              setEditingGroupId(item.id);
                              setEditingGroupName(item.name);
                            }}
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

                    {/* ── 슬롯 확장 행 (테이블 내부) ── */}
                    {isExpanded && renderSlotExpansion(item)}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">총 {pagination.total}건</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchData(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchData(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════ 슬롯 추가 모달 ══════ */}
      <Dialog
        open={!!addSlotGroupId}
        onOpenChange={(open) => { if (!open) setAddSlotGroupId(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>슬롯 추가</DialogTitle>
            <DialogDescription>
              새 슬롯을 추가합니다. 번호는 자동으로 부여됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-sm">슬롯명</Label>
              <Input
                placeholder="예: 밥, 국, 반찬1, 반찬2"
                value={newSlotName}
                onChange={(e) => setNewSlotName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSlot()}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">용량 (ml, 선택)</Label>
              <Input
                type="number"
                placeholder="예: 300"
                value={newSlotVolume}
                onChange={(e) => setNewSlotVolume(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSlot()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddSlotGroupId(null)}>
                취소
              </Button>
              <Button onClick={handleAddSlot} disabled={slotSaving || !newSlotName.trim()}>
                {slotSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteTarget?.name}&apos;을(를) 삭제하시겠습니까?
              {deleteTarget?.type === "group" && " 하위 슬롯도 함께 삭제됩니다."}
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
