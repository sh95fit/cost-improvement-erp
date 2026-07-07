// src/features/material-requirement/components/material-requirement-detail.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw, Info } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
// ──────────────────────────────────────────────────────────────
// Phase 4-G G-3 (2026-07-07): 산출 트리거는 식단 상태 전이(K-2)에서
// updateMealPlanGroup 내부 트랜잭션으로 자동 실행됨.
// 본 페이지는 결과 조회 전용(read-only dashboard).
//
// generateMaterialRequirementsAction 은 UI에서 더 이상 호출하지 않지만
// 서버 액션 자체는 유지한다 (감사 로그·향후 관리자 재산출 도구용 여지).
// 사용처 없음 상태로 두고 Phase 5 이후 재검토.
// ──────────────────────────────────────────────────────────────
// import { generateMaterialRequirementsAction } from "../actions/material-requirement.action";
import { getMealCountsAction } from "@/features/meal-plan/actions/meal-plan.action";
import { MaterialRequirementResultPanel } from "./material-requirement-result-panel";
import type { MealPlanGroupRow } from "./material-requirement-group-list";

import {
  STATUS_LABEL,
  STATUS_COLOR,
} from "@/features/meal-plan/constants/status-label";

type CountSource = "ESTIMATED" | "FINAL";

type Props = {
  group: MealPlanGroupRow;
  onBack: () => void;
};

export function MaterialRequirementDetail({ group, onBack }: Props) {
  const [countSource, setCountSource] = useState<CountSource>("ESTIMATED");

  // 식수 합계 표시용
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null);
  const [finalTotal, setFinalTotal] = useState<number | null>(null);

  // 결과 패널 강제 리프레시 트리거
  const [refreshKey, setRefreshKey] = useState(0);

  const dateStr = format(new Date(group.planDate), "yyyy.MM.dd (eee)", {
    locale: ko,
  });

  // 그룹의 식수 합계 로드
  const loadCounts = useCallback(async () => {
    const result = await getMealCountsAction(group.id);
    if (!result.success) {
      // 그룹은 있지만 식수가 비어있는 정상 케이스가 있으므로 silent
      setEstimatedTotal(0);
      setFinalTotal(0);
      return;
    }
    const counts = result.data as Array<{
      estimatedCount: number | null;
      finalCount: number | null;
    }>;
    const est = counts.reduce((s, c) => s + (c.estimatedCount ?? 0), 0);
    const fin = counts.reduce((s, c) => s + (c.finalCount ?? 0), 0);
    setEstimatedTotal(est);
    setFinalTotal(fin);
  }, [group.id]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <div className="space-y-6">
      {/* 헤더 카드 */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            그룹 목록
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tabular-nums">{dateStr}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[group.status] ?? "bg-gray-100 text-gray-700"}`}>
                {STATUS_LABEL[group.status] ?? group.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>
                식단 카드: <strong>{group._count.mealPlans}</strong>건
              </span>
              <span>
                식수 행: <strong>{group._count.mealCounts}</strong>건
              </span>
              <span>
                예상 식수 합:{" "}
                <strong className="tabular-nums">
                  {estimatedTotal == null ? "—" : estimatedTotal.toLocaleString()}
                </strong>{" "}
                인분
              </span>
              <span>
                확정 식수 합:{" "}
                <strong className="tabular-nums">
                  {finalTotal == null ? "—" : finalTotal.toLocaleString()}
                </strong>{" "}
                인분
              </span>
            </div>
            {group.note && (
              <p className="mt-1 text-xs text-gray-500">비고: {group.note}</p>
            )}
          </div>

          {/* ── Phase 4-G G-3: 산출 버튼 제거, 안내 배너로 대체 ── */}
          <div className="max-w-[260px] rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              식단을 <strong>진행중</strong> 상태로 변경하면
              자재 소요량이 자동 산출됩니다.
            </span>
          </div>
        </div>
      </div>

      {/* 결과 패널 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Tabs
            value={countSource}
            onValueChange={(v) => setCountSource(v as CountSource)}
          >
            <TabsList>
              <TabsTrigger value="ESTIMATED">예상 식수 결과</TabsTrigger>
              <TabsTrigger value="FINAL">확정 식수 결과</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            새로고침
          </Button>
        </div>

        <MaterialRequirementResultPanel
          key={`${group.id}-${countSource}-${refreshKey}`}
          mealPlanGroupId={group.id}
          countSource={countSource}
        />
      </div>
    </div>
  );
}
