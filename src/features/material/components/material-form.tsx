"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMaterialAction,
  updateMaterialAction,
} from "../actions/material.action";
import { Save, Loader2 } from "lucide-react";
import {
  UNIT_OPTIONS,
  UNIT_CATEGORY_LABELS,
  getUnitOptionsByCategory,
} from "@/lib/constants/unit-options";
import type { UnitCategory } from "@prisma/client";
import { toast } from "sonner";

type Props = {
  material?: {
    id: string;
    code: string;
    name: string;
    materialType: string;
    unit: string;
    unitCategory: string;
    stockGrade: string;
    shelfLifeDays?: number | null;
    minStock?: number | null;
    maxStock?: number | null;
  } | null;
  onSaved: () => void;
  onCancel: () => void;
};

export function MaterialForm({ material, onSaved, onCancel }: Props) {
  const isEdit = !!material;

  const [name, setName] = useState(material?.name ?? "");
  const [materialType, setMaterialType] = useState<string>(
    material?.materialType ?? "RAW"
  );
  const [unitCategory, setUnitCategory] = useState<string>(
    material?.unitCategory ?? "WEIGHT"
  );
  const [unit, setUnit] = useState(material?.unit ?? "");
  const [stockGrade, setStockGrade] = useState<string>(
    material?.stockGrade ?? "C"
  );
  const [shelfLifeDays, setShelfLifeDays] = useState(
    material?.shelfLifeDays != null ? String(material.shelfLifeDays) : ""
  );
  const [minStock, setMinStock] = useState(
    material?.minStock != null ? String(material.minStock) : ""
  );
  const [maxStock, setMaxStock] = useState(
    material?.maxStock != null ? String(material.maxStock) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const options = getUnitOptionsByCategory(unitCategory as UnitCategory);
    const exists = options.some((opt) => opt.value === unit);
    if (!exists && options.length > 0) {
      setUnit(options[0].value);
    }
  }, [unitCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentUnitOptions = getUnitOptionsByCategory(unitCategory as UnitCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (minStock && maxStock && Number(minStock) > Number(maxStock)) {
      setError("최소 재고량이 최대 재고량보다 클 수 없습니다");
      setLoading(false);
      return;
    }

    const input: Record<string, unknown> = {
      name,
      materialType,
      unit,
      unitCategory,
      stockGrade,
      ...(shelfLifeDays !== "" && { shelfLifeDays: Number(shelfLifeDays) }),
      ...(minStock !== "" && { minStock: Number(minStock) }),
      ...(maxStock !== "" && { maxStock: Number(maxStock) }),
    };

    try {
      const result = isEdit
        ? await updateMaterialAction(material!.id, input)
        : await createMaterialAction(input);

      if (result.success) {
        toast.success(isEdit ? "자재가 수정되었습니다" : "자재가 등록되었습니다");
        onSaved();
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("요청 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {isEdit && (
        <div className="space-y-2">
          <Label>자재 코드</Label>
          <Input value={material!.code} disabled />
          <p className="text-xs text-gray-500">코드는 자동 생성되며 수정할 수 없습니다</p>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">자재명 *</Label>
            <Input
              id="name"
              placeholder="예: 양배추"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>자재 유형 *</Label>
            <Select value={materialType} onValueChange={setMaterialType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RAW">원자재</SelectItem>
                <SelectItem value="OTHER">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 단위 / 분류 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">단위 / 분류</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>단위 분류 *</Label>
            <Select value={unitCategory} onValueChange={setUnitCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(UNIT_OPTIONS) as UnitCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {UNIT_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>단위 *</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue placeholder="단위 선택" />
              </SelectTrigger>
              <SelectContent>
                {currentUnitOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 재고 관리 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">재고 관리</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>재고 등급</Label>
            <Select value={stockGrade} onValueChange={setStockGrade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">가 (집중관리)</SelectItem>
                <SelectItem value="B">나 (중간관리)</SelectItem>
                <SelectItem value="C">다 (월말관리)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shelfLifeDays">유통기한 (일)</Label>
            <Input id="shelfLifeDays" type="number" min={0} placeholder="예: 7" value={shelfLifeDays} onChange={(e) => setShelfLifeDays(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minStock">최소 재고량</Label>
            <Input id="minStock" type="number" min={0} step="any" placeholder="예: 10" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxStock">최대 재고량</Label>
            <Input id="maxStock" type="number" min={0} step="any" placeholder="예: 100" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEdit ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
