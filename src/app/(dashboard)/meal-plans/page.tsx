// src/app/(dashboard)/meal-plans/page.tsx
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Pencil, Search, ChevronLeft, ChevronRight,
  Loader2, ChevronDown, ChevronUp, Copy, Eye, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";
import {
  getMealPlanGroupsAction,
  getMealPlanGroupByIdAction,
  createMealPlanGroupAction,
  updateMealPlanGroupAction,
  deleteMealPlanGroupAction,
  copyMealPlanGroupAction,
  createMealPlanAction,
  deleteMealPlanAction,
  createMealPlanSlotAction,
  updateMealPlanSlotAction,
  deleteMealPlanSlotAction,
} from "@/features/meal-plan/actions/meal-plan.action";
import {
  getMealTemplatesAction,
} from "@/features/meal-template/actions/meal-template.action";
import { loadAllPages } from "@/lib/action-helpers";
import type { PaginatedFetcher } from "@/lib/action-helpers";

// ── 타입 ──

type LineupInfo = { id: string; name: string; code: string };
type RecipeInfo = { id: string; name: string; code: string };
type SubsidiaryInfo = { id: string; name: string; code: string };

type MealPlanSlotRow = {
  id: string;
  slotIndex: number;
  recipeId: string | null;
  recipeBomId: string | null;
  quantity: number;
  note: string | null;
  recipe: RecipeInfo | null;
};

type MealPlanAccessoryRow = {
  id: string;
  subsidiaryMasterId: string;
  quantity: number;
  subsidiaryMaster: SubsidiaryInfo;
};

type MealPlanRow = {
  id: string;
  slotType: string;
  mealTemplateId: string | null;
  slots: MealPlanSlotRow[];
  accessories: MealPlanAccessoryRow[];
};

type MealCountRow = {
  id: string;
  slotType: string;
  estimatedCount: number | null;
  finalCount: number | null;
};

type MealPlanGroupRow = {
  id: string;
  planDate: string;
  status: string;
  lineup: LineupInfo;
  mealPlans?: MealPlanRow[];
  mealCounts?: MealCountRow[];
  _count?: { mealPlans: number };
};

type TemplateOption = { id: string; name: string };

const SLOT_TYPE_LABEL: Record<string, string> = {
  BREAKFAST: "조식",
  LUNCH: "중식",
  DINNER: "석식",
  SNACK: "간식",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "작성중",
  CONFIRMED: "확정",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-green-100 text-green-700",
  COMPLETED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function MealPlansPage() {
  // ── 목록 상태 ──
  const [items, setItems] = useState<MealPlanGroupRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ── 상세 보기 ──
  const [detailGroup, setDetailGroup] = useState<MealPlanGroupRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── 생성 다이얼로그 ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formLineupId, setFormLineupId] = useState("");
  const [formPlanDate, setFormPlanDate] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // ── 복사 다이얼로그 ──
  const [copySource, setCopySource] = useState<MealPlanGroupRow | null>(null);
  const [copyDate, setCopyDate] = useState("");
  const [copySaving, setCopySaving] = useState(false);

  // ── 식단(MealPlan) 추가 다이얼로그 ──
  const [addMealGroupId, setAddMealGroupId] = useState<string | null>(null);
  const [addMealSlotType, setAddMealSlotType] = useState("LUNCH");
  const [addMealTemplateId, setAddMealTemplateId] = useState("");
  const [mealSaving, setMealSaving] = useState(false);

  // ── 템플릿 옵션 ──
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);

  // ── 삭제 확인 ──
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "group" | "meal" | "slot";
    id: string;
    name: string;
  } | null>(null);

  // ── 상태 변경 ──
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    currentStatus: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState("");

  // ══════════════════════════════════════
  // 데이터 로딩
  // ══════════════════════════════════════

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await getMealPlanGroupsAction({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        sortBy: "planDate",
        sortOrder: "desc",
      });
      if (result.success) {
        setItems(result.data.items as unknown as MealPlanGroupRow[]);
        setPagination(result.data.pagination);
      } else {
        toast.error("식단 그룹 목록 조회에 실패했습니다");
        setItems([]);
      }
    } catch (err) {
      logger.error("[MealPlansPage.fetchData]", err);
      toast.error("목록 조회 중 오류가 발생했습니다");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const loadTemplateOptions = useCallback(async () => {
    try {
      const { items } = await loadAllPages<TemplateOption>(
        getMealTemplatesAction as PaginatedFetcher<TemplateOption>,
        "name"
      );
      setTemplateOptions(items);
    } catch (err) {
      logger.error("[MealPlansPage.loadTemplateOptions]", err);
    }
  }, []);

  useEffect(() => {
    fetchData(1);
    loadTemplateOptions();
  }, [fetchData, loadTemplateOptions]);

  // ── 상세 로딩 ──
  const openDetail = async (groupId: string) => {
    setDetailLoading(true);
    try {
      const result = await getMealPlanGroupByIdAction(groupId);
      if (result.success && result.data) {
        setDetailGroup(result.data as unknown as MealPlanGroupRow);
      } else {
        toast.error("식단 그룹 조회에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.openDetail]", err);
      toast.error("상세 조회 중 오류가 발생했습니다");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailGroup) return;
    await openDetail(detailGroup.id);
  };

  // ══════════════════════════════════════
  // 그룹 CRUD
  // ══════════════════════════════════════

  const handleCreateGroup = async () => {
    if (!formLineupId || !formPlanDate) return;
    setFormSaving(true);
    try {
      const result = await createMealPlanGroupAction({
        lineupId: formLineupId,
        planDate: formPlanDate,
      });
      if (result.success) {
        toast.success("식단 그룹이 생성되었습니다");
        setShowCreateDialog(false);
        setFormLineupId("");
        setFormPlanDate("");
        fetchData(1);
      } else {
        toast.error(result.error?.message ?? "생성에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleCreateGroup]", err);
      toast.error("생성 중 오류가 발생했습니다");
    } finally {
      setFormSaving(false);
    }
  };

  const handleCopyGroup = async () => {
    if (!copySource || !copyDate) return;
    setCopySaving(true);
    try {
      const result = await copyMealPlanGroupAction(copySource.id, copyDate);
      if (result.success) {
        toast.success("식단이 복사되었습니다");
        setCopySource(null);
        setCopyDate("");
        fetchData(1);
      } else {
        toast.error(result.error?.message ?? "복사에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleCopyGroup]", err);
      toast.error("복사 중 오류가 발생했습니다");
    } finally {
      setCopySaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusChangeTarget || !newStatus) return;
    try {
      const result = await updateMealPlanGroupAction(statusChangeTarget.id, {
        status: newStatus,
      });
      if (result.success) {
        toast.success("상태가 변경되었습니다");
        setStatusChangeTarget(null);
        setNewStatus("");
        fetchData(pagination.page);
        if (detailGroup?.id === statusChangeTarget.id) refreshDetail();
      } else {
        toast.error(result.error?.message ?? "상태 변경에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleStatusChange]", err);
      toast.error("상태 변경 중 오류가 발생했습니다");
    }
  };

  // ── 식단(MealPlan) 추가 ──
  const handleAddMeal = async () => {
    if (!addMealGroupId || !addMealSlotType) return;
    setMealSaving(true);
    try {
      const result = await createMealPlanAction(addMealGroupId, {
        slotType: addMealSlotType,
        mealTemplateId: addMealTemplateId || undefined,
      });
      if (result.success) {
        toast.success(`${SLOT_TYPE_LABEL[addMealSlotType] ?? addMealSlotType} 식단이 추가되었습니다`);
        setAddMealGroupId(null);
        setAddMealSlotType("LUNCH");
        setAddMealTemplateId("");
        await refreshDetail();
      } else {
        toast.error(result.error?.message ?? "식단 추가에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleAddMeal]", err);
      toast.error("식단 추가 중 오류가 발생했습니다");
    } finally {
      setMealSaving(false);
    }
  };

  // ── 삭제 ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      let result;
      if (type === "group") {
        result = await deleteMealPlanGroupAction(id);
        if (result.success) {
          toast.success("식단 그룹이 삭제되었습니다");
          if (detailGroup?.id === id) setDetailGroup(null);
          fetchData(pagination.page);
        }
      } else if (type === "meal") {
        result = await deleteMealPlanAction(id);
        if (result.success) {
          toast.success("식단이 삭제되었습니다");
          await refreshDetail();
        }
      } else if (type === "slot") {
        result = await deleteMealPlanSlotAction(id);
        if (result.success) {
          toast.success("슬롯이 삭제되었습니다");
          await refreshDetail();
        }
      }
      if (result && !result.success) {
        toast.error(result.error?.message ?? "삭제에 실패했습니다");
      }
    } catch (err) {
      logger.error("[MealPlansPage.handleConfirmDelete]", err);
      toast.error("삭제 중 오류가 발생했습니다");
    }
    setDeleteTarget(null);
  };

  // ══════════════════════════════════════
  // 렌더링 — 상세 뷰
  // ══════════════════════════════════════

  if (detailGroup) {
    return (
      <div className="space-y-6">
        {/* 헤더 + 뒤로가기 */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setDetailGroup(null)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> 목록으로
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {new Date(detailGroup.planDate).toLocaleDateString("ko-KR")} — {detailGroup.lineup.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[detailGroup.status] ?? ""}`}>
                {STATUS_LABEL[detailGroup.status] ?? detailGroup.status}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  setStatusChangeTarget({ id: detailGroup.id, currentStatus: detailGroup.status });
                  setNewStatus("");
                }}
              >
                상태 변경
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setAddMealGroupId(detailGroup.id); }}>
            <Plus className="mr-1 h-4 w-4" /> 식단 추가
          </Button>
        </div>

        {/* 식단 목록 */}
        {detailLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 불러오는 중...
          </div>
        ) : (
          <div className="space-y-4">
            {(!detailGroup.mealPlans || detailGroup.mealPlans.length === 0) ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                등록된 식단이 없습니다. "식단 추가" 버튼을 눌러 조식/중식/석식/간식을 추가하세요.
              </div>
            ) : (
              detailGroup.mealPlans.map((mp) => (
                <div key={mp.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {SLOT_TYPE_LABEL[mp.slotType] ?? mp.slotType}
                    </h3>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setDeleteTarget({ type: "meal", id: mp.id, name: SLOT_TYPE_LABEL[mp.slotType] ?? mp.slotType })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>

                  {/* 슬롯 테이블 */}
                  {mp.slots.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-400">배정된 슬롯이 없습니다.</p>
                  ) : (
                    <Table className="mt-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">순서</TableHead>
                          <TableHead>레시피</TableHead>
                          <TableHead className="w-[80px] text-center">인원</TableHead>
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mp.slots.map((slot) => (
                          <TableRow key={slot.id}>
                            <TableCell className="text-center">{slot.slotIndex + 1}</TableCell>
                            <TableCell>{slot.recipe?.name ?? <span className="text-gray-400">미배정</span>}</TableCell>
                            <TableCell className="text-center">{slot.quantity}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => setDeleteTarget({ type: "slot", id: slot.id, name: `슬롯 ${slot.slotIndex + 1}` })}>
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* 악세서리 요약 */}
                  {mp.accessories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {mp.accessories.map((acc) => (
                        <span key={acc.id} className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                          {acc.subsidiaryMaster.name} × {acc.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 식단 추가 다이얼로그 */}
        <Dialog open={!!addMealGroupId} onOpenChange={(open) => !open && setAddMealGroupId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>식단 추가</DialogTitle>
              <DialogDescription>식사 타입과 템플릿을 선택하세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>식사 타입</Label>
                <Select value={addMealSlotType} onValueChange={setAddMealSlotType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BREAKFAST">조식</SelectItem>
                    <SelectItem value="LUNCH">중식</SelectItem>
                    <SelectItem value="DINNER">석식</SelectItem>
                    <SelectItem value="SNACK">간식</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>식단 템플릿 (선택)</Label>
                <Select value={addMealTemplateId} onValueChange={setAddMealTemplateId}>
                  <SelectTrigger><SelectValue placeholder="템플릿 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">없음</SelectItem>
                    {templateOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddMealGroupId(null)}>취소</Button>
                <Button onClick={handleAddMeal} disabled={mealSaving}>
                  {mealSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  추가
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 상태 변경 다이얼로그 */}
        <Dialog open={!!statusChangeTarget} onOpenChange={(open) => !open && setStatusChangeTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>상태 변경</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="상태 선택" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL)
                    .filter(([k]) => k !== statusChangeTarget?.currentStatus)
                    .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStatusChangeTarget(null)}>취소</Button>
                <Button onClick={handleStatusChange} disabled={!newStatus}>변경</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>삭제 확인</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{deleteTarget?.name}&rdquo;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

  // ══════════════════════════════════════
  // 렌더링 — 목록 뷰
  // ══════════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">식단 계획</h1>
        <p className="text-sm text-gray-500">
          라인업별·날짜별 식단 그룹을 관리합니다. 각 그룹 안에 조식/중식/석식/간식 식단을 구성할 수 있습니다.
        </p>
      </div>

      {/* 검색 + 필터 + 등록 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="라인업명으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "ALL" ? "" : v); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => fetchData(1)} variant="outline" size="sm">검색</Button>
        <Button onClick={() => setShowCreateDialog(true)} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" /> 식단 그룹 생성
        </Button>
      </div>

      {/* 메인 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>라인업</TableHead>
              <TableHead className="w-[80px] text-center">상태</TableHead>
              <TableHead className="w-[80px] text-center">식단 수</TableHead>
              <TableHead className="w-[140px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중...
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                  {search.trim() ? `"${search}" 검색 결과가 없습니다` : "등록된 식단 그룹이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    {new Date(item.planDate).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}
                  </TableCell>
                  <TableCell>{item.lineup.name} ({item.lineup.code})</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.status] ?? ""}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {item._count?.mealPlans ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="상세"
                        onClick={() => openDetail(item.id)}>
                        <Eye className="h-3.5 w-3.5 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="복사"
                        onClick={() => { setCopySource(item); setCopyDate(""); }}>
                        <Copy className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="삭제"
                        onClick={() => setDeleteTarget({ type: "group", id: item.id, name: `${new Date(item.planDate).toLocaleDateString("ko-KR")} ${item.lineup.name}` })}>
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
            전체 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)}건
          </p>
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

      {/* 그룹 생성 다이얼로그 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>식단 그룹 생성</DialogTitle>
            <DialogDescription>날짜와 라인업을 선택하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>날짜</Label>
              <Input type="date" value={formPlanDate} onChange={(e) => setFormPlanDate(e.target.value)} />
            </div>
            <div>
              <Label>라인업 ID</Label>
              <Input
                placeholder="라인업 ID 입력 (추후 Select 전환)"
                value={formLineupId}
                onChange={(e) => setFormLineupId(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                ※ Lineup 모델은 Sprint 6에서 구현 예정. 현재는 ID를 직접 입력합니다.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>취소</Button>
              <Button onClick={handleCreateGroup} disabled={formSaving || !formPlanDate || !formLineupId}>
                {formSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 복사 다이얼로그 */}
      <Dialog open={!!copySource} onOpenChange={(open) => !open && setCopySource(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>식단 복사</DialogTitle>
            <DialogDescription>
              {copySource && `${new Date(copySource.planDate).toLocaleDateString("ko-KR")} ${copySource.lineup.name}`}의 식단을 복사합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>복사 대상 날짜</Label>
              <Input type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCopySource(null)}>취소</Button>
              <Button onClick={handleCopyGroup} disabled={copySaving || !copyDate}>
                {copySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                복사
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo;을(를) 삭제하시겠습니까? 하위 식단과 슬롯이 모두 삭제됩니다.
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
