// src/features/material-requirement/components/material-requirement-breadcrumb.tsx
"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

type Props = {
  items: BreadcrumbItem[];
};

export function MaterialRequirementBreadcrumb({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1 text-sm text-gray-500"
    >
      <Link
        href="/"
        className="flex items-center hover:text-gray-700"
        aria-label="대시보드 홈"
      >
        <Home className="h-4 w-4" />
      </Link>
      <ChevronRight className="h-4 w-4 text-gray-300" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <div key={`${item.label}-${idx}`} className="flex items-center gap-1">
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-gray-700"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={cn(isLast ? "font-medium text-gray-900" : "")}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-gray-300" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
