"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { MaterialList } from "@/features/material/components/material-list";
import { MaterialForm } from "@/features/material/components/material-form";
import { MaterialDetailPanel } from "@/features/material/components/material-detail-panel";
import type { MaterialMaster } from "@prisma/client";

type View =
  | { mode: "list" }
  | { mode: "new" };

export default function MaterialsPage() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialMaster | null>(null);

  if (view.mode === "new") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">자재 관리</h1>
          <p className="text-sm text-gray-500">
            식자재 마스터 및 단위 환산 규칙을 관리합니다
          </p>
        </div>
        <MaterialForm
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">자재 관리</h1>
        <p className="text-sm text-gray-500">
          식자재 마스터 및 단위 환산 규칙을 관리합니다
        </p>
      </div>

      <MaterialList
        onNew={() => setView({ mode: "new" })}
        onSelect={(material: MaterialMaster) => setSelectedMaterial(material)}
      />

      {/* 상세 패널 (Sheet) */}
      <Sheet
        open={!!selectedMaterial}
        onOpenChange={(open) => {
          if (!open) setSelectedMaterial(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          {selectedMaterial && (
            <MaterialDetailPanel
              material={selectedMaterial}
              onClose={() => setSelectedMaterial(null)}
              onUpdated={() => {
                setSelectedMaterial(null);
                setView({ mode: "list" });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
