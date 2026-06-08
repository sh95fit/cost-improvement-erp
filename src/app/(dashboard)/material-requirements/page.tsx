// src/app/(dashboard)/material-requirements/page.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MaterialRequirementBreadcrumb } from "@/features/material-requirement/components/material-requirement-breadcrumb";
import {
  MaterialRequirementGroupList,
  type MealPlanGroupRow,
} from "@/features/material-requirement/components/material-requirement-group-list";
import { MaterialRequirementDetail } from "@/features/material-requirement/components/material-requirement-detail";

type View =
  | { mode: "list" }
  | { mode: "detail"; group: MealPlanGroupRow };

export default function MaterialRequirementsPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  const getBreadcrumb = () => {
    const root = {
      label: "자재 소요량",
      onClick: () => setView({ mode: "list" }),
    };
    if (view.mode === "detail") {
      const dateLabel = format(new Date(view.group.planDate), "yyyy.MM.dd");
      return [root, { label: `${dateLabel} 그룹` }];
    }
    return [root];
  };

  const breadcrumbItems = getBreadcrumb();

  if (view.mode === "detail") {
    return (
      <div className="space-y-4">
        <MaterialRequirementBreadcrumb items={breadcrumbItems} />
        <MaterialRequirementDetail
          group={view.group}
          onBack={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

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
      <MaterialRequirementGroupList
        onSelect={(group) => setView({ mode: "detail", group })}
      />
    </div>
  );
}
