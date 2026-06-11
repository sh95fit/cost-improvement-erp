// src/features/material-requirement/components/material-requirement-detail.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Calculator, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  generateMaterialRequirementsAction,
} from "../actions/material-requirement.action";
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
  const [generating, setGenerating] = useState<CountSource | null>(null);

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

  const handleGenerate = async (source: CountSource) => {
    setGenerating(source);
    try {
      const result = await generateMaterialRequirementsAction({
        mealPlanGroupId: group.id,
        countSource: source,
      });

      if (!result.success) {
        toast.error(result.error.message || "산출에 실패했습니다");
        return;
      }

      const { stats, generationVersion } = result.data;
      const summary =
        `v${generationVersion} · ` +
        `신규 ${stats.inserted} / 갱신 ${stats.updated} / ` +
        `복원 ${stats.undeleted} / 삭제 ${stats.softDeleted} / ` +
        `유지 ${stats.unchanged}`;

      toast.success(
        `${source === "ESTIMATED" ? "예상" : "확정"} 식수 기준 산출 완료`,
        {
          description: `${summary}\n(라인×용기 슬롯 ${stats.recipeContainerSlots}건, DIRECT 제외 ${stats.directSlotsSkipped}건)`,
          duration: 8000,
        },
      );

      // 산출한 source 탭으로 자동 전환 + 결과 패널 리프레시
      setCountSource(source);
      setRefreshKey((k) => k + 1);

      // // ★ Phase 9-C-Fix-H: 슬롯 수량 미스매치 경고 토스트
      // if (stats.slotQuantityMismatchWarnings > 0) {
      //   const sample = stats.mismatchDetails.slice(0, 3);
      //   const detail = sample
      //     .map(
      //       (d) =>
      //         `· 식수 ${d.mealCount.toLocaleString()} ↔ 슬롯합 ${d.slotsSum.toLocaleString()}`,
      //     )
      //     .join("\n");
      //   toast.warning(
      //     `슬롯 수량이 식수와 다른 식단 ${stats.slotQuantityMismatchWarnings}건`,
      //     {
      //       description:
      //         `산출은 완료되었으나 수량 검토 권장.\n${detail}` +
      //         (stats.mismatchDetails.length > 3
      //           ? `\n외 ${stats.mismatchDetails.length - 3}건`
      //           : ""),
      //       duration: 12000,
      //     },
      //   );
      // }

    } finally {
      setGenerating(null);
    }
  };

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

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handleGenerate("ESTIMATED")}
              disabled={generating !== null}
              className="min-w-[160px]"
            >
              {generating === "ESTIMATED" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              예상 식수로 산출
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleGenerate("FINAL")}
              disabled={generating !== null}
              className="min-w-[160px]"
            >
              {generating === "FINAL" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              확정 식수로 산출
            </Button>
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
