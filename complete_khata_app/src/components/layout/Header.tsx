"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { remindersService } from "@/services/reminders.service";
import { formatCurrency, formatDate, isOverdue } from "@/utils/formatters";

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

function getDueStatus(dueDate: string | null): string {
  if (!dueDate) return "N/A";

  const daysLeft = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (daysLeft === 0) return "Due today";
  if (daysLeft > 0) return `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  const overdueDays = Math.abs(daysLeft);
  return `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`;
}

function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return differenceInCalendarDays(parseISO(dueDate), new Date()) === 0;
}

export function Header({ title, actions }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { user, isLoading } = useCurrentUser();

  const userFullName = user?.full_name?.trim();
  const userEmail = user?.email?.trim();
  const userInitial = (userFullName || userEmail || "A").charAt(0).toUpperCase();

  const { data } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => remindersService.getReminders(),
    staleTime: 60_000,
  });

  const salesCount = data?.sales_unpaid_count ?? 0;
  const purchaseCount = data?.purchase_unpaid_count ?? 0;
  const totalCount = salesCount + purchaseCount;

  return (
    <header className="relative flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:min-h-16 sm:px-4 lg:px-6">
      <h1 className="min-w-0 truncate text-sm font-semibold text-gray-900 sm:text-base md:text-lg lg:text-xl">{title}</h1>
      <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
        {actions}
        <div className="relative sm:ml-0">
          <button
            className="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Bell size={20} />
            {totalCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {totalCount}
              </span>
            )}
          </button>
          {isOpen && (
            <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg sm:w-80">
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">Reminders</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {salesCount > 0 && (
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                      Sales Invoices ({salesCount})
                    </p>
                    {data!.sales_unpaid.map((inv) => (
                      <Link
                        key={inv.id}
                        href={`/dashboard/sales-invoices/${inv.id}`}
                        className={`flex flex-col rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${
                          isOverdue(inv.due_date) ? "bg-red-50" : ""
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        <span className={`truncate ${isOverdue(inv.due_date) ? "text-red-700" : isDueToday(inv.due_date) ? "font-bold text-blue-700" : "text-blue-700"}`}>
                          {inv.invoice_number} - {inv.party_name}
                        </span>
                        <span className={`text-xs ${isOverdue(inv.due_date) ? "text-red-600" : isDueToday(inv.due_date) ? "font-bold text-gray-500" : "text-gray-500"}`}>
                          Due date: {inv.due_date ? formatDate(inv.due_date, "dd MMM yyyy") : "N/A"} | {getDueStatus(inv.due_date)} | {formatCurrency(inv.balance_due)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {purchaseCount > 0 && (
                  <div className="px-3 py-2">
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                      Purchase Invoices ({purchaseCount})
                    </p>
                    {data!.purchase_unpaid.map((inv) => (
                      <Link
                        key={inv.id}
                        href={`/dashboard/purchase-invoices/${inv.id}`}
                        className={`flex flex-col rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${
                          isOverdue(inv.due_date) ? "bg-red-50" : ""
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        <span className={`truncate ${isOverdue(inv.due_date) ? "text-red-700" : isDueToday(inv.due_date) ? "font-bold text-blue-700" : "text-blue-700"}`}>
                          {inv.invoice_number} - {inv.party_name}
                        </span>
                        <span className={`text-xs ${isOverdue(inv.due_date) ? "text-red-600" : isDueToday(inv.due_date) ? "font-bold text-gray-500" : "text-gray-500"}`}>
                          Due date: {inv.due_date ? formatDate(inv.due_date, "dd MMM yyyy") : "N/A"} | {getDueStatus(inv.due_date)} | {formatCurrency(inv.balance_due)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {totalCount === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-gray-400">
                    No pending invoices
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {pathname === "/dashboard" && (
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white" suppressHydrationWarning>
              {userInitial}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900" suppressHydrationWarning>
                {isLoading ? "Loading..." : userFullName || "User"}
              </p>
              <p className="truncate text-xs text-gray-500" suppressHydrationWarning>
                {isLoading ? "Loading..." : userEmail || ""}
              </p>
            </div>
          </button>
          {showProfileMenu && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </header>
  );
}
