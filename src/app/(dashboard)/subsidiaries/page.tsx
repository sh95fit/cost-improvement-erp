"use client";

import { useState } from "react";
import { SubsidiaryList } from "@/features/material/components/subsidiary-list";
import { SubsidiaryForm } from "@/features/material/components/subsidiary-form";

type SubsidiaryRow = {
  id: string;
  name: string;
  code: string;
  unit: string;
  stockGrade: string;
  createdAt: Date;
};

type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; item: SubsidiaryRow };

export default function SubsidiariesPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "new") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">부자재 관리</h1>
          <p className="text-sm text-gray-500">
            부자재 마스터 데이터를 관리합니다
          </p>
        </div>
        <SubsidiaryForm
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">부자재 관리</h1>
          <p className="text-sm text-gray-500">
            부자재 마스터 데이터를 관리합니다
          </p>
        </div>
        <SubsidiaryForm
          item={view.item}
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">부자재 관리</h1>
        <p className="text-sm text-gray-500">
          부자재 마스터 데이터를 관리합니다
        </p>
      </div>
      <SubsidiaryList
        onNew={() => setView({ mode: "new" })}
        onEdit={(item) => setView({ mode: "edit", item })}
      />
    </div>
  );
}
