"use client";

import { ChevronRight } from "lucide-react";

export type LocationBreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

type Props = {
  items: LocationBreadcrumbItem[];
};

export function LocationBreadcrumb({ items }: Props) {
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
