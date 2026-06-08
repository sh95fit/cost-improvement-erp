// src/features/material-requirement/components/material-requirement-result-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { listMaterialRequirementsAction } from "../actions/material-requirement.action";
import { Loader2 } from "lucide-react";

type Props = {
  mealPlanGroupId: string;
  countSource: "ESTIMATED" | "FINAL";
};

export function MaterialRequirementResultPanel({
  mealPlanGroupId,
  countSource,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await listMaterialRequirementsAction({
        mealPlanGroupId,
        countSource,
        activeOnly: true,
        page: 1,
        limit: 1, // 9-B-2에서는 존재 여부만 확인
      });
      if (cancelled) return;
      if (result.success) {
        setTotal(result.data.total);
      } else {
        setTotal(0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mealPlanGroupId, countSource]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-white py-12 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        결과를 확인하는 중...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-md border border-dashed bg-white p-12 text-center">
        <p className="text-sm text-gray-500">
          해당 source({countSource})로 산출된 결과가 없습니다.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          상단 산출 버튼을 눌러 소요량을 생성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white p-6">
      <p className="text-sm text-gray-700">
        산출된 행: <strong className="tabular-nums">{total.toLocaleString()}</strong>건
      </p>
      <p className="mt-2 text-xs text-gray-400">
        결과 테이블(라인별 그룹핑, 자재명, g/kg 표시 등)은 다음 단계(9‑B‑3)에서 구현됩니다.
      </p>
    </div>
  );
}
