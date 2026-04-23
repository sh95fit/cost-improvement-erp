"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  UtensilsCrossed,
  CalendarDays,
  ShoppingCart,
  Warehouse,
  Truck,
  Calculator,
  Bell,
  Settings,
} from "lucide-react";

const navigation = [
  { name: "대시보드", href: "/dashboard", icon: LayoutDashboard },
  { name: "식자재 관리", href: "/dashboard/materials", icon: Package },
  { name: "레시피 관리", href: "/dashboard/recipes", icon: UtensilsCrossed },
  { name: "식단 계획", href: "/dashboard/meal-plans", icon: CalendarDays },
  { name: "발주 관리", href: "/dashboard/purchasing", icon: ShoppingCart },
  { name: "재고 관리", href: "/dashboard/inventory", icon: Warehouse },
  { name: "출하 관리", href: "/dashboard/shipping", icon: Truck },
  { name: "원가 분석", href: "/dashboard/cost", icon: Calculator },
  { name: "알림", href: "/dashboard/notifications", icon: Bell },
  { name: "설정", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold text-gray-900">
          LunchLab
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
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
