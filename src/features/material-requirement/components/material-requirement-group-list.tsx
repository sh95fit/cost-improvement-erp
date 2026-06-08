// src/features/material-requirement/components/material-requirement-group-list.tsx
"use client";

type MealPlanGroupSummary = {
  id: string;
  planDate: string | Date;
  status: string;
  note: string | null;
};

type Props = {
  onSelect: (group: MealPlanGroupSummary) => void;
};

export function MaterialRequirementGroupList(_props: Props) {
  return (
    <div className="rounded-md border border-dashed bg-white p-12 text-center">
      <p className="text-sm text-gray-500">
        식단 그룹 목록은 다음 단계(9-B-2)에서 연동됩니다.
      </p>
      <p className="mt-1 text-xs text-gray-400">
        그룹을 선택하면 ESTIMATED / FINAL 산출 버튼과 결과 테이블이 표시됩니다.
      </p>
    </div>
  );
}
