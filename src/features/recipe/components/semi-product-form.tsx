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
import { createSemiProductAction, updateSemiProductAction } from "../actions/semi-product.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  semiProduct?: { id: string; code: string; name: string; unit: string } | null;
  onBack: () => void;
  onSaved: () => void;
  compact?: boolean;
};

export function SemiProductForm({ semiProduct, onBack, onSaved, compact }: Props) {
  const isEdit = !!semiProduct;

  const [name, setName] = useState(semiProduct?.name ?? "");
  const [unit, setUnit] = useState(semiProduct?.unit ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const input: Record<string, unknown> = { name, unit };

    try {
      const result = isEdit
        ? await updateSemiProductAction(semiProduct!.id, input)
        : await createSemiProductAction(input);

      if (result.success) {
        toast.success(isEdit ? "반제품이 수정되었습니다" : "반제품이 등록되었습니다");
        onSaved();
      } else {
        toast.error(result.error.message || "저장에 실패했습니다");
        setError(result.error.message);
      }
    } catch {
      toast.error("요청 처리 중 오류가 발생했습니다");
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

      {isEdit && (
        <div className="space-y-2">
          <Label>반제품 코드</Label>
          <Input value={semiProduct!.code} disabled />
          <p className="text-xs text-gray-500">코드는 자동 생성되며 수정할 수 없습니다</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">반제품명 *</Label>
          <Input
            id="name"
            placeholder="예: 양념장"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">단위 *</Label>
          <Input
            id="unit"
            placeholder="예: kg, L"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
          />
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
  );

  if (compact) return formContent;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>{isEdit ? "반제품 수정" : "반제품 등록"}</CardTitle>
            <CardDescription>
              {isEdit
                ? `${semiProduct!.code} - ${semiProduct!.name} 정보를 수정합니다`
                : "새로운 반제품을 등록합니다"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
