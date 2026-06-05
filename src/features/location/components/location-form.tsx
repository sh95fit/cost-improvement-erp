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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createLocationAction,
  updateLocationAction,
} from "../actions/location.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LocationTypeValue } from "../schemas/location.schema";

export type LocationFormValue = {
  id: string;
  name: string;
  code: string;
  type: LocationTypeValue;
  address: string | null;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
};

type Props = {
  location?: LocationFormValue | null;
  onBack: () => void;
  onSaved: () => void;
};

const TYPE_LABELS: Record<LocationTypeValue, string> = {
  FACTORY: "공장",
  WAREHOUSE: "창고",
  HYBRID: "겸용 (공장+창고)",
};

export function LocationForm({ location, onBack, onSaved }: Props) {
  const isEdit = !!location;

  const [name, setName] = useState(location?.name ?? "");
  const [type, setType] = useState<LocationTypeValue>(location?.type ?? "FACTORY");
  const [address, setAddress] = useState(location?.address ?? "");
  const [note, setNote] = useState(location?.note ?? "");
  const [isActive, setIsActive] = useState<boolean>(location?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState<number>(location?.sortOrder ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedAddr = address.trim();
    const trimmedNote = note.trim();
    const input = {
      name,
      type,
      address: trimmedAddr.length > 0 ? trimmedAddr : null,
      note: trimmedNote.length > 0 ? trimmedNote : null,
      isActive,
      sortOrder,
    };

    try {
      const result = isEdit
        ? await updateLocationAction(location!.id, input)
        : await createLocationAction(input);

      if (result.success) {
        toast.success(
          isEdit ? "위치 정보가 수정되었습니다" : "위치가 등록되었습니다"
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
            <CardTitle>{isEdit ? "위치 수정" : "위치 등록"}</CardTitle>
            <CardDescription>
              {isEdit
                ? `${location!.code} - ${location!.name} 정보를 수정합니다`
                : "공장·창고 등 재고 보유 위치를 등록합니다"}
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
              <Label>위치 코드</Label>
              <Input value={location!.code} disabled />
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
                <Label htmlFor="name">위치명 *</Label>
                <Input
                  id="name"
                  placeholder="예: 1공장, 파미넥스창고"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">유형 *</Label>
                <Select
                  value={type}
                  onValueChange={(v: LocationTypeValue) => setType(v)}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FACTORY">{TYPE_LABELS.FACTORY}</SelectItem>
                    <SelectItem value="WAREHOUSE">{TYPE_LABELS.WAREHOUSE}</SelectItem>
                    <SelectItem value="HYBRID">{TYPE_LABELS.HYBRID}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  공장은 생산라인을 보유, 창고는 보관 전용
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">주소</Label>
                <Input
                  id="address"
                  placeholder="예: 서울시 강남구 ..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={255}
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
                  미사용으로 전환 시 옵션 선택 화면 등에서 기본적으로 숨겨집니다
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {/* 비고 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">비고</h3>
            <div className="space-y-2">
              <Label htmlFor="note">메모</Label>
              <Textarea
                id="note"
                placeholder="위치에 대한 추가 정보 (선택)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-right text-xs text-gray-500">
                {note.length} / 500
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
