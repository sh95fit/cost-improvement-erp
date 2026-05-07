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
  createSubsidiaryAction,
  updateSubsidiaryAction,
} from "../actions/material.action";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  item?: {
    id: string;
    name: string;
    code: string;
    unit: string;
    stockGrade: string;
  } | null;
  onSaved: () => void;
  onCancel: () => void;
};

export function SubsidiaryForm({ item, onSaved, onCancel }: Props) {
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "개");
  const [stockGrade, setStockGrade] = useState(item?.stockGrade ?? "C");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = isEdit
        ? await updateSubsidiaryAction(item!.id, { name, unit, stockGrade })
        : await createSubsidiaryAction({ name, unit, stockGrade });

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
          <Label htmlFor="unit">단위 *</Label>
          <Input id="unit" placeholder="예: 개, 세트, 장" value={unit} onChange={(e) => setUnit(e.target.value)} required />
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
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEdit ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
