"use client";

import { useState } from "react";
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
  createSubsidiaryAction,
  updateSubsidiaryAction,
} from "../actions/material.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

type SubsidiaryData = {
  id: string;
  name: string;
  code: string;
  unit: string;
  stockGrade: string;
};

type Props = {
  item?: SubsidiaryData | null;
  onBack: () => void;
  onSaved: () => void;
};

export function SubsidiaryForm({ item, onBack, onSaved }: Props) {
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
      if (isEdit) {
        const result = await updateSubsidiaryAction(item!.id, {
          name,
          unit,
          stockGrade,
        });
        if (result.success) {
          onSaved();
        } else {
          setError(result.error.message);
        }
      } else {
        const result = await createSubsidiaryAction({
          name,
          unit,
          stockGrade,
        });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>{isEdit ? "부자재 수정" : "부자재 등록"}</CardTitle>
            <CardDescription>
              {isEdit
                ? `${item!.code} - ${item!.name} 정보를 수정합니다`
                : "새 부자재를 등록합니다. 코드는 자동 채번됩니다."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">부자재명 *</Label>
              <Input
                id="name"
                placeholder="예: 도시락 용기 (대)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">단위 *</Label>
              <Input
                id="unit"
                placeholder="예: 개, 세트, 장"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>

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
          </div>

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
      </CardContent>
    </Card>
  );
}
