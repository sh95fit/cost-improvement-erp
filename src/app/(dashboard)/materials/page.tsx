"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MaterialList } from "@/features/material/components/material-list";
import { MaterialForm } from "@/features/material/components/material-form";
import { MaterialDetailPanel } from "@/features/material/components/material-detail-panel";
import { UnitConversionList } from "@/features/unit-conversion/components/unit-conversion-list";
import { UnitConversionForm } from "@/features/unit-conversion/components/unit-conversion-form";
import type { UnitConversionRow } from "@/features/unit-conversion/components/unit-conversion-list";
import type { MaterialRow } from "@/features/material/components/material-list";

type MaterialView =
  | { mode: "list" }
  | { mode: "new" };

type ConversionView =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; item: UnitConversionRow };

export default function MaterialsPage() {
  const [materialView, setMaterialView] = useState<MaterialView>({ mode: "list" });
  const [conversionView, setConversionView] = useState<ConversionView>({ mode: "list" });
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialRow | null>(null);
  const [activeTab, setActiveTab] = useState("materials");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMaterialUpdated = () => {
    setSelectedMaterial(null);
    setRefreshKey((k) => k + 1);
  };

  // ── 자재 탭 콘텐츠 ──
  const renderMaterialTab = () => {
    if (materialView.mode === "new") {
      return (
        <MaterialForm
          onBack={() => setMaterialView({ mode: "list" })}
          onSaved={() => setMaterialView({ mode: "list" })}
        />
      );
    }

    return (
      <MaterialList
        key={refreshKey}
        onNew={() => setMaterialView({ mode: "new" })}
        onSelect={(material) => setSelectedMaterial(material)}
      />
    );
  };

  // ── 단위 환산 탭 콘텐츠 ──
  const renderConversionTab = () => {
    if (conversionView.mode === "new") {
      return (
        <UnitConversionForm
          onBack={() => setConversionView({ mode: "list" })}
          onSaved={() => setConversionView({ mode: "list" })}
        />
      );
    }

    if (conversionView.mode === "edit") {
      return (
        <UnitConversionForm
          item={conversionView.item}
          onBack={() => setConversionView({ mode: "list" })}
          onSaved={() => setConversionView({ mode: "list" })}
        />
      );
    }

    return (
      <UnitConversionList
        onNew={() => setConversionView({ mode: "new" })}
        onEdit={(item) => setConversionView({ mode: "edit", item })}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">자재 관리</h1>
        <p className="text-sm text-gray-500">
          식자재 마스터, 단위 환산 규칙을 관리합니다
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="materials">자재 목록</TabsTrigger>
          <TabsTrigger value="conversions">단위 환산</TabsTrigger>
        </TabsList>
        <TabsContent value="materials" className="mt-4">
          {renderMaterialTab()}
        </TabsContent>
        <TabsContent value="conversions" className="mt-4">
          {renderConversionTab()}
        </TabsContent>
      </Tabs>

      {/* 자재 상세 패널 (Sheet) */}
      <Sheet
        open={!!selectedMaterial}
        onOpenChange={(open) => {
          if (!open) setSelectedMaterial(null);
        }}
      >
        <SheetContent side="right" className="w-full p-0 sm:max-w-2xl" aria-describedby={undefined}>
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedMaterial?.name ?? "자재 상세"}</SheetTitle>
          </SheetHeader>
          {selectedMaterial && (
            <MaterialDetailPanel
              material={selectedMaterial}
              onClose={() => setSelectedMaterial(null)}
              onUpdated={handleMaterialUpdated}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
