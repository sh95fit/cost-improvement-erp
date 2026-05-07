"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubsidiaryList } from "@/features/material/components/subsidiary-list";
import { SubsidiaryForm } from "@/features/material/components/subsidiary-form";
import { SubsidiaryDetailDialog } from "@/features/material/components/subsidiary-detail-panel";
import { UnitMasterList } from "@/features/unit-master/components/unit-master-list";
import { UnitConversionList } from "@/features/unit-conversion/components/unit-conversion-list";
import { UnitConversionForm } from "@/features/unit-conversion/components/unit-conversion-form";
import type { SubsidiaryRow } from "@/features/material/components/subsidiary-list";
import type { UnitConversionRow } from "@/features/unit-conversion/components/unit-conversion-list";

type ConversionView = "list" | "new" | "edit";

export default function SubsidiariesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<SubsidiaryRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("list");

  // 단위 환산 뷰 상태
  const [conversionView, setConversionView] = useState<ConversionView>("list");
  const [editingConversion, setEditingConversion] = useState<UnitConversionRow | null>(null);
  const [conversionRefreshKey, setConversionRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setSelectedSubsidiary(null);
  };

  const renderConversionView = () => {
    switch (conversionView) {
      case "new":
        return (
          <UnitConversionForm
            onBack={() => setConversionView("list")}
            onSaved={() => {
              setConversionView("list");
              setConversionRefreshKey((k) => k + 1);
            }}
            subsidiaryMode
          />
        );
      case "edit":
        return (
          <UnitConversionForm
            item={editingConversion}
            onBack={() => {
              setConversionView("list");
              setEditingConversion(null);
            }}
            onSaved={() => {
              setConversionView("list");
              setEditingConversion(null);
              setConversionRefreshKey((k) => k + 1);
            }}
            subsidiaryMode
          />
        );
      default:
        return (
          <UnitConversionList
            key={conversionRefreshKey}
            onNew={() => setConversionView("new")}
            onEdit={(item) => {
              setEditingConversion(item);
              setConversionView("edit");
            }}
            defaultScope="subsidiary"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">부자재 관리</h1>
        <p className="text-sm text-gray-500">
          부자재 마스터 데이터를 관리합니다
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">부자재 목록</TabsTrigger>
          <TabsTrigger value="units">단위 관리</TabsTrigger>
          <TabsTrigger value="conversion">단위 환산</TabsTrigger>
        </TabsList>

        {/* 부자재 목록 탭 */}
        <TabsContent value="list" className="mt-4">
          <SubsidiaryList
            key={refreshKey}
            onNew={() => setShowCreateDialog(true)}
            onSelect={(item) => setSelectedSubsidiary(item)}
            refreshKey={refreshKey}
          />
        </TabsContent>

        {/* 단위 관리 탭 */}
        <TabsContent value="units" className="mt-4">
          <UnitMasterList itemType="SUBSIDIARY" />
        </TabsContent>

        {/* 단위 환산 탭 */}
        <TabsContent value="conversion" className="mt-4">
          {renderConversionView()}
        </TabsContent>
      </Tabs>

      {/* 부자재 등록 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>부자재 등록</DialogTitle>
            <DialogDescription>
              새 부자재를 등록합니다. 코드는 자동 채번됩니다.
            </DialogDescription>
          </DialogHeader>
          <SubsidiaryForm
            onCancel={() => setShowCreateDialog(false)}
            onSaved={() => {
              setShowCreateDialog(false);
              setRefreshKey((k) => k + 1);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 부자재 상세 Dialog */}
      {selectedSubsidiary && (
        <SubsidiaryDetailDialog
          subsidiary={selectedSubsidiary}
          open={!!selectedSubsidiary}
          onOpenChange={(open) => {
            if (!open) setSelectedSubsidiary(null);
          }}
          onUpdated={handleRefresh}
        />
      )}
    </div>
  );
}
