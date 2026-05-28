"use client";

import { useState } from "react";
import { LineupList } from "@/features/lineup/components/lineup-list";
import { LineupForm } from "@/features/lineup/components/lineup-form";
import { LineupBreadcrumb } from "@/features/lineup/components/lineup-breadcrumb";

type LineupRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; lineup: LineupRow };

export default function LineupsPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  const getBreadcrumb = () => {
    const root = {
      label: "상품 라인업",
      onClick: () => setView({ mode: "list" }),
    };

    if (view.mode === "new") {
      return [root, { label: "신규 등록" }];
    }
    if (view.mode === "edit") {
      return [
        root,
        { label: `${view.lineup.name} (${view.lineup.code})` },
        { label: "정보 수정" },
      ];
    }
    return [];
  };

  const breadcrumbItems = getBreadcrumb();

  if (view.mode === "new") {
    return (
      <div className="space-y-4">
        <LineupBreadcrumb items={breadcrumbItems} />
        <LineupForm
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="space-y-4">
        <LineupBreadcrumb items={breadcrumbItems} />
        <LineupForm
          lineup={{
            id: view.lineup.id,
            name: view.lineup.name,
            code: view.lineup.code,
            isActive: view.lineup.isActive,
            sortOrder: view.lineup.sortOrder,
            description: view.lineup.description,
          }}
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">상품 라인업</h1>
        <p className="text-sm text-gray-500">
          판매 상품 라인업(가정간편식·신선식품 등)을 관리합니다. 원가 추적의
          그룹 단위로 사용됩니다.
        </p>
      </div>
      <LineupList
        onNew={() => setView({ mode: "new" })}
        onEdit={(lineup: LineupRow) => setView({ mode: "edit", lineup })}
      />
    </div>
  );
}
