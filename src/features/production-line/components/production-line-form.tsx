"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createProductionLineAction,
  updateProductionLineAction,
  getFactoryLocationOptionsAction,
} from "../actions/production-line.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProductionLineStatusValue } from "../schemas/production-line.schema";

export type ProductionLineFormValue = {
  id: string;
  name: string;
  code: string;
  locationId: string;
  status: ProductionLineStatusValue;
  sortOrder: number;
  note: string | null;
};

type LocationOption = {
  id: string;
  code: string;
  name: string;
  type: "FACTORY" | "WAREHOUSE" | "HYBRID";
};

type Props = {
  line?: ProductionLineFormValue | null;
  onBack: () => void;
  onSaved: () => void;
};

const STATUS_LABELS: Record<ProductionLineStatusValue, string> = {
  ACTIVE: "가동중",
  INACTIVE: "중지",
  MAINTENANCE: "정비중",
};

const TYPE_LABELS = {
  FACTORY: "공장",
  WAREHOUSE: "창고",
  HYBRID: "겸용",
} as const;

export function ProductionLineForm({ line, onBack, onSaved }: Props) {
  const isEdit = !!line;

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const [locationId, setLocationId] = useState(line?.locationId ?? "");
  const [name, setName] = useState(line?.name ?? "");
  const [status, setStatus] = useState<ProductionLineStatusValue>(
    line?.status ?? "ACTIVE"
  );
  const [sortOrder, setSortOrder] = useState<number>(line?.sortOrder ?? 0);
  const [note, setNote] = useState(line?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingLocations(true);
      const result = await getFactoryLocationOptionsAction();
      if (result.success) {
        setLocationOptions(result.data as LocationOption[]);
      } else {
        toast.error(result.error.message || "위치 옵션 조회에 실패했습니다");
      }
      setLoadingLocations(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      setError("위치(공장)를 선택해주세요");
      return;
    }
    setLoading(true);
    setError(null);

    const trimmedNote = note.trim();
    const input = {
      locationId,
      name,
      status,
      sortOrder,
      note: trimmedNote.length > 0 ? trimmedNote : null,
    };

    try {
      const result = isEdit
        ? await updateProductionLineAction(line!.id, input)
        : await createProductionLineAction(input);

      if (result.success) {
        toast.success(
          isEdit ? "생산라인이 수정되었습니다" : "생산라인이 등록되었습니다"
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
              {isEdit ? "생산라인 수정" : "생산라인 등록"}
            </CardTitle>
            <CardDescription>
              {isEdit
                ? `${line!.code} - ${line!.name} 정보를 수정합니다`
                : "공장에 속한 생산라인을 등록합니다 (원가 산출 및 작업지시서 단위)"}
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
              <Label>라인 코드</Label>
              <Input value={line!.code} disabled />
              <p className="text-xs text-gray-500">
                코드는 자동 생성되며 수정할 수 없습니다
              </p>
            </div>
          )}

          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="locationId">소속 공장 *</Label>
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                  disabled={loadingLocations}
                >
                  <SelectTrigger id="locationId">
                    <SelectValue
                      placeholder={
                        loadingLocations
                          ? "위치 목록을 불러오는 중..."
                          : "공장을 선택하세요"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.length === 0 && !loadingLocations ? (
                      <div className="px-2 py-1.5 text-sm text-gray-500">
                        등록된 공장이 없습니다
                      </div>
                    ) : (
                      locationOptions.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          [{loc.code}] {loc.name} ({TYPE_LABELS[loc.type]})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  공장(FACTORY) 또는 겸용(HYBRID) 유형의 활성 위치만 선택할 수
                  있습니다
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">라인명 *</Label>
                <Input
                  id="name"
                  placeholder="예: A라인, 도시락1호기"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">상태</Label>
                <Select
                  value={status}
                  onValueChange={(v: ProductionLineStatusValue) => setStatus(v)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{STATUS_LABELS.ACTIVE}</SelectItem>
                    <SelectItem value="INACTIVE">{STATUS_LABELS.INACTIVE}</SelectItem>
                    <SelectItem value="MAINTENANCE">{STATUS_LABELS.MAINTENANCE}</SelectItem>
                  </SelectContent>
                </Select>
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
                  숫자가 작을수록 위쪽에 표시됩니다
                </p>
              </div>
            </div>
          </div>

          {/* 비고 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">비고</h3>
            <div className="space-y-2">
              <Label htmlFor="note">메모</Label>
              <Textarea
                id="note"
                placeholder="라인에 대한 추가 정보 (선택)"
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
            <Button type="submit" disabled={loading || loadingLocations}>
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
