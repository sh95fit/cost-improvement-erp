"use client";

import { ChevronRight } from "lucide-react";

export type LineupBreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

type Props = {
  items: LineupBreadcrumbItem[];
};

export function LineupBreadcrumb({ items }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="h-4 w-4" />}
          {item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="hover:text-gray-900 hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-gray-900">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
