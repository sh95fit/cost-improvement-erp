"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UnitCategory } from "@prisma/client";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createUnitConversionAction } from "@/features/unit-conversion/actions/unit-conversion.action";

// ────────────────────────────────────────────────────────────
// S4-3-c-4-3 — 미등록 자재 인라인 발주단위 보정 다이얼로그
// ────────────────────────────────────────────────────────────
//
// 목적: 사용 처리 화면에서 hasOrderUnit=false 자재를 발견했을 때,
//       페이지 이동 없이 즉시 UnitConversion 을 등록하고 서버 재빌드.
//
// D3=α: 저장 성공 시 router.refresh() 로 buildConsumptionDraft 재실행.
//       버튼의 미등록 뱃지가 자동 제거되고 발주단위 정보가 갱신됨.
//
// 주의: MaterialMaster.defaultSupplierItemId 는 이 다이얼로그로 등록되지 않음.
//       완전한 hasOrderUnit=true 전환은 후속 개선(c-4-5 하위)에서 처리.
//       이 다이얼로그는 최소한 단위 환산 관계를 확보하는 데 집중.

const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
    WEIGHT: "무게 (g/kg 등)",
    VOLUME: "부피 (ml/L 등)",
    COUNT: "개수 (ea/개 등)",
    LENGTH: "길이 (mm/cm/m 등)",
    PACKAGE: "포장 (팩/박스/봉 등)",
  };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: "MATERIAL" | "SUBSIDIARY";
  itemId: string;
  itemName: string;
  /** BOM 기본 단위 (예 "g", "ml", "ea"). toUnit 으로 자동 세팅됨. */
  currentUnit: string;
};

/**
 * UnitCategory 자동 추정 (사용자가 변경 가능).
 * - WEIGHT: g, kg, mg, t, oz, lb
 * - VOLUME: ml, l, cc, fl_oz
 * - LENGTH: mm, cm, m, in, ft
 * - PACKAGE: 팩, 봉, 박스, 병, 캔, box, pack, case
 * - COUNT: 그 외 (ea, 개 등)
 */
function guessCategory(unit: string): UnitCategory {
    const u = unit.trim().toLowerCase();
    if (["g", "kg", "mg", "t", "oz", "lb"].includes(u)) return UnitCategory.WEIGHT;
    if (["ml", "l", "cc", "fl_oz"].includes(u)) return UnitCategory.VOLUME;
    if (["mm", "cm", "m", "in", "ft"].includes(u)) return UnitCategory.LENGTH;
    if (["팩", "봉", "박스", "병", "캔", "box", "pack", "case"].includes(u)) {
      return UnitCategory.PACKAGE;
    }
    return UnitCategory.COUNT;
}

export function UnitConversionMiniDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
  currentUnit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fromUnit, setFromUnit] = useState("");
  const [factor, setFactor] = useState<number>(0);
  const [unitCategory, setUnitCategory] = useState<UnitCategory>(
    guessCategory(currentUnit),
  );

  const canSave =
    fromUnit.trim().length > 0 &&
    fromUnit.trim() !== currentUnit &&
    factor > 0 &&
    !isPending;

  function handleSave() {
    startTransition(async () => {
      const result = await createUnitConversionAction({
        materialMasterId: itemType === "MATERIAL" ? itemId : null,
        subsidiaryMasterId: itemType === "SUBSIDIARY" ? itemId : null,
        fromUnit: fromUnit.trim(),
        toUnit: currentUnit,
        factor,
        unitCategory,
      });

      if (!result.success) {
        toast.error(result.error.message || "발주단위 등록에 실패했습니다");
        return;
      }

      toast.success(
        `발주단위 등록 완료: 1 ${fromUnit.trim()} = ${factor} ${currentUnit}`,
      );
      onOpenChange(false);
      // D3=α: 서버 재빌드로 buildConsumptionDraft 갱신
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>발주단위 등록</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{itemName}</span> 의 발주단위와 기본단위(
            <span className="font-mono">{currentUnit}</span>) 간 환산 관계를
            등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 발주단위 입력 */}
          <div className="space-y-1.5">
            <Label htmlFor="fromUnit">발주단위</Label>
            <Input
              id="fromUnit"
              placeholder="예: kg, 팩, 박스"
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              maxLength={20}
            />
            {fromUnit.trim() === currentUnit && fromUnit.length > 0 && (
              <p className="text-xs text-red-600">
                기본단위와 다른 발주단위를 입력해 주세요
              </p>
            )}
          </div>

          {/* 환산 계수 입력 */}
          <div className="space-y-1.5">
            <Label htmlFor="factor">
              환산 계수 (1 {fromUnit.trim() || "발주단위"} ={" "}
              <span className="text-primary">?</span> {currentUnit})
            </Label>
            <Input
              id="factor"
              type="number"
              step="0.001"
              min="0"
              placeholder="예: 1000 (1kg = 1000g)"
              value={factor || ""}
              onChange={(e) => setFactor(Number(e.target.value) || 0)}
            />
            {factor > 0 && fromUnit.trim() && (
              <p className="text-xs text-gray-600">
                = 1 {fromUnit.trim()} 은 {factor} {currentUnit}
              </p>
            )}
          </div>

          {/* 단위 카테고리 */}
          <div className="space-y-1.5">
            <Label htmlFor="unitCategory">단위 카테고리</Label>
            <Select
              value={unitCategory}
              onValueChange={(v) => setUnitCategory(v as UnitCategory)}
            >
              <SelectTrigger id="unitCategory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(UNIT_CATEGORY_LABELS) as UnitCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {UNIT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              기본단위 &quot;{currentUnit}&quot; 을 참고해 자동 추정됩니다. 필요 시
              수정하세요.
            </p>
          </div>

          {/* 안내 */}
          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            <p className="font-medium">참고</p>
            <p className="mt-1">
              발주단위는 이 자재의 공급업체 항목(SupplierItem)과 별개로 등록됩니다.
              완전한 발주 흐름 연동은 자재 마스터에서 기본 공급업체 항목을 지정해
              주세요.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            취소
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
