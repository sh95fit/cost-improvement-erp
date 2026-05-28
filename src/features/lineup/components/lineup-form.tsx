"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  createLineupAction,
  updateLineupAction,
} from "../actions/lineup.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type LineupFormValue = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  description: string | null;
};

type Props = {
  lineup?: LineupFormValue | null;
  onBack: () => void;
  onSaved: () => void;
};

export function LineupForm({ lineup, onBack, onSaved }: Props) {
  const isEdit = !!lineup;

  const [name, setName] = useState(lineup?.name ?? "");
  const [isActive, setIsActive] = useState<boolean>(lineup?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState<number>(lineup?.sortOrder ?? 0);
  const [description, setDescription] = useState(lineup?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedDesc = description.trim();
    const input = {
      name,
      isActive,
      sortOrder,
      description: trimmedDesc.length > 0 ? trimmedDesc : null,
    };

    try {
      const result = isEdit
        ? await updateLineupAction(lineup!.id, input)
        : await createLineupAction(input);

      if (result.success) {
        toast.success(
          isEdit ? "라인업 정보가 수정되었습니다" : "라인업이 등록되었습니다"
        );
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>
              {isEdit ? "라인업 수정" : "라인업 등록"}
            </CardTitle>
            <CardDescription>
              {isEdit
                ? `${lineup!.code} - ${lineup!.name} 정보를 수정합니다`
                : "가정간편식·신선식품 등 판매 상품의 라인업을 등록합니다"}
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

          {isEdit && (
            <div className="space-y-2">
              <Label>라인업 코드</Label>
              <Input value={lineup!.code} disabled />
              <p className="text-xs text-gray-500">
                코드는 자동 생성되며 수정할 수 없습니다
              </p>
            </div>
          )}

          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">라인업명 *</Label>
                <Input
                  id="name"
                  placeholder="예: 가정간편식 A, 프레시밀 B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">정렬 순서</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSortOrder(Number.isFinite(v) && v >= 0 ? v : 0);
                  }}
                />
                <p className="text-xs text-gray-500">
                  숫자가 작을수록 위쪽에 표시됩니다 (기본 0)
                </p>
              </div>
            </div>
          </div>

          {/* 사용 여부 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">사용 여부</h3>
            <div className="flex items-start justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">활성 상태</Label>
                <p className="text-xs text-gray-500">
                  미사용으로 전환 시 식단 작성 화면 등에서 기본적으로 숨겨집니다
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {/* 설명 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">설명</h3>
            <div className="space-y-2">
              <Label htmlFor="description">라인업 설명</Label>
              <Textarea
                id="description"
                placeholder="라인업에 대한 간단한 설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-right text-xs text-gray-500">
                {description.length} / 500
              </p>
            </div>
          </div>

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
      </CardContent>
    </Card>
  );
}
