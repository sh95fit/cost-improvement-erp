// src/app/(dashboard)/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/utils/logger";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[DashboardError]", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>

      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          페이지를 표시할 수 없습니다
        </h2>
        <p className="mb-1 text-sm text-gray-500">
          예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-gray-400">
            오류 코드: {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="default">
          <RotateCcw className="mr-2 h-4 w-4" />
          다시 시도
        </Button>
        <Button variant="outline" asChild>
          <Link href="/recipes">
            <Home className="mr-2 h-4 w-4" />
            홈으로 이동
          </Link>
        </Button>
      </div>
    </div>
  );
}
