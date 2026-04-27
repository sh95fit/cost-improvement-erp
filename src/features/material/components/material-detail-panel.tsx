"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MaterialForm } from "./material-form";
import { UnitConversionList } from "@/features/unit-conversion/components/unit-conversion-list";
import { UnitConversionForm } from "@/features/unit-conversion/components/unit-conversion-form";
import type { MaterialMaster } from "@prisma/client";
import { Pencil, X } from "lucide-react";

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

type Props = {
  material: MaterialMaster;
  onClose: () => void;
  onUpdated: () => void;
};

export function MaterialDetailPanel({ material, onClose, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [conversionView, setConversionView] = useState<ConversionView>({
    mode: "list",
  });

  const MATERIAL_TYPE_LABELS: Record<string, string> = {
    RAW: "원자재",
    SEASONING: "양념류",
    PROCESSED: "가공식품",
    SEMI: "반제품",
    OTHER: "기타",
  };

  const UNIT_CATEGORY_LABELS: Record<string, string> = {
    WEIGHT: "중량",
    VOLUME: "용량",
    COUNT: "수량",
    LENGTH: "길이",
  };

  const GRADE_LABELS: Record<string, string> = {
    A: "가 (집중관리)",
    B: "나 (중간관리)",
    C: "다 (월말관리)",
  };

  // ── 기본정보 탭 ──
  const renderInfoTab = () => {
    if (isEditing) {
      return (
        <MaterialForm
          material={material}
          onBack={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onUpdated();
          }}
          compact
        />
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            수정
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">자재 코드</p>
            <p className="font-mono font-medium">{material.code}</p>
          </div>
          <div>
            <p className="text-gray-500">자재명</p>
            <p className="font-medium">{material.name}</p>
          </div>
          <div>
            <p className="text-gray-500">유형</p>
            <p>{MATERIAL_TYPE_LABELS[material.materialType] ?? material.materialType}</p>
          </div>
          <div>
            <p className="text-gray-500">단위</p>
            <p>{material.unit}</p>
          </div>
          <div>
            <p className="text-gray-500">단위 분류</p>
            <p>{UNIT_CATEGORY_LABELS[material.unitCategory] ?? material.unitCategory}</p>
          </div>
          <div>
            <p className="text-gray-500">재고 등급</p>
            <p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  material.stockGrade === "A"
                    ? "bg-red-50 text-red-700"
                    : material.stockGrade === "B"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-green-50 text-green-700"
                }`}
              >
                {GRADE_LABELS[material.stockGrade] ?? material.stockGrade}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-500">최소 재고</p>
            <p>{material.minStock ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">최대 재고</p>
            <p>{material.maxStock ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">유통기한 (일)</p>
            <p>{material.shelfLifeDays ?? "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">등록일</p>
            <p>{new Date(material.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
        </div>
      </div>
    );
  };

  // ── 단위 환산 탭 ──
  const renderConversionTab = () => {
    if (conversionView.mode === "new") {
      return (
        <UnitConversionForm
          defaultFromMaterialId={material.id}
          onBack={() => setConversionView({ mode: "list" })}
          onSaved={() => setConversionView({ mode: "list" })}
          compact
        />
      );
    }

    if (conversionView.mode === "edit") {
      return (
        <UnitConversionForm
          item={conversionView.item}
          onBack={() => setConversionView({ mode: "list" })}
          onSaved={() => setConversionView({ mode: "list" })}
          compact
        />
      );
    }

    return (
      <UnitConversionList
        materialId={material.id}
        onNew={() => setConversionView({ mode: "new" })}
        onEdit={(item: UnitConversionData) =>
          setConversionView({ mode: "edit", item })
        }
        compact
      />
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{material.name}</h2>
          <p className="text-sm text-gray-500">{material.code}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs defaultValue="info">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">
              기본정보
            </TabsTrigger>
            <TabsTrigger value="conversions" className="flex-1">
              단위 환산
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-1">
              공급 품목
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-4">
            {renderInfoTab()}
          </TabsContent>
          <TabsContent value="conversions" className="mt-4">
            {renderConversionTab()}
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            <p className="py-8 text-center text-sm text-gray-500">
              이 자재에 연결된 공급 품목은 공급업체 관리에서 확인할 수 있습니다.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}