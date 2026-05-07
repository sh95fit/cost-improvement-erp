"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { SubsidiaryList } from "@/features/material/components/subsidiary-list";
import { SubsidiaryForm } from "@/features/material/components/subsidiary-form";
import { SubsidiaryDetailDialog } from "@/features/material/components/subsidiary-detail-panel";
import type { SubsidiaryRow } from "@/features/material/components/subsidiary-list";

export default function SubsidiariesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<SubsidiaryRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setSelectedSubsidiary(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">부자재 관리</h1>
        <p className="text-sm text-gray-500">부자재 마스터 데이터를 관리합니다</p>
      </div>

      <SubsidiaryList
        key={refreshKey}
        onNew={() => setShowCreateDialog(true)}
        onSelect={(item) => setSelectedSubsidiary(item)}
      />

      {/* 부자재 등록 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>부자재 등록</DialogTitle>
            <DialogDescription>새 부자재를 등록합니다. 코드는 자동 채번됩니다.</DialogDescription>
          </DialogHeader>
          <SubsidiaryForm
            onCancel={() => setShowCreateDialog(false)}
            onSaved={() => { setShowCreateDialog(false); setRefreshKey((k) => k + 1); }}
          />
        </DialogContent>
      </Dialog>

      {/* 부자재 상세 Dialog */}
      {selectedSubsidiary && (
        <SubsidiaryDetailDialog
          subsidiary={selectedSubsidiary}
          open={!!selectedSubsidiary}
          onOpenChange={(open) => { if (!open) setSelectedSubsidiary(null); }}
          onUpdated={handleRefresh}
        />
      )}
    </div>
  );
}
