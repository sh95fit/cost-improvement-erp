"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnitMasterList } from "@/features/unit-master/components/unit-master-list";

export default function UnitsPage() {
  const [activeTab, setActiveTab] = useState("material");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">단위 관리</h1>
        <p className="text-sm text-gray-500">
          자재 및 부자재에서 사용할 단위를 중앙에서 등록·관리합니다.
          여기서 등록된 단위만 자재/부자재 등록, 단위 환산에서 선택할 수 있습니다.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="material">자재 단위</TabsTrigger>
          <TabsTrigger value="subsidiary">부자재 단위</TabsTrigger>
        </TabsList>
        <TabsContent value="material" className="mt-4">
          <UnitMasterList itemType="MATERIAL" />
        </TabsContent>
        <TabsContent value="subsidiary" className="mt-4">
          <UnitMasterList itemType="SUBSIDIARY" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
