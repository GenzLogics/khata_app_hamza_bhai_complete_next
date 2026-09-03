"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  ShoppingCart,
  Receipt,
  TrendingUp,
  CreditCard,
  Package,
  Calculator,
} from "lucide-react";
import { cn } from "@/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sales-invoices", label: "Sales Invoices", icon: FileText },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/purchase-invoices", label: "Purchase Invoices", icon: ShoppingCart },
  { href: "/dashboard/vendors", label: "Vendors", icon: Building2 },
  { href: "/dashboard/cash-sales", label: "Cash Sales", icon: CreditCard },
  { href: "/dashboard/stock-management", label: "Stock Management", icon: Package },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/reports", label: "Balance Sheet", icon: Calculator },
  { href: "/dashboard/investors", label: "Investors", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-40 flex shrink-0 flex-col border-b border-gray-200 bg-white md:h-screen md:w-64 md:border-b-0 md:border-r">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-100 px-3 md:h-16 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-sm font-bold text-white">K</span>
          </div>
          <span className="text-base font-bold text-gray-900 sm:text-lg">KhataApp</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="overflow-x-auto px-2 py-2 md:flex-1 md:overflow-y-auto md:px-3 md:py-4">
        <ul className="flex gap-1 md:block md:space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex whitespace-nowrap items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2.5 sm:text-sm md:gap-3",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon size={16} className={active ? "text-blue-600 sm:h-[18px] sm:w-[18px]" : "text-gray-400 sm:h-[18px] sm:w-[18px]"} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
