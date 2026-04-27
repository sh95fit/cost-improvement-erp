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
  materialMasterId: string | null;
  materialMaster: MaterialOption | null;
};

type Props = {
  item?: UnitConversionData | null;
  defaultMaterialId?: string;
  onBack: () => void;
  onSaved: () => void;
  compact?: boolean;
};

const SCOPE_GLOBAL = "__GLOBAL__";

export function UnitConversionForm({
  item,
  defaultMaterialId,
  onBack,
  onSaved,
  compact = false,
}: Props) {
  const isEdit = !!item;

  const [conversionScope, setConversionScope] = useState<string>(
    item?.materialMasterId ?? defaultMaterialId ?? SCOPE_GLOBAL
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

  const isGlobal = conversionScope === SCOPE_GLOBAL;
  const selectedMaterial = materials.find((m) => m.id === conversionScope);

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
          materialMasterId: isGlobal ? null : conversionScope,
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

      {/* 환산 범위 선택 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">환산 범위</h3>
        <div className="space-y-2">
          <Label>적용 대상 *</Label>
          <Select
            value={conversionScope}
            onValueChange={setConversionScope}
            disabled={isEdit || !!defaultMaterialId}
          >
            <SelectTrigger>
              <SelectValue placeholder="적용 대상을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCOPE_GLOBAL}>
                🌐 글로벌 (모든 자재 공통)
              </SelectItem>
              {materials.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  📦 {m.code} - {m.name} ({m.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {isGlobal
              ? "글로벌 환산: kg→g, L→mL 등 모든 자재에 공통 적용됩니다"
              : `자재별 환산: ${selectedMaterial?.name ?? "선택된 자재"}에만 적용됩니다`}
          </p>
        </div>
      </div>

      {/* 환산 정보 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">환산 정보</h3>
        <div className={`grid gap-4 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-4"}`}>
          <div className="space-y-2">
            <Label htmlFor="fromUnit">변환 전 단위 *</Label>
            <Input
              id="fromUnit"
              placeholder={isGlobal ? "예: kg, L" : "예: 팩, 봉, 망"}
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toUnit">변환 후 단위 *</Label>
            <Input
              id="toUnit"
              placeholder={isGlobal ? "예: g, mL" : `예: ${selectedMaterial?.unit ?? "kg"}, 개`}
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
              placeholder="예: 1000"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              required
            />
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
          <p className="mt-1 flex items-center gap-2">
            {!isGlobal && selectedMaterial && (
              <span className="font-semibold">{selectedMaterial.name}:</span>
            )}
            1 {fromUnit}
            <ArrowRight className="h-4 w-4" />
            {factor} {toUnit}
          </p>
          {isGlobal && (
            <p className="mt-1 text-xs text-blue-600">
              이 환산은 모든 자재에 공통 적용됩니다
            </p>
          )}
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
                : "글로벌 또는 자재별 단위 환산 규칙을 등록합니다"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
