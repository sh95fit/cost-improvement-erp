"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUnitConversionAction,
  updateUnitConversionAction,
} from "../actions/unit-conversion.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import { ArrowLeft, Save, Loader2, ArrowRight } from "lucide-react";

type MaterialOption = { id: string; name: string; code: string; unit: string };

type UnitConversionData = {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  unitCategory: string;
  fromMaterial: MaterialOption;
  toMaterial: MaterialOption;
};

type Props = {
  item?: UnitConversionData | null;
  defaultFromMaterialId?: string;
  onBack: () => void;
  onSaved: () => void;
  compact?: boolean;
};

export function UnitConversionForm({
  item,
  defaultFromMaterialId,
  onBack,
  onSaved,
  compact = false,
}: Props) {
  const isEdit = !!item;

  const [fromMaterialId, setFromMaterialId] = useState(
    item?.fromMaterial?.id ?? defaultFromMaterialId ?? ""
  );
  const [toMaterialId, setToMaterialId] = useState(
    item?.toMaterial?.id ?? defaultFromMaterialId ?? ""
  );
  const [fromUnit, setFromUnit] = useState(item?.fromUnit ?? "");
  const [toUnit, setToUnit] = useState(item?.toUnit ?? "");
  const [factor, setFactor] = useState(
    item?.factor != null ? String(item.factor) : ""
  );
  const [unitCategory, setUnitCategory] = useState(
    item?.unitCategory ?? "WEIGHT"
  );

  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMaterials = async () => {
      const result = await getMaterialsAction({
        page: 1,
        limit: 100,
        sortBy: "name",
        sortOrder: "asc",
      });
      if (result.success) {
        setMaterials(
          result.data.items.map(
            (m: { id: string; name: string; code: string; unit: string }) => ({
              id: m.id,
              name: m.name,
              code: m.code,
              unit: m.unit,
            })
          )
        );
      }
    };
    loadMaterials();
  }, []);

  const selectedFrom = materials.find((m) => m.id === fromMaterialId);
  const selectedTo = materials.find((m) => m.id === toMaterialId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEdit) {
        const input = {
          fromUnit,
          toUnit,
          factor: Number(factor),
          unitCategory,
        };
        const result = await updateUnitConversionAction(item!.id, input);
        if (result.success) {
          onSaved();
        } else {
          setError(result.error.message);
        }
      } else {
        const input = {
          fromMaterialId,
          toMaterialId,
          fromUnit,
          toUnit,
          factor: Number(factor),
          unitCategory,
        };
        const result = await createUnitConversionAction(input);
        if (result.success) {
          onSaved();
        } else {
          setError(result.error.message);
        }
      }
    } catch {
      setError("요청 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 자재 선택 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">자재 선택</h3>
        <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-5"}`}>
          <div className={`space-y-2 ${compact ? "" : "sm:col-span-2"}`}>
            <Label>변환 전 자재 *</Label>
            <Select
              value={fromMaterialId}
              onValueChange={setFromMaterialId}
              disabled={isEdit || !!defaultFromMaterialId}
            >
              <SelectTrigger>
                <SelectValue placeholder="자재를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} - {m.name} ({m.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!compact && (
            <div className="flex items-end justify-center pb-2">
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          )}

          <div className={`space-y-2 ${compact ? "" : "sm:col-span-2"}`}>
            <Label>변환 후 자재 *</Label>
            <Select
              value={toMaterialId}
              onValueChange={setToMaterialId}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="자재를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} - {m.name} ({m.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fromMaterialId && toMaterialId && fromMaterialId === toMaterialId && (
          <p className="text-xs text-blue-600">
            같은 자재 내 단위 환산입니다 (예: 망 → kg)
          </p>
        )}
      </div>

      {/* 환산 정보 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">환산 정보</h3>
        <div className={`grid gap-4 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-4"}`}>
          <div className="space-y-2">
            <Label htmlFor="fromUnit">변환 전 단위 *</Label>
            <Input
              id="fromUnit"
              placeholder={selectedFrom ? "예: 박스, 망" : "자재 선택 필요"}
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toUnit">변환 후 단위 *</Label>
            <Input
              id="toUnit"
              placeholder={selectedTo ? `예: ${selectedTo.unit}` : "자재 선택 필요"}
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="factor">환산 계수 *</Label>
            <Input
              id="factor"
              type="number"
              min={0}
              step="any"
              placeholder="예: 10"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              1 {fromUnit || "변환전"} = {factor || "?"} {toUnit || "변환후"}
            </p>
          </div>
          <div className="space-y-2">
            <Label>단위 분류 *</Label>
            <Select value={unitCategory} onValueChange={setUnitCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEIGHT">중량</SelectItem>
                <SelectItem value="VOLUME">용량</SelectItem>
                <SelectItem value="COUNT">수량</SelectItem>
                <SelectItem value="LENGTH">길이</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 미리보기 */}
      {fromUnit && toUnit && factor && (
        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium">환산 미리보기</p>
          <p className="mt-1">
            {selectedFrom?.name ?? "변환전 자재"} 1 {fromUnit} ={" "}
            {selectedTo?.name ?? "변환후 자재"} {factor} {toUnit}
          </p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isEdit ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );

  if (compact) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>
              {isEdit ? "단위 환산 수정" : "단위 환산 등록"}
            </CardTitle>
            <CardDescription>
              {isEdit
                ? "환산 단위와 계수를 수정합니다"
                : "자재 간 단위 환산 규칙을 등록합니다"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
