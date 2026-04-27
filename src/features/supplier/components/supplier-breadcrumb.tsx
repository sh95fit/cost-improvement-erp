"use client";

import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

type Props = {
  items: BreadcrumbItem[];
};

export function SupplierBreadcrumb({ items }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="hover:text-gray-900 hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-gray-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
