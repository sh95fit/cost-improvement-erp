"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getServingSetsByVariantAction,
  createServingSetWithAutoVersionAction,
  updateServingSetStatusAction,
  deleteServingSetAction,
  addServingSetItemAction,
  updateServingSetItemAction,
  deleteServingSetItemAction,
  updateBaseWeightAction,
  getContainerGroupsAction,
} from "../actions/serving-set.action";
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  Archive,
  Package,
  Pencil,
} from "lucide-react";

type SlotInfo = { slotIndex: number; label: string };

type ContainerGroupOption = {
  id: string;
  name: string;
  code: string;
  slots: SlotInfo[];
};

type ServingSetItemRow = {
  id: string;
  containerGroupId: string;
  slotIndex: number;
  servingWeightG: number;
  note: string | null;
  sortOrder: number;
  containerGroup: {
    id: string;
    name: string;
    code: string;
    slots: SlotInfo[];
  };
};

type ServingSetRow = {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: ServingSetItemRow[];
};

type VariantInfo = {
  id: string;
  variantName: string;
  baseWeightG: number | null;
};

type Props = {
  variants: VariantInfo[];
  onVariantUpdated: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안",
  ACTIVE: "사용중",
  ARCHIVED: "보관",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-orange-50 text-orange-700",
};

export function ServingSetTab({ variants, onVariantUpdated }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id ?? ""
  );
  const [sets, setSets] = useState<ServingSetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [containerGroups, setContainerGroups] = useState<ContainerGroupOption[]>([]);

  // 기준 중량 편집
  const [editingBaseWeight, setEditingBaseWeight] = useState(false);
  const [baseWeightInput, setBaseWeightInput] = useState("");
  const [baseWeightSaving, setBaseWeightSaving] = useState(false);

  // 케이스 추가 폼
  const [addingToSetId, setAddingToSetId] = useState<string | null>(null);
  const [newCgId, setNewCgId] = useState("");
  const [newSlotIndex, setNewSlotIndex] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  // 인라인 중량 편집
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);

  const loadSets = useCallback(async () => {
    if (!selectedVariantId) return;
    setLoading(true);
    try {
      const result = await getServingSetsByVariantAction(selectedVariantId);
      if (result.success) {
        setSets(result.data as unknown as ServingSetRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedVariantId]);

  const loadContainerGroups = useCallback(async () => {
    const result = await getContainerGroupsAction();
    if (result.success) {
      setContainerGroups(result.data);
    }
  }, []);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  useEffect(() => {
    loadContainerGroups();
  }, [loadContainerGroups]);

  // 선택된 용기 그룹의 슬롯 목록
  const selectedCgSlots = containerGroups.find((cg) => cg.id === newCgId)?.slots ?? [];

  // ── 기준 중량 저장 ──
  const handleSaveBaseWeight = async () => {
    if (!selectedVariantId) return;
    setBaseWeightSaving(true);
    try {
      const val = parseFloat(baseWeightInput);
      const result = await updateBaseWeightAction(selectedVariantId, {
        baseWeightG: isNaN(val) ? null : val,
      });
      if (result.success) {
        setEditingBaseWeight(false);
        onVariantUpdated();
      }
    } finally {
      setBaseWeightSaving(false);
    }
  };

  // ── 새 버전 생성 ──
  const handleCreateSet = async () => {
    if (!selectedVariantId) return;
    const result = await createServingSetWithAutoVersionAction({
      recipeVariantId: selectedVariantId,
    });
    if (result.success) {
      loadSets();
    }
  };

  // ── 상태 변경 ──
  const handleStatus = async (setId: string, status: string) => {
    const result = await updateServingSetStatusAction(setId, { status });
    if (result.success) {
      loadSets();
    }
  };

  // ── 세트 삭제 ──
  const handleDeleteSet = async (setId: string) => {
    const result = await deleteServingSetAction(setId);
    if (result.success) {
      loadSets();
    }
  };

  // ── 케이스(아이템) 추가 ──
  const handleAddItem = async (setId: string) => {
    if (!newCgId || newSlotIndex === "" || !newWeight) return;
    setItemSaving(true);
    try {
      const result = await addServingSetItemAction(setId, {
        containerGroupId: newCgId,
        slotIndex: Number(newSlotIndex),
        servingWeightG: Number(newWeight),
      });
      if (result.success) {
        setAddingToSetId(null);
        setNewCgId("");
        setNewSlotIndex("");
        setNewWeight("");
        loadSets();
      }
    } finally {
      setItemSaving(false);
    }
  };

  // ── 인라인 중량 수정 ──
  const handleInlineEdit = async (itemId: string) => {
    if (!editWeight) return;
    setEditSaving(true);
    try {
      const result = await updateServingSetItemAction(itemId, {
        servingWeightG: Number(editWeight),
      });
      if (result.success) {
        setEditingItemId(null);
        setEditWeight("");
        loadSets();
      }
    } finally {
      setEditSaving(false);
    }
  };

  // ── 아이템 삭제 ──
  const handleDeleteItem = async (itemId: string) => {
    const result = await deleteServingSetItemAction(itemId);
    if (result.success) {
      loadSets();
    }
  };

  // 슬롯 라벨 찾기 헬퍼
  const getSlotLabel = (item: ServingSetItemRow): string => {
    const slot = item.containerGroup.slots.find(
      (s) => s.slotIndex === item.slotIndex
    );
    return slot?.label ?? `Slot${item.slotIndex}`;
  };

  // ACTIVE 세트를 맨 위에 정렬
  const sortedSets = [...sets].sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
    return b.version - a.version;
  });

  if (variants.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        변형을 먼저 등록해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* 변형 선택 + 기준 중량 */}
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">변형 선택</Label>
          <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.variantName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">1인분 기준 중량</Label>
          {editingBaseWeight ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0.1}
                step="any"
                className="h-9 w-[100px]"
                value={baseWeightInput}
                onChange={(e) => setBaseWeightInput(e.target.value)}
                placeholder="g"
              />
              <Button
                size="sm"
                className="h-9"
                onClick={handleSaveBaseWeight}
                disabled={baseWeightSaving}
              >
                {baseWeightSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9"
                onClick={() => setEditingBaseWeight(false)}
              >
                취소
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-9 items-center rounded-md border bg-gray-50 px-3 text-sm font-mono">
                {selectedVariant?.baseWeightG
                  ? `${selectedVariant.baseWeightG}g`
                  : "미설정"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => {
                  setBaseWeightInput(
                    selectedVariant?.baseWeightG?.toString() ?? ""
                  );
                  setEditingBaseWeight(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-9"
          onClick={handleCreateSet}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          새 버전
        </Button>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* 세트 목록 */}
      {!loading && sortedSets.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          서빙 중량 세트가 없습니다. 새 버전을 추가해 주세요.
        </p>
      )}

      {!loading &&
        sortedSets.map((set) => (
          <div
            key={set.id}
            className={`rounded-lg border p-4 space-y-3 ${
              set.status === "ACTIVE"
                ? "border-green-200 bg-green-50/30"
                : "bg-white"
            }`}
          >
            {/* 세트 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold">Version {set.version}</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[set.status] ?? "bg-gray-100"
                  }`}
                >
                  {STATUS_LABELS[set.status] ?? set.status}
                </span>
                <span className="text-xs text-gray-400">
                  수정 {new Date(set.updatedAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {set.status === "DRAFT" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-green-600"
                    onClick={() => handleStatus(set.id, "ACTIVE")}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    확정
                  </Button>
                )}
                {set.status === "ACTIVE" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-orange-600"
                    onClick={() => handleStatus(set.id, "ARCHIVED")}
                  >
                    <Archive className="mr-1 h-3 w-3" />
                    보관
                  </Button>
                )}
                {set.status !== "ACTIVE" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDeleteSet(set.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            </div>

            {/* 아이템 목록 */}
            {set.items.length > 0 ? (
              <div className="space-y-1.5">
                {set.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md bg-white px-3 py-2 border text-sm"
                  >
                    <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-700 min-w-[80px]">
                      {item.containerGroup.name}
                    </span>
                    <span className="text-gray-400 mx-1">›</span>
                    <span className="text-gray-600 min-w-[80px]">
                      {getSlotLabel(item)}
                    </span>
                    <span className="text-gray-400 mx-1">:</span>

                    {/* 인라인 중량 편집 */}
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0.1}
                          step="any"
                          className="h-7 w-[70px] text-xs"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineEdit(item.id);
                            if (e.key === "Escape") setEditingItemId(null);
                          }}
                          autoFocus
                        />
                        <span className="text-xs text-gray-500">g</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleInlineEdit(item.id)}
                          disabled={editSaving}
                        >
                          {editSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3 text-green-600" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="font-mono font-semibold text-blue-700 cursor-pointer hover:underline"
                        onClick={() => {
                          if (set.status === "DRAFT") {
                            setEditingItemId(item.id);
                            setEditWeight(item.servingWeightG.toString());
                          }
                        }}
                        title={set.status === "DRAFT" ? "클릭하여 수정" : ""}
                      >
                        {item.servingWeightG}g
                      </span>
                    )}

                    <div className="ml-auto">
                      {set.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400 py-2">
                용기-슬롯이 없습니다
              </p>
            )}

            {/* 케이스 추가 (DRAFT만) */}
            {set.status === "DRAFT" && (
              <>
                {addingToSetId === set.id ? (
                  <div className="rounded-md border border-dashed border-blue-300 bg-blue-50/30 p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">용기 그룹</Label>
                        <Select
                          value={newCgId}
                          onValueChange={(v) => {
                            setNewCgId(v);
                            setNewSlotIndex("");
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="용기 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {containerGroups.map((cg) => (
                              <SelectItem key={cg.id} value={cg.id}>
                                {cg.name} ({cg.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">슬롯</Label>
                        <Select
                          value={newSlotIndex}
                          onValueChange={setNewSlotIndex}
                          disabled={!newCgId}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="슬롯 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedCgSlots.map((slot) => (
                              <SelectItem
                                key={slot.slotIndex}
                                value={slot.slotIndex.toString()}
                              >
                                Slot{slot.slotIndex} - {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">중량 (g)</Label>
                        <Input
                          type="number"
                          min={0.1}
                          step="any"
                          placeholder="40"
                          className="h-8 text-xs"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem(set.id);
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAddItem(set.id)}
                        disabled={itemSaving}
                      >
                        {itemSaving && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        추가
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setAddingToSetId(null)}
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
                    onClick={() => setAddingToSetId(set.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    케이스 추가
                  </Button>
                )}
              </>
            )}
          </div>
        ))}
    </div>
  );
}
