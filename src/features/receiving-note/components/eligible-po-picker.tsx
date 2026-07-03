"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { listEligiblePOsForReceivingAction } from "../actions/list-eligible-pos-for-receiving.action";

type ListResult = Awaited<ReturnType<typeof listEligiblePOsForReceivingAction>>;
type POs = Extract<ListResult, { success: true }>["data"];

const formatCurrency = (v: number | null | undefined) =>
  v == null
    ? "-"
    : new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0,
      }).format(v);

const formatDate = (d: Date | string | null | undefined) =>
  d == null ? "-" : new Date(d).toLocaleDateString("ko-KR");

export function EligiblePOPicker({ initialPOs }: { initialPOs: POs }) {
  const router = useRouter();
  const [pos, setPos] = useState<POs>(initialPOs);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const refetch = () => {
    startTransition(async () => {
      const res = await listEligiblePOsForReceivingAction({
        search: search.trim() || undefined,
      });
      if (res.success) {
        setPos(res.data);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="발주번호 또는 공급업체명"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refetch();
            }}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={refetch} disabled={pending}>
          {pending ? "검색 중..." : "검색"}
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">발주번호</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead className="w-[120px]">공장</TableHead>
              <TableHead className="w-[110px]">발주일</TableHead>
              <TableHead className="w-[80px] text-center">품목수</TableHead>
              <TableHead className="text-right">합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-gray-500"
                >
                  입고 대상 발주가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              pos.map((po) => (
                <TableRow
                  key={po.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    router.push(`/receiving/notes/new?poId=${po.id}`)
                  }
                >
                  <TableCell className="font-mono text-sm text-blue-600">
                    {po.orderNumber}
                  </TableCell>
                  <TableCell>{po.supplier?.name ?? "-"}</TableCell>
                  <TableCell>{po.location?.name ?? "-"}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(po.orderDate)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {po._count.items}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(
                      po.totalAmount ? Number(po.totalAmount) : null,
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
