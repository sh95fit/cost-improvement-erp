"use client";

import { useState } from "react";
import { ProductionLineList } from "@/features/production-line/components/production-line-list";
import { ProductionLineForm } from "@/features/production-line/components/production-line-form";
import { ProductionLineBreadcrumb } from "@/features/production-line/components/production-line-breadcrumb";
import type { ProductionLineStatusValue } from "@/features/production-line/schemas/production-line.schema";

type ProductionLineRow = {
  id: string;
  name: string;
  code: string;
  status: ProductionLineStatusValue;
  sortOrder: number;
  note: string | null;
  locationId: string;
  location: { id: string; code: string; name: string; type: string };
  createdAt: Date | string;
  updatedAt: Date | string;
};

type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; line: ProductionLineRow };

export default function ProductionLinesPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  const getBreadcrumb = () => {
    const root = {
      label: "생산라인 관리",
      onClick: () => setView({ mode: "list" }),
    };
    if (view.mode === "new") return [root, { label: "신규 등록" }];
    if (view.mode === "edit")
      return [
        root,
        { label: `${view.line.name} (${view.line.code})` },
        { label: "정보 수정" },
      ];
    return [];
  };

  const breadcrumbItems = getBreadcrumb();

  if (view.mode === "new") {
    return (
      <div className="space-y-4">
        <ProductionLineBreadcrumb items={breadcrumbItems} />
        <ProductionLineForm
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="space-y-4">
        <ProductionLineBreadcrumb items={breadcrumbItems} />
        <ProductionLineForm
          line={{
            id: view.line.id,
            name: view.line.name,
            code: view.line.code,
            locationId: view.line.locationId,
            status: view.line.status,
            sortOrder: view.line.sortOrder,
            note: view.line.note,
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
        <h1 className="text-2xl font-bold">생산라인 관리</h1>
        <p className="text-sm text-gray-500">
          공장 내 생산라인을 관리합니다. 식단 슬롯의 라인 배정·작업지시서·재고
          소진의 원자 단위입니다.
        </p>
      </div>
      <ProductionLineList
        onNew={() => setView({ mode: "new" })}
        onEdit={(line: ProductionLineRow) =>
          setView({ mode: "edit", line })
        }
      />
    </div>
  );
}
