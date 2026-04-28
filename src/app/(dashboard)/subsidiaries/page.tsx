"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { SubsidiaryList } from "@/features/material/components/subsidiary-list";
import { SubsidiaryForm } from "@/features/material/components/subsidiary-form";
import { SubsidiaryDetailPanel } from "@/features/material/components/subsidiary-detail-panel";
import type { SubsidiaryRow } from "@/features/material/components/subsidiary-list";

type View = { mode: "list" } | { mode: "new" };

export default function SubsidiariesPage() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<SubsidiaryRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setSelectedSubsidiary(null);
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">부자재 관리</h1>
        <p className="text-sm text-gray-500">
          부자재 마스터 데이터를 관리합니다
        </p>
      </div>
      <SubsidiaryList
        key={refreshKey}
        onNew={() => setView({ mode: "new" })}
        onSelect={(item) => setSelectedSubsidiary(item)}
      />

      {/* 상세 패널 */}
      <Sheet
        open={!!selectedSubsidiary}
        onOpenChange={(open) => {
          if (!open) setSelectedSubsidiary(null);
        }}
      >
        <SheetContent side="right" className="w-[500px] p-0 sm:max-w-[500px]">
          {selectedSubsidiary && (
            <SubsidiaryDetailPanel
              subsidiary={selectedSubsidiary}
              onClose={() => setSelectedSubsidiary(null)}
              onUpdated={handleRefresh}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
