"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createRecipeAction, updateRecipeAction } from "../actions/recipe.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  recipe?: { id: string; code: string; name: string; description: string | null } | null;
  onBack: () => void;
  onSaved: () => void;
  compact?: boolean;
};

export function RecipeForm({ recipe, onBack, onSaved, compact = false }: Props) {
  const isEdit = !!recipe;

  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const input: Record<string, unknown> = {
      name,
      ...(description && { description }),
    };

    try {
      const result = isEdit
        ? await updateRecipeAction(recipe!.id, input)
        : await createRecipeAction(input);

      if (result.success) {
        toast.success(isEdit ? "레시피가 수정되었습니다" : "레시피가 등록되었습니다");
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
          <Label>레시피 코드</Label>
          <Input value={recipe!.code} disabled />
          <p className="text-xs text-gray-500">코드는 자동 생성되며 수정할 수 없습니다</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">레시피명 *</Label>
          <Input
            id="name"
            placeholder="예: 김치찌개"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">설명</Label>
          <Textarea
            id="description"
            placeholder="레시피에 대한 간단한 설명 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
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
            <CardTitle>{isEdit ? "레시피 수정" : "레시피 등록"}</CardTitle>
            <CardDescription>
              {isEdit
                ? `${recipe!.code} - ${recipe!.name} 정보를 수정합니다`
                : "새로운 레시피를 등록합니다"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
