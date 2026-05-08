"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createSupplierAction,
  updateSupplierAction,
} from "../actions/supplier.action";
import type { Supplier } from "@prisma/client";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  supplier?: Supplier | null;
  onBack: () => void;
  onSaved: () => void;
};

export function SupplierForm({ supplier, onBack, onSaved }: Props) {
  const isEdit = !!supplier;

  const [name, setName] = useState(supplier?.name ?? "");
  const [contactName, setContactName] = useState(
    supplier?.contactName ?? ""
  );
  const [contactPhone, setContactPhone] = useState(
    supplier?.contactPhone ?? ""
  );
  const [contactEmail, setContactEmail] = useState(
    supplier?.contactEmail ?? ""
  );
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [note, setNote] = useState(supplier?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const input = {
      name,
      contactName: contactName || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      address: address || undefined,
      note: note || undefined,
    };

    try {
      const result = isEdit
        ? await updateSupplierAction(supplier!.id, input)
        : await createSupplierAction(input);

      if (result.success) {
        toast.success(isEdit ? "공급업체 정보가 수정되었습니다" : "공급업체가 등록되었습니다");
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
              {isEdit ? "공급업체 수정" : "공급업체 등록"}
            </CardTitle>
            <CardDescription>
              {isEdit
                ? `${supplier!.code} - ${supplier!.name} 정보를 수정합니다`
                : "새로운 공급업체를 등록합니다"}
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

          {/* 수정 모드: 코드 표시 */}
          {isEdit && (
            <div className="space-y-2">
              <Label>공급업체 코드</Label>
              <Input value={supplier!.code} disabled />
              <p className="text-xs text-gray-500">
                코드는 자동 생성되며 수정할 수 없습니다
              </p>
            </div>
          )}

          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">
              기본 정보
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">공급업체명 *</Label>
                <Input
                  id="name"
                  placeholder="예: 신선식품"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">주소</Label>
                <Input
                  id="address"
                  placeholder="예: 서울시 강남구"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 담당자 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">
              담당자 정보
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="contactName">담당자명</Label>
                <Input
                  id="contactName"
                  placeholder="예: 김담당"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">연락처</Label>
                <Input
                  id="contactPhone"
                  placeholder="예: 02-1234-5678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">이메일</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="예: supplier@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 비고 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">
              비고
            </h3>
            <div className="space-y-2">
              <Label htmlFor="note">특이사항</Label>
              <Textarea
                id="note"
                placeholder="결제조건, 배송 제약사항 등 특이사항 입력 (선택)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
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
