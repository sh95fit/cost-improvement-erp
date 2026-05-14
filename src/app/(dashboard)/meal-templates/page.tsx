// src/app/(dashboard)/meal-templates/page.tsx
"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  getMealTemplatesAction,
  getMealTemplateByIdAction,
  createMealTemplateAction,
  updateMealTemplateAction,
  deleteMealTemplateAction,
  addMealTemplateContainerAction,
  updateMealTemplateContainerAction,
  deleteMealTemplateContainerAction,
  addMealTemplateAccessoryAction,
  updateMealTemplateAccessoryAction,
  deleteMealTemplateAccessoryAction,
} from "@/features/meal-template/actions/meal-template.action";
import { getContainerGroupsAction } from "@/features/container/actions/container.action";
import { getSubsidiariesByTypeAction } from "@/features/material/actions/material.action";
import {
  Plus, Trash2, Pencil, Search, ChevronLeft, ChevronRight,
  Loader2, ChevronDown, ChevronUp, Save, X, Package,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import { loadAllPages } from "@/lib/action-helpers";
import type { PaginatedFetcher } from "@/lib/action-helpers";

// ── v5 타입 ──
type SubsidiaryOption = { id: string; name: string; code: string };

type ContainerRow = {
  id: string;
  subsidiaryMasterId: string;
  sortOrder: number;
  subsidiaryMaster: SubsidiaryOption;
};

type AccessoryRow = {
  id: string;
  subsidiaryMasterId: string;
  consumptionType: string;
  fixedQuantity: number | null;
  isRequired: boolean;
  subsidiaryMaster: SubsidiaryOption;
};

type TemplateRow = {
  id: string;
  name: string;
  containers: ContainerRow[];
  accessories: AccessoryRow[];
  _count: { containers: number; accessories: number };
  createdAt: string;
  updatedAt: string;
};

export default function MealTemplatesPage() {
  // ── 목록 상태 ──
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // ── 부자재 옵션 (CONTAINER / ACCESSORY+CONSUMABLE) ──
  const [containerOptions, setContainerOptions] = useState<SubsidiaryOption[]>([]);
  const [accessoryOptions, setAccessoryOptions] = useState<SubsidiaryOption[]>([]);

  // ── 템플릿 생성/수정 ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // ── 아코디언 ──
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── 용기(Container) 추가 ──
  const [addContainerTemplateId, setAddContainerTemplateId] = useState<string | null>(null);
  const [newContainerSubId, setNewContainerSubId] = useState("");
  const [containerSaving, setContainerSaving] = useState(false);

  // ── 악세서리 추가 ──
  const [addAccTemplateId, setAddAccTemplateId] = useState<string | null>(null);
  const [newAccSubId, setNewAccSubId] = useState("");
  const [newAccConsumptionType, setNewAccConsumptionType] = useState("PER_MEAL_COUNT");
  const [newAccFixedQty, setNewAccFixedQty] = useState("");
  const [newAccRequired, setNewAccRequired] = useState(false);
  const [accSaving, setAccSaving] = useState(false);

  // ── 악세서리 수정 ──
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editingAccConsumptionType, setEditingAccConsumptionType] = useState("PER_MEAL_COUNT");
  const [editingAccFixedQty, setEditingAccFixedQty] = useState("");
  const [editingAccRequired, setEditingAccRequired] = useState(false);
  const [accUpdating, setAccUpdating] = useState(false);

  // ── 삭제 확인 ──
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "template" | "container" | "accessory";
    id: string;
    name: string;
    templateId?: string;
  } | null>(null);

  // ══════════════════════════════════════
  // 데이터 로딩
  // ══════════════════════════════════════

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getMealTemplatesAction({
        page,
        limit: 20,
        search: search.trim() || undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      if (result.success) {
        setItems(result.data.items as unknown as TemplateRow[]);
        setPagination(result.data.pagination);
      } else {
        toast.error("식단 템플릿 목록 조회에 실패했습니다");
        setItems([]);
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.fetchData] 실패:", err);
      toast.error("식단 템플릿 목록 조회 중 오류가 발생했습니다");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadOptions = useCallback(async () => {
    try {
      // CONTAINER 타입 부자재 로딩 (getContainerGroupsAction = SubsidiaryMaster CONTAINER)
      const { items: cItems } = await loadAllPages<SubsidiaryOption>(
        getContainerGroupsAction as PaginatedFetcher<SubsidiaryOption>,
        "name"
      );
      setContainerOptions(cItems);

      // ACCESSORY + CONSUMABLE 타입 부자재 로딩 (악세서리용)
      const [accResult, conResult] = await Promise.all([
        getSubsidiariesByTypeAction("ACCESSORY"),
        getSubsidiariesByTypeAction("CONSUMABLE"),
      ]);
      const accItems = (accResult.success ? accResult.data : []) as SubsidiaryOption[];
      const conItems = (conResult.success ? conResult.data : []) as SubsidiaryOption[];
      setAccessoryOptions([...accItems, ...conItems]);
    } catch (err) {
      logger.error("[MealTemplatesPage.loadOptions] 실패:", err);
    }
  }, []);

  useEffect(() => {
    fetchData(1);
    loadOptions();
  }, [fetchData, loadOptions]);

  const refreshTemplate = async (templateId: string) => {
    try {
      const result = await getMealTemplateByIdAction(templateId);
      if (result.success && result.data) {
        const updated = result.data as unknown as TemplateRow;
        setItems((prev) => prev.map((t) => (t.id === templateId ? updated : t)));
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.refreshTemplate] 실패:", err);
    }
  };

  // ══════════════════════════════════════
  // 템플릿 CRUD
  // ══════════════════════════════════════

  const openCreateDialog = () => {
    setFormName("");
    setEditingTemplate(null);
    setShowCreateDialog(true);
  };

  const openEditDialog = (tmpl: TemplateRow) => {
    setFormName(tmpl.name);
    setEditingTemplate(tmpl);
    setShowCreateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!formName.trim()) return;
    setFormSaving(true);
    try {
      if (editingTemplate) {
        const result = await updateMealTemplateAction(editingTemplate.id, {
          name: formName.trim(),
        });
        if (result.success) {
          toast.success("식단 템플릿이 수정되었습니다");
          setShowCreateDialog(false);
          fetchData(pagination.page);
        } else {
          toast.error(result.error?.message ?? "수정에 실패했습니다");
        }
      } else {
        const result = await createMealTemplateAction({
          name: formName.trim(),
        });
        if (result.success) {
          toast.success("식단 템플릿이 등록되었습니다");
          setShowCreateDialog(false);
          fetchData(1);
        } else {
          toast.error(result.error?.message ?? "생성에 실패했습니다");
        }
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.handleSaveTemplate] 실패:", err);
      toast.error("저장 중 오류가 발생했습니다");
    } finally {
      setFormSaving(false);
    }
  };

  // ══════════════════════════════════════
  // 용기(Container) CRUD
  // ══════════════════════════════════════

  const handleAddContainer = async () => {
    if (!addContainerTemplateId || !newContainerSubId) return;
    setContainerSaving(true);
    const templateId = addContainerTemplateId;
    try {
      const template = items.find((t) => t.id === templateId);
      const nextSort = template ? Math.max(0, ...template.containers.map((c) => c.sortOrder)) + 1 : 0;
      const result = await addMealTemplateContainerAction(templateId, {
        subsidiaryMasterId: newContainerSubId,
        sortOrder: nextSort,
      });
      if (result.success) {
        toast.success("용기가 추가되었습니다");
        setNewContainerSubId("");
        setAddContainerTemplateId(null);
        await refreshTemplate(templateId);
      } else {
        toast.error(result.error?.message ?? "용기 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.handleAddContainer] 실패:", err);
      toast.error("용기 추가 중 오류가 발생했습니다");
    } finally {
      setContainerSaving(false);
    }
  };

  const handleUpdateContainerSort = async (containerId: string, templateId: string, newSort: number, prevSort: number, inputEl: HTMLInputElement) => {
    const result = await updateMealTemplateContainerAction(containerId, { sortOrder: newSort });
    if (result.success) {
      toast.success("순서가 변경되었습니다");
      await refreshTemplate(templateId);
    } else {
      toast.error("순서 변경에 실패했습니다");
      inputEl.value = String(prevSort);
    }
  };

  // ══════════════════════════════════════
  // 악세서리 CRUD
  // ══════════════════════════════════════

  const handleAddAccessory = async () => {
    if (!addAccTemplateId || !newAccSubId) return;
    setAccSaving(true);
    const templateId = addAccTemplateId;
    try {
      const result = await addMealTemplateAccessoryAction(templateId, {
        subsidiaryMasterId: newAccSubId,
        consumptionType: newAccConsumptionType,
        fixedQuantity: newAccFixedQty ? parseFloat(newAccFixedQty) : undefined,
        isRequired: newAccRequired,
      });
      if (result.success) {
        toast.success("악세서리가 추가되었습니다");
        setNewAccSubId("");
        setNewAccConsumptionType("PER_MEAL_COUNT");
        setNewAccFixedQty("");
        setNewAccRequired(false);
        setAddAccTemplateId(null);
        await refreshTemplate(templateId);
      } else {
        toast.error(result.error?.message ?? "악세서리 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.handleAddAccessory] 실패:", err);
      toast.error("악세서리 추가 중 오류가 발생했습니다");
    } finally {
      setAccSaving(false);
    }
  };

  const handleUpdateAccessory = async () => {
    if (!editingAccId) return;
    setAccUpdating(true);
    try {
      const result = await updateMealTemplateAccessoryAction(editingAccId, {
        consumptionType: editingAccConsumptionType as "PER_MEAL_COUNT" | "FIXED_QUANTITY",
        fixedQuantity: editingAccFixedQty ? parseFloat(editingAccFixedQty) : undefined,
        isRequired: editingAccRequired,
      });
      if (result.success) {
        toast.success("악세서리가 수정되었습니다");
        setEditingAccId(null);
        if (expandedId) await refreshTemplate(expandedId);
      } else {
        toast.error(result.error?.message ?? "수정에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.handleUpdateAccessory] 실패:", err);
      toast.error("악세서리 수정 중 오류가 발생했습니다");
    } finally {
      setAccUpdating(false);
    }
  };

  // ══════════════════════════════════════
  // 삭제
  // ══════════════════════════════════════

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, templateId } = deleteTarget;
    try {
      if (type === "template") {
        const result = await deleteMealTemplateAction(id);
        if (result.success) {
          toast.success("식단 템플릿이 삭제되었습니다");
          if (expandedId === id) setExpandedId(null);
          fetchData(pagination.page);
        } else {
          toast.error(result.error?.message ?? "삭제에 실패했습니다");
        }
      } else if (type === "container") {
        const result = await deleteMealTemplateContainerAction(id);
        if (result.success) {
          toast.success("용기가 삭제되었습니다");
          if (templateId) await refreshTemplate(templateId);
        } else {
          toast.error(result.error?.message ?? "삭제에 실패했습니다");
        }
      } else if (type === "accessory") {
        const result = await deleteMealTemplateAccessoryAction(id);
        if (result.success) {
          toast.success("악세서리가 삭제되었습니다");
          if (templateId) await refreshTemplate(templateId);
        } else {
          toast.error(result.error?.message ?? "삭제에 실패했습니다");
        }
      }
    } catch (err) {
      logger.error("[MealTemplatesPage.handleConfirmDelete] 실패:", err);
      toast.error("삭제 중 오류가 발생했습니다");
    }
    setDeleteTarget(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingAccId(null);
  };

  // ══════════════════════════════════════
  // 렌더링
  // ══════════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">식단 템플릿</h1>
        <p className="text-sm text-gray-500">
          배식 용기와 악세서리 구성을 정의합니다. 식단 계획에서 템플릿을 선택하면 자동으로 적용됩니다.
        </p>
      </div>

      {/* 검색 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="템플릿명으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => fetchData(1)} variant="outline" size="sm">검색</Button>
        <Button onClick={openCreateDialog} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          템플릿 등록
        </Button>
      </div>

      {/* 메인 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>템플릿명</TableHead>
              <TableHead className="w-[80px] text-center">용기</TableHead>
              <TableHead className="w-[80px] text-center">악세서리</TableHead>
              <TableHead className="w-[100px]">등록일</TableHead>
              <TableHead className="w-[80px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    불러오는 중...
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  {search.trim()
                    ? `"${search}" 검색 결과가 없습니다`
                    : "등록된 식단 템플릿이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <Fragment key={item.id}>
                    <TableRow
                      className={`cursor-pointer transition-colors ${isExpanded ? "bg-purple-50/50 border-l-2 border-l-purple-400" : "hover:bg-gray-50"}`}
                      onClick={() => toggleExpand(item.id)}
                    >
                      <TableCell className="w-[40px] px-2">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-purple-500" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {item._count.containers}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                          {item._count.accessories}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="수정"
                            onClick={() => openEditDialog(item)}>
                            <Pencil className="h-3.5 w-3.5 text-gray-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="삭제"
                            onClick={() => setDeleteTarget({ type: "template", id: item.id, name: item.name })}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* 확장 영역 */}
                    {isExpanded && (
                      <TableRow className="bg-purple-50/20 hover:bg-purple-50/20">
                        <TableCell colSpan={6} className="p-0 border-t-0">
                          <div className="border-t border-purple-100 bg-purple-50/30 px-6 py-4 space-y-5">

                            {/* ── 용기(Container) 섹션 ── */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-600">
                                  용기 구성 ({item.containers.length}개)
                                </span>
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddContainerTemplateId(item.id);
                                    setNewContainerSubId("");
                                  }}>
                                  <Plus className="mr-1 h-3 w-3" /> 용기 추가
                                </Button>
                              </div>
                              {item.containers.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-3">등록된 용기가 없습니다.</p>
                              ) : (
                                <div className="rounded border bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[70px] text-xs">순서</TableHead>
                                        <TableHead className="text-xs">용기명</TableHead>
                                        <TableHead className="text-xs">코드</TableHead>
                                        <TableHead className="w-[60px] text-xs text-right">관리</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.containers.map((cont) => (
                                        <TableRow key={cont.id}>
                                          <TableCell className="text-xs font-mono text-gray-400">
                                            <Input
                                              type="number"
                                              defaultValue={cont.sortOrder}
                                              className="h-6 w-14 text-xs text-center"
                                              min={0}
                                              onClick={(e) => e.stopPropagation()}
                                              onBlur={(e) => {
                                                const newSort = parseInt(e.target.value, 10);
                                                if (isNaN(newSort) || newSort === cont.sortOrder) return;
                                                handleUpdateContainerSort(cont.id, item.id, newSort, cont.sortOrder, e.target);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell className="text-xs font-medium">
                                            <div className="flex items-center gap-1.5">
                                              <Package className="h-3.5 w-3.5 text-gray-400" />
                                              {cont.subsidiaryMaster.name}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-xs text-gray-400 font-mono">
                                            {cont.subsidiaryMaster.code}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" title="삭제"
                                              onClick={() => setDeleteTarget({
                                                type: "container",
                                                id: cont.id,
                                                name: cont.subsidiaryMaster.name,
                                                templateId: item.id,
                                              })}>
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

                            {/* ── 악세서리 섹션 ── */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-600">
                                  악세서리 ({item.accessories.length}개)
                                </span>
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddAccTemplateId(item.id);
                                    setNewAccSubId("");
                                    setNewAccConsumptionType("PER_MEAL_COUNT");
                                    setNewAccFixedQty("");
                                    setNewAccRequired(false);
                                  }}>
                                  <Plus className="mr-1 h-3 w-3" /> 악세서리 추가
                                </Button>
                              </div>
                              {item.accessories.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-3">등록된 악세서리가 없습니다.</p>
                              ) : (
                                <div className="rounded border bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">부자재명</TableHead>
                                        <TableHead className="w-[100px] text-xs">소비 모드</TableHead>
                                        <TableHead className="w-[80px] text-xs text-center">고정수량</TableHead>
                                        <TableHead className="w-[60px] text-xs text-center">필수</TableHead>
                                        <TableHead className="w-[80px] text-xs text-right">관리</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.accessories.map((acc) => (
                                        <TableRow key={acc.id}>
                                          {editingAccId === acc.id ? (
                                            <>
                                              <TableCell className="text-xs font-medium">
                                                {acc.subsidiaryMaster.name}
                                              </TableCell>
                                              <TableCell>
                                                <Select value={editingAccConsumptionType} onValueChange={setEditingAccConsumptionType}>
                                                  <SelectTrigger className="h-7 text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="PER_MEAL_COUNT">식수당</SelectItem>
                                                    <SelectItem value="FIXED_QUANTITY">고정수량</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {editingAccConsumptionType === "FIXED_QUANTITY" ? (
                                                  <Input
                                                    type="number"
                                                    value={editingAccFixedQty}
                                                    onChange={(e) => setEditingAccFixedQty(e.target.value)}
                                                    placeholder="수량"
                                                    className="h-7 w-20 text-xs mx-auto"
                                                    min={0}
                                                  />
                                                ) : (
                                                  <span className="text-xs text-gray-400">-</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <Switch checked={editingAccRequired} onCheckedChange={setEditingAccRequired} />
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                  <Button variant="ghost" size="icon" className="h-6 w-6"
                                                    onClick={handleUpdateAccessory} disabled={accUpdating}>
                                                    {accUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-green-600" />}
                                                  </Button>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6"
                                                    onClick={() => setEditingAccId(null)}>
                                                    <X className="h-3 w-3 text-gray-400" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </>
                                          ) : (
                                            <>
                                              <TableCell className="text-xs font-medium">
                                                {acc.subsidiaryMaster.name}
                                                <span className="ml-1 text-gray-400">({acc.subsidiaryMaster.code})</span>
                                              </TableCell>
                                              <TableCell className="text-xs text-gray-500">
                                                {acc.consumptionType === "PER_MEAL_COUNT" ? "식수당" : "고정수량"}
                                              </TableCell>
                                              <TableCell className="text-xs text-center">
                                                {acc.consumptionType === "FIXED_QUANTITY" ? (acc.fixedQuantity ?? 0) : "-"}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <span className={`text-xs ${acc.isRequired ? "text-green-600 font-medium" : "text-gray-400"}`}>
                                                  {acc.isRequired ? "필수" : "선택"}
                                                </span>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="수정"
                                                    onClick={() => {
                                                      setEditingAccId(acc.id);
                                                      setEditingAccConsumptionType(acc.consumptionType);
                                                      setEditingAccFixedQty(acc.fixedQuantity?.toString() ?? "");
                                                      setEditingAccRequired(acc.isRequired);
                                                    }}>
                                                    <Pencil className="h-3 w-3 text-gray-400" />
                                                  </Button>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="삭제"
                                                    onClick={() => setDeleteTarget({
                                                      type: "accessory",
                                                      id: acc.id,
                                                      name: acc.subsidiaryMaster.name,
                                                      templateId: item.id,
                                                    })}>
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

                          </div>
                        </TableCell>
                      </TableRow>
                    )}
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
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => fetchData(pagination.page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchData(pagination.page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {pagination.totalPages <= 1 && pagination.total > 0 && (
        <p className="text-sm text-gray-500">총 {pagination.total}건</p>
      )}

      {/* ══════ 템플릿 생성/수정 모달 ══════ */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) setShowCreateDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "식단 템플릿 수정" : "식단 템플릿 등록"}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "템플릿 이름을 수정합니다."
                : "새 식단 템플릿을 등록합니다. 용기와 악세서리는 등록 후 추가할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-sm">템플릿명</Label>
              <Input
                placeholder="예: 5칸 도시락 기본, 3칸 간식"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>취소</Button>
              <Button onClick={handleSaveTemplate} disabled={formSaving || !formName.trim()}>
                {formSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                {editingTemplate ? "수정" : "등록"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════ 용기 추가 모달 ══════ */}
      <Dialog open={!!addContainerTemplateId} onOpenChange={(open) => { if (!open) setAddContainerTemplateId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>용기 추가</DialogTitle>
            <DialogDescription>템플릿에 배식 용기를 추가합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-sm">용기 선택</Label>
              <Select value={newContainerSubId} onValueChange={setNewContainerSubId}>
                <SelectTrigger>
                  <SelectValue placeholder="용기를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {containerOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name} ({opt.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddContainerTemplateId(null)}>취소</Button>
              <Button onClick={handleAddContainer} disabled={containerSaving || !newContainerSubId}>
                {containerSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════ 악세서리 추가 모달 ══════ */}
      <Dialog open={!!addAccTemplateId} onOpenChange={(open) => { if (!open) setAddAccTemplateId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>악세서리 추가</DialogTitle>
            <DialogDescription>젓가락, 뚜껑, 띠지 등 부속품을 추가합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-sm">부자재 선택</Label>
              <Select value={newAccSubId} onValueChange={setNewAccSubId}>
                <SelectTrigger>
                  <SelectValue placeholder="부자재를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {accessoryOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name} ({opt.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">소비 모드</Label>
              <Select value={newAccConsumptionType} onValueChange={setNewAccConsumptionType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_MEAL_COUNT">식수당 (인원수만큼)</SelectItem>
                  <SelectItem value="FIXED_QUANTITY">고정 수량</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newAccConsumptionType === "FIXED_QUANTITY" && (
              <div className="space-y-1">
                <Label className="text-sm">고정 수량</Label>
                <Input
                  type="number"
                  placeholder="예: 10"
                  value={newAccFixedQty}
                  onChange={(e) => setNewAccFixedQty(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={newAccRequired} onCheckedChange={setNewAccRequired} id="acc-required" />
              <Label htmlFor="acc-required" className="text-sm">필수 악세서리</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddAccTemplateId(null)}>취소</Button>
              <Button onClick={handleAddAccessory} disabled={accSaving || !newAccSubId}>
                {accSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 삭제 확인 모달 ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{deleteTarget?.name}&apos;을(를) 삭제하시겠습니까?
              {deleteTarget?.type === "template" && " 관련 용기와 악세서리도 함께 삭제됩니다."}
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
