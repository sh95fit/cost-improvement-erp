"use client";

import { useState } from "react";
import { LocationList } from "@/features/location/components/location-list";
import { LocationForm } from "@/features/location/components/location-form";
import { LocationBreadcrumb } from "@/features/location/components/location-breadcrumb";
import type { LocationTypeValue } from "@/features/location/schemas/location.schema";

type LocationRow = {
  id: string;
  name: string;
  code: string;
  type: LocationTypeValue;
  address: string | null;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; location: LocationRow };

export default function LocationsPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  const getBreadcrumb = () => {
    const root = {
      label: "공장/창고 관리",
      onClick: () => setView({ mode: "list" }),
    };
    if (view.mode === "new") {
      return [root, { label: "신규 등록" }];
    }
    if (view.mode === "edit") {
      return [
        root,
        { label: `${view.location.name} (${view.location.code})` },
        { label: "정보 수정" },
      ];
    }
    return [];
  };

  const breadcrumbItems = getBreadcrumb();

  if (view.mode === "new") {
    return (
      <div className="space-y-4">
        <LocationBreadcrumb items={breadcrumbItems} />
        <LocationForm
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="space-y-4">
        <LocationBreadcrumb items={breadcrumbItems} />
        <LocationForm
          location={{
            id: view.location.id,
            name: view.location.name,
            code: view.location.code,
            type: view.location.type,
            address: view.location.address,
            note: view.location.note,
            isActive: view.location.isActive,
            sortOrder: view.location.sortOrder,
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
        <h1 className="text-2xl font-bold">공장/창고 관리</h1>
        <p className="text-sm text-gray-500">
          재고를 보유하는 위치(공장, 창고)를 관리합니다. 생산라인은 공장 유형 위치에 속하며,
          창고는 보관 전용으로 사용됩니다.
        </p>
      </div>
      <LocationList
        onNew={() => setView({ mode: "new" })}
        onEdit={(location: LocationRow) => setView({ mode: "edit", location })}
      />
    </div>
  );
}
