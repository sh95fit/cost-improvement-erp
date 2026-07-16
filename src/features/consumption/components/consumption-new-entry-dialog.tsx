"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLocationOptionsAction } from "@/features/location/actions/location.action";

// ────────────────────────────────────────────────────────────
// P4 (헌법): 사용(Consumption)은 FACTORY 소속 ProductionLine 에서만 발생.
// HYBRID 는 FACTORY 성격 겸용이라 허용, WAREHOUSE 는 제외.
// P13: MealPlan COMPLETED 진입 가드는 페이지 측 buildConsumptionDraftAction
//      이 담당. 다이얼로그는 라우팅만 수행한다.
// ────────────────────────────────────────────────────────────

type LocationOption = {
  id: string;
  code: string;
  name: string;
  type: "FACTORY" | "WAREHOUSE" | "HYBRID";
};

// 오늘 (UTC 자정 기준 YYYY-MM-DD)
function todayYmd(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ConsumptionNewEntryDialog() {
  const router = useRouter();
  const initialDate = useMemo(todayYmd, []);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(initialDate);
  const [locationId, setLocationId] = useState<string>("");
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 다이얼로그 열릴 때 사업장 옵션 로드 (P4: FACTORY/HYBRID 만)
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoadingOptions(true);
      try {
        const result = await getLocationOptionsAction({
          types: ["FACTORY", "HYBRID"],
        });
        if (cancelled) return;

        if (result.success) {
          setLocationOptions(result.data as LocationOption[]);
        } else {
          toast.error(
            result.error.message || "사업장 목록 조회에 실패했습니다",
          );
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // 다이얼로그 열 때마다 기본값 초기화
  useEffect(() => {
    if (open) {
      setDate(initialDate);
      setLocationId("");
    }
  }, [open, initialDate]);

  const canSubmit =
    !!date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !!locationId;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const params = new URLSearchParams({ date, locationId });
    setOpen(false);
    router.push(`/consumption/new?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1">
          <Plus className="h-4 w-4" />
          신규 사용 처리
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>신규 사용 처리</DialogTitle>
          <DialogDescription>
            사용 처리할 대상 일자와 사업장을 선택하세요. 다음 화면에서 초안이
            자동으로 계산됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="consumption-date">사용 일자</Label>
            <Input
              id="consumption-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              선택한 일자의 식단 계획이 확정(COMPLETED) 상태여야 진입할 수
              있습니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumption-location">사업장 (공장)</Label>
            <Select
              value={locationId}
              onValueChange={setLocationId}
              disabled={loadingOptions}
            >
              <SelectTrigger id="consumption-location">
                <SelectValue
                  placeholder={
                    loadingOptions ? "불러오는 중..." : "사업장을 선택하세요"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.length === 0 && !loadingOptions ? (
                  <div className="px-2 py-4 text-center text-sm text-gray-500">
                    사용 가능한 공장이 없습니다
                  </div>
                ) : (
                  locationOptions.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      <span className="font-medium">{loc.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {loc.code} · {loc.type === "FACTORY" ? "공장" : "복합"}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              사용 처리는 공장(FACTORY) 또는 복합(HYBRID) 사업장에서만 가능합니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loadingOptions}>
            {loadingOptions && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            다음
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
