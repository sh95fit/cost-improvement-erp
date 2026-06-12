"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createSubsidiaryAction,
  updateSubsidiaryAction,
} from "../actions/material.action";
import { UnitCombobox } from "@/features/unit-master/components/unit-combobox";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SUBSIDIARY_TYPE_LABELS: Record<string, string> = {
  CONTAINER: "용기",
  ACCESSORY: "악세서리",
  CONSUMABLE: "소모품",
};

type Props = {
  item?: {
    id: string;
    name: string;
    code: string;
    unit: string;
    unitCategory?: string;
    stockGrade: string;
    subsidiaryType?: string;
  } | null;
  onSaved: () => void;
  onCancel: () => void;
};

export function SubsidiaryForm({ item, onSaved, onCancel }: Props) {
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [subsidiaryType, setSubsidiaryType] = useState<string>(item?.subsidiaryType ?? "CONSUMABLE");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [unitCategory, setUnitCategory] = useState<string>(item?.unitCategory ?? "COUNT");
  const [stockGrade, setStockGrade] = useState(item?.stockGrade ?? "C");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!unit) {
      setError("단위를 선택해주세요");
      setLoading(false);
      return;
    }

    const input: Record<string, unknown> = {
      name,
      subsidiaryType,
      unit,
      unitCategory,
      stockGrade,
    };

    try {
      const result = isEdit
        ? await updateSubsidiaryAction(item!.id, input)
        : await createSubsidiaryAction(input);

      if (result.success) {
        toast.success(isEdit ? "부자재가 수정되었습니다" : "부자재가 등록되었습니다");
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
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {isEdit && (
        <div className="space-y-2">
          <Label>부자재 코드</Label>
          <Input value={item!.code} disabled />
          <p className="text-xs text-gray-500">코드는 자동 생성되며 수정할 수 없습니다</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">부자재명 *</Label>
          <Input id="name" placeholder="예: 도시락 용기 (대)" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>부자재 유형 *</Label>
          <Select value={subsidiaryType} onValueChange={setSubsidiaryType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SUBSIDIARY_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {subsidiaryType === "CONTAINER" && "배식 용기 — 식단 템플릿의 용기로 사용됩니다"}
            {subsidiaryType === "ACCESSORY" && "악세서리 — 젓가락, 뚜껑 등 부속품입니다"}
            {subsidiaryType === "CONSUMABLE" && "소모품 — 기타 소모성 부자재입니다"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>재고 등급</Label>
          <Select value={stockGrade} onValueChange={setStockGrade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A">가 (집중관리)</SelectItem>
              <SelectItem value="B">나 (중간관리)</SelectItem>
              <SelectItem value="C">다 (월말관리)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>단위 *</Label>
          <UnitCombobox
            value={unit}
            onChange={(v, u) => {
              setUnit(v);
              if (u) setUnitCategory(u.unitCategory);
            }}
            itemType="SUBSIDIARY"
            valueMode="code"
            placeholder="단위 선택 (검색: 개, EA, 박스 등)"
          />
          <p className="text-xs text-gray-500">
            단위 관리에서 등록된 단위만 선택 가능합니다. 분류는 자동 도출됩니다.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={loading || !unit}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEdit ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
