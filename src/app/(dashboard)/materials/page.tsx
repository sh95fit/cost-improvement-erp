"use client";

import { useState } from "react";
import { MaterialList } from "@/features/material/components/material-list";
import { MaterialForm } from "@/features/material/components/material-form";
import type { MaterialMaster } from "@prisma/client";

type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; material: MaterialMaster };

export default function MaterialsPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "new") {
    return (
      <MaterialForm
        onBack={() => setView({ mode: "list" })}
        onSaved={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "edit") {
    return (
      <MaterialForm
        material={view.material}
        onBack={() => setView({ mode: "list" })}
        onSaved={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">자재 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          식자재 마스터 데이터를 등록하고 관리합니다
        </p>
      </div>
      <MaterialList
        onNew={() => setView({ mode: "new" })}
        onEdit={(material: MaterialMaster) => setView({ mode: "edit", material })}
      />
    </div>
  );
}
