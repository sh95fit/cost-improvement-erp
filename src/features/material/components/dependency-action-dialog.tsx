"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Power, PowerOff, Trash2 } from "lucide-react";

/**
 * M-Fix-R1 (D14-9) 공용 의존성 다이얼로그
 * MaterialMaster / SubsidiaryMaster / SupplierItem 공통.
 */

export interface BaseDependencies {
  canHardDelete: boolean;
  canDeactivate: boolean;
  blockingReasonForDelete?: string;
  blockingReasonForDeactivate?: string;
}

type Props<D extends BaseDependencies> = {
  open: boolean;
  onClose: () => void;
  entityLabel: string;          // "자재" / "부자재" / "공급 품목"
  entityName: string;           // 대상 행의 이름
  isCurrentlyActive: boolean;   // 현재 활성 상태
  fetchDependencies: () => Promise<D | null>;
  onDelete: () => Promise<void>;
  onSetActive: (isActive: boolean) => Promise<void>;
  renderCounts?: (deps: D) => React.ReactNode;  // 의존성 카운트 표시(선택)
};

export function DependencyActionDialog<D extends BaseDependencies>({
  open,
  onClose,
  entityLabel,
  entityName,
  isCurrentlyActive,
  fetchDependencies,
  onDelete,
  onSetActive,
  renderCounts,
}: Props<D>) {
  const [loading, setLoading] = useState(false);
  const [deps, setDeps] = useState<D | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "delete" | "deactivate" | "activate" | null
  >(null);

  useEffect(() => {
    if (!open) {
      setDeps(null);
      return;
    }
    setLoading(true);
    fetchDependencies()
      .then((d) => setDeps(d))
      .finally(() => setLoading(false));
  }, [open, fetchDependencies]);

  const handleDelete = async () => {
    setActionLoading("delete");
    try {
      await onDelete();
      onClose();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetActive = async (next: boolean) => {
    setActionLoading(next ? "activate" : "deactivate");
    try {
      await onSetActive(next);
      onClose();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {entityLabel} 관리 — {entityName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            현재 의존성을 확인한 뒤 적절한 동작을 선택하세요.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !deps ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            의존성 정보를 불러올 수 없습니다
          </div>
        ) : (
          <div className="space-y-4">
            {renderCounts?.(deps)}

            {/* 삭제 가능 여부 안내 */}
            {!deps.canHardDelete && deps.blockingReasonForDelete && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">삭제 불가</p>
                  <p className="mt-0.5 text-xs">
                    {deps.blockingReasonForDelete}
                  </p>
                </div>
              </div>
            )}

            {/* 비활성화 불가 안내 */}
            {isCurrentlyActive &&
              !deps.canDeactivate &&
              deps.blockingReasonForDeactivate && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">비활성화 불가</p>
                    <p className="mt-0.5 text-xs">
                      {deps.blockingReasonForDeactivate}
                    </p>
                  </div>
                </div>
              )}
          </div>
        )}

        <AlertDialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>

          {/* 활성/비활성 토글 */}
          {deps && isCurrentlyActive ? (
            <Button
              variant="outline"
              disabled={!deps.canDeactivate || actionLoading !== null}
              onClick={() => handleSetActive(false)}
            >
              {actionLoading === "deactivate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PowerOff className="mr-2 h-4 w-4" />
              )}
              비활성화
            </Button>
          ) : deps ? (
            <Button
              variant="outline"
              disabled={actionLoading !== null}
              onClick={() => handleSetActive(true)}
            >
              {actionLoading === "activate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Power className="mr-2 h-4 w-4" />
              )}
              활성화
            </Button>
          ) : null}

          {/* 삭제 */}
          {deps && (
            <Button
              variant="destructive"
              disabled={!deps.canHardDelete || actionLoading !== null}
              onClick={handleDelete}
            >
              {actionLoading === "delete" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              삭제
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── 의존성 카운트 표시용 작은 통계 카드 (공용) ──
export function Stat({
    label,
    value,
  }: {
    label: string;
    value: string | number;
  }) {
    return (
      <div className="rounded-md border bg-gray-50 px-3 py-2">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-mono text-sm font-semibold">{value}</div>
      </div>
    );
  }