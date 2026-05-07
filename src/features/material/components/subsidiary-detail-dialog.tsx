"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubsidiaryForm } from "./subsidiary-form";
import { UnitConversionList } from "@/features/unit-conversion/components/unit-conversion-list";
import { UnitConversionForm } from "@/features/unit-conversion/components/unit-conversion-form";
import {
  getSupplierItemsBySubsidiaryAction,
} from "@/features/supplier/actions/supplier.action";
import {
  setSubsidiaryDefaultSupplierItemAction,
} from "../actions/material.action";
import { Pencil, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { UNIT_CATEGORY_LABELS } from "@/lib/constants/unit-options";

import type { SubsidiaryRow } from "./subsidiary-list";
import type { UnitConversionRow } from "@/features/unit-conversion/components/unit-conversion-list";

type SupplierItemRow = {
  id: string;
  productName: string;
  spec: string | null;
  supplyUnit: string;
  supplyUnitQty: number;
  currentPrice: number;
  supplier: { id: string; name: string; code: string };
};

type ConversionView = "list" | "new" | "edit";

type Props = {
  subsidiary: SubsidiaryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

const GRADE_LABELS: Record<string, string> = {
  A: "가 (집중관리)",
  B: "나 (중간관리)",
  C: "다 (월말관리)",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(value);

export function SubsidiaryDetailDialog({
  subsidiary,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [supplierItems, setSupplierItems] = useState<SupplierItemRow[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [defaultItemId, setDefaultItemId] = useState<string | null>(
    subsidiary.defaultSupplierItemId
  );
  const [settingDefault, setSettingDefault] = useState(false);

  // 단위 환산 뷰 상태
  const [conversionView, setConversionView] = useState<ConversionView>("list");
  const [editingConversion, setEditingConversion] = useState<UnitConversionRow | null>(null);
  const [conversionRefreshKey, setConversionRefreshKey] = useState(0);

  const loadSupplierItems = useCallback(async () => {
    setSupplierLoading(true);
    try {
      const result = await getSupplierItemsBySubsidiaryAction(subsidiary.id);
      if (result.success) setSupplierItems(result.data as SupplierItemRow[]);
    } finally {
      setSupplierLoading(false);
    }
  }, [subsidiary.id]);

  useEffect(() => {
    loadSupplierItems();
  }, [loadSupplierItems]);

  useEffect(() => {
    setDefaultItemId(subsidiary.defaultSupplierItemId);
  }, [subsidiary.defaultSupplierItemId]);

  // 다이얼로그 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setIsEditing(false);
      setConversionView("list");
      setEditingConversion(null);
    }
  }, [open]);

  const handleSetDefault = async (supplierItemId: string) => {
    setSettingDefault(true);
    try {
      const result = await setSubsidiaryDefaultSupplierItemAction(
        subsidiary.id,
        supplierItemId
      );
      if (result.success) {
        setDefaultItemId(supplierItemId);
        toast.success("기본 공급 품목이 설정되었습니다");
        onUpdated();
      }
    } finally {
      setSettingDefault(false);
    }
  };

  const handleClearDefault = async () => {
    setSettingDefault(true);
    try {
      const result = await setSubsidiaryDefaultSupplierItemAction(
        subsidiary.id,
        null
      );
      if (result.success) {
        setDefaultItemId(null);
        toast.success("기본 공급 품목이 해제되었습니다");
        onUpdated();
      }
    } finally {
      setSettingDefault(false);
    }
  };

  // ── 단위 환산 뷰 렌더링 ──
  const renderConversionView = () => {
    switch (conversionView) {
      case "new":
        return (
          <UnitConversionForm
            defaultSubsidiaryId={subsidiary.id}
            onBack={() => setConversionView("list")}
            onSaved={() => {
              setConversionView("list");
              setConversionRefreshKey((k) => k + 1);
            }}
            compact
            subsidiaryMode
          />
        );
      case "edit":
        return (
          <UnitConversionForm
            item={editingConversion}
            onBack={() => {
              setConversionView("list");
              setEditingConversion(null);
            }}
            onSaved={() => {
              setConversionView("list");
              setEditingConversion(null);
              setConversionRefreshKey((k) => k + 1);
            }}
            compact
            subsidiaryMode
          />
        );
      default:
        return (
          <UnitConversionList
            key={conversionRefreshKey}
            subsidiaryId={subsidiary.id}
            onNew={() => setConversionView("new")}
            onEdit={(item) => {
              setEditingConversion(item);
              setConversionView("edit");
            }}
            compact
          />
        );
    }
  };

  // ── 기본정보 탭 ──
  const renderInfoTab = () => {
    if (isEditing) {
      return (
        <SubsidiaryForm
          item={{
            id: subsidiary.id,
            name: subsidiary.name,
            code: subsidiary.code,
            unit: subsidiary.unit,
            unitCategory: subsidiary.unitCategory,
            stockGrade: subsidiary.stockGrade,
          }}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onUpdated();
          }}
        />
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" /> 수정
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">부자재 코드</p>
            <p className="font-mono font-medium">{subsidiary.code}</p>
          </div>
          <div>
            <p className="text-gray-500">부자재명</p>
            <p className="font-medium">{subsidiary.name}</p>
          </div>
          <div>
            <p className="text-gray-500">단위 분류</p>
            <p>
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {UNIT_CATEGORY_LABELS[subsidiary.unitCategory as keyof typeof UNIT_CATEGORY_LABELS] ?? subsidiary.unitCategory}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-500">단위</p>
            <p>{subsidiary.unit}</p>
          </div>
          <div>
            <p className="text-gray-500">재고 등급</p>
            <p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  subsidiary.stockGrade === "A"
                    ? "bg-red-50 text-red-700"
                    : subsidiary.stockGrade === "B"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-green-50 text-green-700"
                }`}
              >
                {GRADE_LABELS[subsidiary.stockGrade] ?? subsidiary.stockGrade}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-500">등록일</p>
            <p>{new Date(subsidiary.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">기본 공급업체</p>
            {subsidiary.defaultSupplierItem ? (
              <p className="font-medium">
                {subsidiary.defaultSupplierItem.supplier.name}
                <span className="ml-2 text-sm text-gray-500">
                  {subsidiary.defaultSupplierItem.productName} ·{" "}
                  {formatCurrency(subsidiary.defaultSupplierItem.currentPrice)}
                </span>
              </p>
            ) : (
              <p className="text-gray-400">미지정</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 공급 품목 탭 ──
  const renderSuppliersTab = () => {
    if (supplierLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      );
    }

    if (supplierItems.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-gray-500">
          이 부자재에 연결된 공급 품목이 없습니다. 공급업체 관리에서 품목을
          등록해 주세요.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {defaultItemId && (
          <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-sm text-amber-700">
              <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              기본 공급 품목이 설정되어 있습니다
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-amber-600 hover:text-amber-800"
              onClick={handleClearDefault}
              disabled={settingDefault}
            >
              해제
            </Button>
          </div>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">기본</TableHead>
                <TableHead>공급업체</TableHead>
                <TableHead>제품명</TableHead>
                <TableHead>규격</TableHead>
                <TableHead>공급단위</TableHead>
                <TableHead className="text-right">단가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierItems.map((item) => {
                const isDefault = item.id === defaultItemId;
                return (
                  <TableRow
                    key={item.id}
                    className={isDefault ? "bg-amber-50/50" : ""}
                  >
                    <TableCell className="text-center">
                      {isDefault ? (
                        <Star className="inline h-4 w-4 fill-amber-500 text-amber-500" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleSetDefault(item.id)}
                          disabled={settingDefault}
                          title="기본으로 설정"
                        >
                          <Star className="h-4 w-4 text-gray-300 hover:text-amber-400" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.supplier.name}
                    </TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.spec ?? "-"}</TableCell>
                    <TableCell>
                      {item.supplyUnit} ({item.supplyUnitQty})
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.currentPrice)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {subsidiary.name}{" "}
            <span className="ml-2 text-sm font-normal text-gray-500">
              {subsidiary.code}
            </span>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">
              기본정보
            </TabsTrigger>
            <TabsTrigger value="conversion" className="flex-1">
              단위 환산
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-1">
              공급 품목 ({supplierItems.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-4">
            {renderInfoTab()}
          </TabsContent>
          <TabsContent value="conversion" className="mt-4">
            {renderConversionView()}
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            {renderSuppliersTab()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
