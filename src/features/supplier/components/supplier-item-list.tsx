"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getSupplierItemsAction,
  deleteSupplierItemAction,
  getPriceHistoryAction,
} from "../actions/supplier.action";
import type { Supplier } from "@prisma/client";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  History,
  Loader2,
  Package,
} from "lucide-react";

type SupplierItemRow = {
  id: string;
  itemType: string;
  supplierItemCode: string | null;
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

type PriceHistoryRow = {
  id: string;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

type Props = {
  supplier: Supplier;
  onBack: () => void;
  onNewItem: () => void;
  onEditItem: (item: SupplierItemRow) => void;
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  MATERIAL: "식자재",
  SUBSIDIARY: "부자재",
};

export function SupplierItemList({
  supplier,
  onBack,
  onNewItem,
  onEditItem,
}: Props) {
  const [items, setItems] = useState<SupplierItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SupplierItemRow | null>(
    null
  );
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[] | null>(
    null
  );
  const [priceHistoryTarget, setPriceHistoryTarget] = useState<string | null>(
    null
  );

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSupplierItemsAction(supplier.id);
      if (result.success) {
        setItems(result.data as unknown as SupplierItemRow[]);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [supplier.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteSupplierItemAction(deleteTarget.id);
    if (result.success) {
      setDeleteTarget(null);
      fetchItems();
    }
  };

  const handleViewHistory = async (itemId: string) => {
    setPriceHistoryTarget(itemId);
    const result = await getPriceHistoryAction(itemId);
    if (result.success) {
      setPriceHistory(result.data as unknown as PriceHistoryRow[]);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ko-KR");

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {supplier.name} 공급 품목
                </CardTitle>
                <CardDescription>
                  {supplier.code} — 공급 품목을 관리합니다
                </CardDescription>
              </div>
            </div>
            <Button onClick={onNewItem}>
              <Plus className="mr-2 h-4 w-4" />
              품목 등록
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              등록된 공급 품목이 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>유형</TableHead>
                  <TableHead>자재/부자재</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead>규격</TableHead>
                  <TableHead>공급단위</TableHead>
                  <TableHead className="text-right">단위수량</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead className="text-right">리드타임</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.itemType === "MATERIAL"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.materialMaster
                        ? `${item.materialMaster.code} - ${item.materialMaster.name}`
                        : item.subsidiaryMaster
                          ? `${item.subsidiaryMaster.code} - ${item.subsidiaryMaster.name}`
                          : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.spec ?? "-"}
                    </TableCell>
                    <TableCell>{item.supplyUnit}</TableCell>
                    <TableCell className="text-right">
                      {item.supplyUnitQty}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.currentPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.leadTimeDays}일
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewHistory(item.id)}
                          title="가격 이력"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditItem(item)}
                          title="수정"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(item)}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공급 품목 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.productName}&quot; 품목을 삭제하시겠습니까?
              관련 가격 이력도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 가격 이력 다이얼로그 */}
      <AlertDialog
        open={!!priceHistoryTarget}
        onOpenChange={() => {
          setPriceHistoryTarget(null);
          setPriceHistory(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>가격 변동 이력</AlertDialogTitle>
          </AlertDialogHeader>
          {priceHistory === null ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : priceHistory.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              가격 이력이 없습니다
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>적용일</TableHead>
                  <TableHead>종료일</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{formatDate(h.effectiveFrom)}</TableCell>
                    <TableCell>
                      {h.effectiveTo ? formatDate(h.effectiveTo) : "현재"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(h.price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
