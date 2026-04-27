"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialList } from "@/features/material/components/material-list";
import { MaterialForm } from "@/features/material/components/material-form";
import { UnitConversionList } from "@/features/unit-conversion/components/unit-conversion-list";
import { UnitConversionForm } from "@/features/unit-conversion/components/unit-conversion-form";
import type { MaterialMaster } from "@prisma/client";

type MaterialView =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; material: MaterialMaster };

type UnitConversionData = {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  unitCategory: string;
  fromMaterial: { id: string; name: string; code: string; unit: string };
  toMaterial: { id: string; name: string; code: string; unit: string };
};

type ConversionView =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; item: UnitConversionData };

export default function MaterialsPage() {
  const [materialView, setMaterialView] = useState<MaterialView>({
    mode: "list",
  });
  const [conversionView, setConversionView] = useState<ConversionView>({
    mode: "list",
  });

  // ── 자재 탭 렌더링 ──
  const renderMaterialTab = () => {
    if (materialView.mode === "new") {
      return (
        <MaterialForm
          onBack={() => setMaterialView({ mode: "list" })}
          onSaved={() => setMaterialView({ mode: "list" })}
        />
      );
    }

    if (materialView.mode === "edit") {
      return (
        <MaterialForm
          material={materialView.material}
          onBack={() => setMaterialView({ mode: "list" })}
          onSaved={() => setMaterialView({ mode: "list" })}
        />
      );
    }

    return (
      <MaterialList
        onNew={() => setMaterialView({ mode: "new" })}
        onEdit={(material: MaterialMaster) =>
          setMaterialView({ mode: "edit", material })
        }
      />
    );
  };

  // ── 단위 환산 탭 렌더링 ──
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
        onEdit={(item: UnitConversionData) =>
          setConversionView({ mode: "edit", item })
        }
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">자재 관리</h1>
        <p className="text-sm text-gray-500">
          식자재 마스터 및 단위 환산 규칙을 관리합니다
        </p>
      </div>

      <Tabs defaultValue="materials">
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
    </div>
  );
}
