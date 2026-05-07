"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { MaterialList } from "@/features/material/components/material-list";
import { MaterialForm } from "@/features/material/components/material-form";
import { MaterialDetailDialog } from "@/features/material/components/material-detail-panel";
import { UnitConversionList } from "@/features/unit-conversion/components/unit-conversion-list";
import { UnitConversionForm } from "@/features/unit-conversion/components/unit-conversion-form";
import type { UnitConversionRow } from "@/features/unit-conversion/components/unit-conversion-list";
import type { MaterialRow } from "@/features/material/components/material-list";

type ConversionView =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; item: UnitConversionRow };

export default function MaterialsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [conversionView, setConversionView] = useState<ConversionView>({ mode: "list" });
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialRow | null>(null);
  const [activeTab, setActiveTab] = useState("materials");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMaterialUpdated = () => {
    setSelectedMaterial(null);
    setRefreshKey((k) => k + 1);
  };

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
        <p className="text-sm text-gray-500">식자재 마스터, 단위 환산 규칙을 관리합니다</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="materials">자재 목록</TabsTrigger>
          <TabsTrigger value="conversions">단위 환산</TabsTrigger>
        </TabsList>
        <TabsContent value="materials" className="mt-4">
          <MaterialList
            key={refreshKey}
            onNew={() => setShowCreateDialog(true)}
            onSelect={(material) => setSelectedMaterial(material)}
          />
        </TabsContent>
        <TabsContent value="conversions" className="mt-4">
          {renderConversionTab()}
        </TabsContent>
      </Tabs>

      {/* 자재 등록 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>자재 등록</DialogTitle>
            <DialogDescription>새로운 자재를 등록합니다</DialogDescription>
          </DialogHeader>
          <MaterialForm
            onCancel={() => setShowCreateDialog(false)}
            onSaved={() => { setShowCreateDialog(false); setRefreshKey((k) => k + 1); }}
          />
        </DialogContent>
      </Dialog>

      {/* 자재 상세 Dialog */}
      {selectedMaterial && (
        <MaterialDetailDialog
          material={selectedMaterial}
          open={!!selectedMaterial}
          onOpenChange={(open) => { if (!open) setSelectedMaterial(null); }}
          onUpdated={handleMaterialUpdated}
        />
      )}
    </div>
  );
}
