// src/app/global-error.tsx
"use client";

import { useEffect } from "react";
import { logger } from "@/lib/utils/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[GlobalError]", error.message, error.digest);
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            시스템 오류가 발생했습니다
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            일시적인 문제일 수 있습니다. 아래 버튼을 눌러 다시 시도해주세요.
          </p>
          {error.digest && (
            <p className="mb-4 font-mono text-xs text-gray-400">
              오류 코드: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
