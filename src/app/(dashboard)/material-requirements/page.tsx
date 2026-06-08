// src/app/(dashboard)/material-requirements/page.tsx
"use client";

import { useState } from "react";
import { MaterialRequirementBreadcrumb } from "@/features/material-requirement/components/material-requirement-breadcrumb";
import { MaterialRequirementGroupList } from "@/features/material-requirement/components/material-requirement-group-list";

type MealPlanGroupSummary = {
  id: string;
  planDate: string | Date;
  status: string;
  note: string | null;
};

type View =
  | { mode: "list" }
  // 9-B-2에서 추가 예정:
  // | { mode: "detail"; group: MealPlanGroupSummary };
  ;

export default function MaterialRequirementsPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  const getBreadcrumb = () => {
    const root = {
      label: "자재 소요량",
      onClick: () => setView({ mode: "list" }),
    };
    // 9-B-2 detail 진입 시:
    // if (view.mode === "detail") return [root, { label: format(view.group.planDate) }];
    return [root];
  };

  const breadcrumbItems = getBreadcrumb();

  return (
    <div className="space-y-6">
      <MaterialRequirementBreadcrumb items={breadcrumbItems} />
      <div>
        <h1 className="text-2xl font-bold">자재 소요량</h1>
        <p className="text-sm text-gray-500">
          식단 그룹별로 (생산라인 × 자재) 단위 소요량을 산출하고 검토합니다.
          여기서 산출된 결과가 발주 관리 및 작업 지시서의 산출 근거가 됩니다.
        </p>
      </div>

      {view.mode === "list" && (
        <MaterialRequirementGroupList
          onSelect={(group: MealPlanGroupSummary) => {
            // 9-B-2에서 setView({ mode: "detail", group })로 변경
            console.log("선택된 그룹:", group);
          }}
        />
      )}
    </div>
  );
}
