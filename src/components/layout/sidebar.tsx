"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Package,
  Box,
  UtensilsCrossed,
  ShoppingCart,
  Warehouse,
  Truck,
  Calculator,
  Bell,
  ClipboardCheck,
  CalendarCheck,
  Building2,
  Container,
} from "lucide-react";

const navigation = [
  { name: "식단 계획", href: "/meal-plans", icon: CalendarDays },
  { name: "자재 관리", href: "/materials", icon: Package },
  { name: "부자재 관리", href: "/subsidiaries", icon: Box },
  { name: "공급업체 관리", href: "/suppliers", icon: Building2 },
  { name: "용기 관리", href: "/containers", icon: Container },
  { name: "레시피 관리", href: "/recipes", icon: UtensilsCrossed },
  { name: "발주 관리", href: "/purchasing", icon: ShoppingCart },
  { name: "입고 관리", href: "/receiving", icon: ClipboardCheck },
  { name: "출고 관리", href: "/shipping", icon: Truck },
  { name: "소비 관리", href: "/consumption", icon: Warehouse },
  { name: "원가 관리", href: "/cost", icon: Calculator },
  { name: "월말 마감", href: "/month-end", icon: CalendarCheck },
  { name: "알림", href: "/notifications", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="text-xl font-bold text-gray-900">
          LunchLab
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
