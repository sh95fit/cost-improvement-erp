// src/app/(dashboard)/containers/page.tsx
"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getContainerGroupsAction,
  getContainerGroupByIdAction,
  addContainerSlotAction,
  updateContainerSlotAction,
  deleteContainerSlotAction,
  checkContainerGroupDependencyAction,
} from "@/features/container/actions/container.action";
import {
  Search, ChevronLeft, ChevronRight,
  Loader2, ChevronDown, ChevronUp, Save, X, Plus, Trash2, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";

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

  // 아코디언 확장
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // 슬롯 추가
  const [addSlotGroupId, setAddSlotGroupId] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotVolume, setNewSlotVolume] = useState("");
  const [slotSaving, setSlotSaving] = useState(false);

  // 슬롯 수정
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState("");
  const [editingSlotVolume, setEditingSlotVolume] = useState("");
  const [slotUpdating, setSlotUpdating] = useState(false);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string;
    id: string;
    name: string;
    groupId?: string;
    dependencyMessage?: string;
  } | null>(null);

  // ── 목록 조회 ──
  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getContainerGroupsAction({
        page,
        limit: 20,
        search: search.trim() || undefined,
        sortBy: "name",
        sortOrder: "asc",
      });
      if (result.success) {
        const fetchedItems = (result.data.items ?? []) as unknown as GroupRow[];
        setItems(fetchedItems);
        setPagination(result.data.pagination);
      } else {
        toast.error("용기 목록 조회에 실패했습니다");
        setItems([]);
      }
    } catch (err) {
      logger.error("[ContainersPage.fetchData] 실패:", err);
      toast.error("용기 목록 조회 중 오류가 발생했습니다");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // ── 단일 그룹 새로고침 ──
  const refreshGroup = async (groupId: string) => {
    try {
      const result = await getContainerGroupByIdAction(groupId);
      if (result.success && result.data) {
        const updated = result.data as unknown as GroupRow;
        setItems((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, slots: updated.slots, name: updated.name } : g))
        );
      }
    } catch (err) {
      logger.error("[ContainersPage.refreshGroup] 실패:", err);
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
        toast.success("슬롯이 추가되었습니다");
        setNewSlotName("");
        setNewSlotVolume("");
        setAddSlotGroupId(null);
        await refreshGroup(targetGroupId);
      } else {
        toast.error(result.error?.message ?? "슬롯 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[ContainersPage.handleAddSlot] 실패:", err);
      toast.error("슬롯 추가 중 오류가 발생했습니다");
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
        toast.success("슬롯이 수정되었습니다");
        setEditingSlotId(null);
        if (expandedGroupId) await refreshGroup(expandedGroupId);
      } else {
        toast.error(result.error?.message ?? "슬롯 수정에 실패했습니다");
      }
    } catch (err) {
      logger.error("[ContainersPage.handleUpdateSlot] 실패:", err);
      toast.error("슬롯 수정 중 오류가 발생했습니다");
    } finally {
      setSlotUpdating(false);
    }
  };

  // ── 삭제 확인 ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, groupId } = deleteTarget;
    try {
      if (type === "slot") {
        const result = await deleteContainerSlotAction(id);
        if (result.success) {
          toast.success("슬롯이 삭제되었습니다");
          if (groupId) await refreshGroup(groupId);
        } else {
          if (result.error?.code === "DEPENDENCY") {
            toast.error(result.error.message);
          } else {
            toast.error(result.error?.message ?? "슬롯 삭제에 실패했습니다");
          }
        }
      }
    } catch (err) {
      logger.error("[ContainersPage.handleConfirmDelete] 실패:", err);
      toast.error("삭제 중 오류가 발생했습니다");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">용기 관리</h1>
        <p className="text-sm text-gray-500">
          용기는 부자재 관리에서 등록합니다. 여기서는 슬롯을 관리할 수 있습니다.
        </p>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="용기명 또는 코드로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => fetchData(1)}>
          검색
        </Button>
      </div>

      {/* 목록 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded border p-8 text-center text-gray-500">
          <p>등록된 용기가 없습니다.</p>
          <p className="text-sm mt-1">부자재 관리에서 CONTAINER 타입으로 등록해 주세요.</p>
        </div>
      ) : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>용기명</TableHead>
                <TableHead>코드</TableHead>
                <TableHead>슬롯 수</TableHead>
                <TableHead>등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      setExpandedGroupId(expandedGroupId === item.id ? null : item.id)
                    }
                  >
                    <TableCell>
                      {expandedGroupId === item.id ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">
                      {item.code}
                    </TableCell>
                    <TableCell>{item.slots?.length ?? 0}개</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                  </TableRow>

                  {/* 아코디언: 슬롯 관리 */}
                  {expandedGroupId === item.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-gray-50/50 p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">슬롯 목록</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddSlotGroupId(item.id);
                                setNewSlotName("");
                                setNewSlotVolume("");
                              }}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              슬롯 추가
                            </Button>
                          </div>

                          {/* 슬롯 추가 폼 */}
                          {addSlotGroupId === item.id && (
                            <div className="rounded border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">슬롯명</Label>
                                  <Input
                                    value={newSlotName}
                                    onChange={(e) => setNewSlotName(e.target.value)}
                                    placeholder="예: 밥칸"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">용량 (ml, 선택)</Label>
                                  <Input
                                    value={newSlotVolume}
                                    onChange={(e) => setNewSlotVolume(e.target.value)}
                                    placeholder="예: 300"
                                    type="number"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleAddSlot} disabled={slotSaving || !newSlotName.trim()}>
                                  {slotSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                  추가
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setAddSlotGroupId(null)}>
                                  취소
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* 슬롯 테이블 */}
                          {(item.slots?.length ?? 0) === 0 ? (
                            <p className="py-2 text-center text-sm text-gray-400">슬롯이 없습니다.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">인덱스</TableHead>
                                  <TableHead className="text-xs">슬롯명</TableHead>
                                  <TableHead className="text-xs">용량(ml)</TableHead>
                                  <TableHead className="w-[80px]" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {item.slots.map((slot) => (
                                  <TableRow key={slot.id}>
                                    {editingSlotId === slot.id ? (
                                      <>
                                        <TableCell className="text-xs font-mono">{slot.slotIndex}</TableCell>
                                        <TableCell>
                                          <Input
                                            value={editingSlotName}
                                            onChange={(e) => setEditingSlotName(e.target.value)}
                                            className="h-7 text-xs"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            value={editingSlotVolume}
                                            onChange={(e) => setEditingSlotVolume(e.target.value)}
                                            type="number"
                                            className="h-7 text-xs"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex gap-1">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={handleUpdateSlot}
                                              disabled={slotUpdating}
                                            >
                                              {slotUpdating ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Save className="h-3 w-3" />
                                              )}
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={() => setEditingSlotId(null)}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell className="text-xs font-mono">{slot.slotIndex}</TableCell>
                                        <TableCell className="text-xs">{slot.label}</TableCell>
                                        <TableCell className="text-xs text-gray-500">
                                          {slot.volumeMl ?? "-"}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex gap-1">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSlotId(slot.id);
                                                setEditingSlotName(slot.label);
                                                setEditingSlotVolume(slot.volumeMl?.toString() ?? "");
                                              }}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 text-red-500"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteTarget({
                                                  type: "slot",
                                                  id: slot.id,
                                                  name: slot.label,
                                                  groupId: item.id,
                                                });
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>슬롯 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; 슬롯을 삭제하시겠습니까?
              {deleteTarget?.dependencyMessage && (
                <span className="block mt-2 text-red-600">
                  ⚠️ {deleteTarget.dependencyMessage}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
