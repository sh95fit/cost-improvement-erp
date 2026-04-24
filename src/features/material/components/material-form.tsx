"use client";

import { useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createMaterialAction, updateMaterialAction } from "../actions/material.action";
import type { MaterialMaster } from "@prisma/client";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const STOCK_GRADE_LABELS: Record<string, string> = {
  A: "가 — 집중 관리",
  B: "나 — 중간 관리",
  C: "다 — 월말 관리",
};

type Props = {
  material?: MaterialMaster | null;
  onBack: () => void;
  onSaved: () => void;
};

export function MaterialForm({ material, onBack, onSaved }: Props) {
  const isEdit = !!material;

  const [name, setName] = useState(material?.name ?? "");
  const [materialType, setMaterialType] = useState<string>(material?.materialType ?? "RAW");
  const [unit, setUnit] = useState(material?.unit ?? "");
  const [unitCategory, setUnitCategory] = useState<string>(material?.unitCategory ?? "WEIGHT");
  const [stockGrade, setStockGrade] = useState<string>(material?.stockGrade ?? "C");
  const [shelfLifeDays, setShelfLifeDays] = useState<string>(
    material?.shelfLifeDays != null ? String(material.shelfLifeDays) : ""
  );
  const [minStock, setMinStock] = useState<string>(
    material?.minStock != null ? String(material.minStock) : ""
  );
  const [maxStock, setMaxStock] = useState<string>(
    material?.maxStock != null ? String(material.maxStock) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 최소/최대 재고량 교차 검증
    if (minStock !== "" && maxStock !== "") {
      if (Number(minStock) > Number(maxStock)) {
        setError("최소 재고량은 최대 재고량보다 클 수 없습니다");
        setLoading(false);
        return;
      }
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>{isEdit ? "자재 수정" : "자재 등록"}</CardTitle>
            <CardDescription>
              {isEdit
                ? `${material!.code} — ${material!.name} 정보를 수정합니다`
                : "새로운 자재를 등록합니다. 자재 코드는 자동으로 생성됩니다."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* ── 섹션 1: 기본 정보 ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">기본 정보</h3>
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
                    <SelectItem value="SEASONING">양념류</SelectItem>
                    <SelectItem value="PROCESSED">가공식품</SelectItem>
                    <SelectItem value="SEMI">반제품</SelectItem>
                    <SelectItem value="OTHER">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── 섹션 2: 단위 및 분류 ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">단위 및 분류</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="unit">사용 단위 *</Label>
                <Input
                  id="unit"
                  placeholder="예: kg, L, 개"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">레시피·재고에서 사용하는 단위</p>
              </div>
              <div className="space-y-2">
                <Label>단위 분류 *</Label>
                <Select value={unitCategory} onValueChange={setUnitCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEIGHT">중량 (kg, g)</SelectItem>
                    <SelectItem value="VOLUME">용량 (L, mL)</SelectItem>
                    <SelectItem value="COUNT">수량 (개, 세트)</SelectItem>
                    <SelectItem value="LENGTH">길이 (m, cm)</SelectItem>
                    <SelectItem value="OTHER">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>재고 등급</Label>
                <Select value={stockGrade} onValueChange={setStockGrade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">가 — 집중 관리</SelectItem>
                    <SelectItem value="B">나 — 중간 관리</SelectItem>
                    <SelectItem value="C">다 — 월말 관리</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">월말 마감 시 자동 조정됩니다</p>
              </div>
            </div>
          </div>

          {/* ── 섹션 3: 재고 관리 ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">재고 관리</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="minStock">최소 재고량</Label>
                <Input
                  id="minStock"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="예: 10"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                />
                <p className="text-xs text-gray-500">이 수량 이하 시 알림 발생</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxStock">최대 재고량</Label>
                <Input
                  id="maxStock"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="예: 100"
                  value={maxStock}
                  onChange={(e) => setMaxStock(e.target.value)}
                />
                <p className="text-xs text-gray-500">과다 재고 방지 기준</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelfLifeDays">기본 유통기한 (일)</Label>
                <Input
                  id="shelfLifeDays"
                  type="number"
                  min={0}
                  placeholder="예: 7"
                  value={shelfLifeDays}
                  onChange={(e) => setShelfLifeDays(e.target.value)}
                />
                <p className="text-xs text-gray-500">입고 시 만료일 자동 계산용</p>
              </div>
            </div>
          </div>

          {/* ── 수정 모드: 코드 표시 ── */}
          {isEdit && (
            <div className="rounded-md bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">자재 코드:</span>{" "}
                <span className="font-mono">{material!.code}</span>
                <span className="ml-2 text-xs text-gray-400">(자동 생성, 수정 불가)</span>
              </p>
            </div>
          )}

          {/* ── 저장 버튼 ── */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEdit ? "수정 저장" : "자재 등록"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
