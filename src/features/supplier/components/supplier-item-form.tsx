"use client";

import { useState, useEffect } from "react";
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
  createSupplierItemAction,
  updateSupplierItemAction,
} from "../actions/supplier.action";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import { getSubsidiariesAction } from "@/features/material/actions/material.action";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type MaterialOption = { id: string; name: string; code: string };
type SubsidiaryOption = { id: string; name: string; code: string };

type SupplierItemData = {
  id: string;
  itemType: string;
  productName: string;
  spec: string | null;
  supplyUnit: string;
  supplyUnitQty: number;
  currentPrice: number;
  leadTimeDays: number;
  moq: number | null;
  materialMaster: { id: string; name: string; code: string } | null;
  subsidiaryMaster: { id: string; name: string; code: string } | null;
};

type Props = {
  supplierId: string;
  item?: SupplierItemData | null;
  onBack: () => void;
  onSaved: () => void;
};

export function SupplierItemForm({ supplierId, item, onBack, onSaved }: Props) {
  const isEdit = !!item;

  const [itemType, setItemType] = useState(item?.itemType ?? "MATERIAL");
  const [materialMasterId, setMaterialMasterId] = useState(
    item?.materialMaster?.id ?? ""
  );
  const [subsidiaryMasterId, setSubsidiaryMasterId] = useState(
    item?.subsidiaryMaster?.id ?? ""
  );
  const [productName, setProductName] = useState(item?.productName ?? "");
  const [spec, setSpec] = useState(item?.spec ?? "");
  const [supplyUnit, setSupplyUnit] = useState(item?.supplyUnit ?? "");
  const [supplyUnitQty, setSupplyUnitQty] = useState(
    item?.supplyUnitQty != null ? String(item.supplyUnitQty) : ""
  );
  const [currentPrice, setCurrentPrice] = useState(
    item?.currentPrice != null ? String(item.currentPrice) : ""
  );
  const [leadTimeDays, setLeadTimeDays] = useState(
    item?.leadTimeDays != null ? String(item.leadTimeDays) : "1"
  );

  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      if (itemType === "MATERIAL") {
        const result = await getMaterialsAction({
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
        });
        if (result.success) {
          setMaterials(
            result.data.items.map((m: { id: string; name: string; code: string }) => ({
              id: m.id,
              name: m.name,
              code: m.code,
            }))
          );
        }
      } else {
        const result = await getSubsidiariesAction({
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
        });
        if (result.success) {
          setSubsidiaries(
            result.data.items.map((s: { id: string; name: string; code: string }) => ({
              id: s.id,
              name: s.name,
              code: s.code,
            }))
          );
        }
      }
    };
    loadOptions();
  }, [itemType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEdit) {
        const input = {
          productName,
          spec: spec || undefined,
          supplyUnit,
          supplyUnitQty: Number(supplyUnitQty),
          currentPrice: Number(currentPrice),
          leadTimeDays: Number(leadTimeDays),
        };
        const result = await updateSupplierItemAction(item!.id, input);
        if (result.success) {
          toast.success("공급 품목이 수정되었습니다");
          onSaved();
        } else {
          toast.error(result.error.message || "저장에 실패했습니다");
          setError(result.error.message);
        }
      } else {
        const input = {
          itemType,
          materialMasterId:
            itemType === "MATERIAL" ? materialMasterId : undefined,
          subsidiaryMasterId:
            itemType === "SUBSIDIARY" ? subsidiaryMasterId : undefined,
          productName,
          spec: spec || undefined,
          supplyUnit,
          supplyUnitQty: Number(supplyUnitQty),
          currentPrice: Number(currentPrice),
          leadTimeDays: Number(leadTimeDays),
        };
        const result = await createSupplierItemAction(supplierId, input);
        if (result.success) {
          toast.success("공급 품목이 등록되었습니다");
          onSaved();
        } else {
          toast.error(result.error.message || "저장에 실패했습니다");
          setError(result.error.message);
        }
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
            <CardTitle>{isEdit ? "품목 수정" : "품목 등록"}</CardTitle>
            <CardDescription>
              {isEdit
                ? "공급 품목 정보를 수정합니다"
                : "새로운 공급 품목을 등록합니다"}
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

          {/* 품목 유형 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">품목 유형</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>품목 유형 *</Label>
                <Select
                  value={itemType}
                  onValueChange={(v) => {
                    setItemType(v);
                    setMaterialMasterId("");
                    setSubsidiaryMasterId("");
                  }}
                  disabled={isEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATERIAL">식자재</SelectItem>
                    <SelectItem value="SUBSIDIARY">부자재</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {itemType === "MATERIAL" ? "식자재 *" : "부자재 *"}
                </Label>
                {itemType === "MATERIAL" ? (
                  <Select
                    value={materialMasterId}
                    onValueChange={setMaterialMasterId}
                    disabled={isEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="식자재 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.code} - {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={subsidiaryMasterId}
                    onValueChange={setSubsidiaryMasterId}
                    disabled={isEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="부자재 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {subsidiaries.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* 제품 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">제품 정보</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="productName">제품명 *</Label>
                <Input
                  id="productName"
                  placeholder="예: 국산 닭가슴살, 일회용 장갑"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  maxLength={100}
                />
                <p className="text-xs text-gray-500">
                  공급업체에서 사용하는 제품명을 입력하세요
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec">규격</Label>
                <Input
                  id="spec"
                  placeholder="예: 1.4kg, 500ml, 20매"
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  maxLength={50}
                />
                <p className="text-xs text-gray-500">
                  중량, 용량, 수량 등 규격 정보
                </p>
              </div>
            </div>
          </div>

          {/* 공급 조건 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">공급 조건</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="supplyUnit">공급 단위 *</Label>
                <Input
                  id="supplyUnit"
                  placeholder="예: 박스, 봉, 팩"
                  value={supplyUnit}
                  onChange={(e) => setSupplyUnit(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplyUnitQty">단위 수량 *</Label>
                <Input
                  id="supplyUnitQty"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="예: 10"
                  value={supplyUnitQty}
                  onChange={(e) => setSupplyUnitQty(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  1 공급단위 = 기본단위 수량
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPrice">단가 (원) *</Label>
                <Input
                  id="currentPrice"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="예: 15000"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">공급 단위당 가격</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadTimeDays">리드타임 (일)</Label>
                <Input
                  id="leadTimeDays"
                  type="number"
                  min={0}
                  placeholder="예: 1"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                />
              </div>
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
