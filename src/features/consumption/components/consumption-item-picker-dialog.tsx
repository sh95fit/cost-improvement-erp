"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ItemType } from "@prisma/client";
import { getMaterialsAction } from "@/features/material/actions/material.action";
import { getSubsidiariesAction } from "@/features/material/actions/material.action";

export type PickedItem = {
  itemType: ItemType;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
};

type SearchRow = {
  id: string;
  name: string;
  code: string;
  unit: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
};

export function ConsumptionItemPickerDialog({ open, onOpenChange, onPick }: Props) {
  const [itemType, setItemType] = useState<ItemType>(ItemType.MATERIAL);
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (itemType === ItemType.MATERIAL) {
          const result = await getMaterialsAction({
            search: keyword,
            page: 1,
            limit: 30,
            isActive: true,
          });
          if (!result.success) {
            setError(result.error.message);
            return;
          }
          setRows(
            result.data.items.map((m) => ({
              id: m.id,
              name: m.name,
              code: m.code,
              unit: m.unit,
            })),
          );
        } else {
          const result = await getSubsidiariesAction({
            search: keyword,
            page: 1,
            limit: 30,
            isActive: true,
          });
          if (!result.success) {
            setError(result.error.message);
            return;
          }
          setRows(
            result.data.items.map((s) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              unit: s.unit,
            })),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "조회 실패");
      }
    });
  };

  const handlePickRow = (row: SearchRow) => {
    onPick({
      itemType,
      itemId: row.id,
      itemName: row.name,
      itemCode: row.code,
      unit: row.unit,
    });
    // 다이얼로그는 닫지 않음 — 여러 건 연속 추가 가능 (수동 관리자 결정)
    // 필요 시 onOpenChange(false) 로 변경
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>품목 선택 (Layer B 수동 추가)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as ItemType)}
            >
              <option value={ItemType.MATERIAL}>자재</option>
              <option value={ItemType.SUBSIDIARY}>부자재</option>
            </select>
            <Input
              placeholder="이름 또는 코드로 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch} disabled={isPending}>
              {isPending ? "조회 중..." : "검색"}
            </Button>
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>코드</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handlePickRow(r)}>
                        추가
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                      검색어를 입력하고 검색 버튼을 누르세요.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
