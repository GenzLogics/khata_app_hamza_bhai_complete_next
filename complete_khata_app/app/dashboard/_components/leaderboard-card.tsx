"use client";

import Link from "next/link";
import { formatCurrency } from "@/utils/formatters";

type LeaderboardItem = {
  id: string;
  name: string;
  amount: number;
  href: string;
  amountLabel?: string;
};

type Tone = "blue" | "red";

interface LeaderboardCardProps {
  title: string;
  description: string;
  linkHref: string;
  linkLabel: string;
  items: LeaderboardItem[];
  totalLabel: string;
  totalValue: string;
  emptyMessage: string;
  tone: Tone;
}

const TONE_STYLES: Record<
  Tone,
  {
    accent: string;
    badge: string;
    panel: string;
    bar: string;
    barHover: string;
    link: string;
    empty: string;
  }
> = {
  blue: {
    accent: "text-blue-700 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    panel: "bg-blue-50",
    bar: "bg-blue-600",
    barHover: "group-hover:bg-blue-700",
    link: "text-blue-700 hover:text-blue-800",
    empty: "border-blue-100 bg-blue-50",
  },
  red: {
    accent: "text-red-700 bg-red-50",
    badge: "bg-red-100 text-red-700",
    panel: "bg-red-50",
    bar: "bg-red-600",
    barHover: "group-hover:bg-red-700",
    link: "text-blue-700 hover:text-blue-800",
    empty: "border-red-100 bg-red-50",
  },
};

export function LeaderboardCard({
  title,
  description,
  linkHref,
  linkLabel,
  items,
  totalLabel,
  totalValue,
  emptyMessage,
  tone,
}: LeaderboardCardProps) {
  const styles = TONE_STYLES[tone];
  const maxValue = Math.max(...items.map((item) => item.amount), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${styles.accent}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${tone === "blue" ? "bg-blue-600" : "bg-red-600"}`} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <Link href={linkHref} className={`text-sm font-medium ${styles.link}`}>
          {linkLabel}
        </Link>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {items.length === 0 ? (
          <div className={`flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-gray-400 ${styles.empty}`}>
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_200px]">
            <div className="space-y-3">
              {items.map((item, index) => {
                const width = Math.max((item.amount / maxValue) * 100, 9);
                const amountText = item.amountLabel ?? formatCurrency(item.amount);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group block rounded-lg border border-transparent p-2 transition-colors hover:border-gray-100 hover:bg-gray-50"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold ${styles.badge}`}>
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-gray-800">{item.name}</span>
                      </div>
                      <span className="shrink-0 font-semibold text-gray-900">{amountText}</span>
                    </div>
                    <div className="h-6 rounded bg-gray-100">
                      <div
                        className={`flex h-6 items-center justify-end rounded px-2 text-[11px] font-medium text-white transition-all ${styles.bar} ${styles.barHover}`}
                        style={{ width: `${width}%` }}
                      >
                        {amountText}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className={`flex w-full max-w-full flex-col justify-between rounded-lg p-4 lg:max-w-[220px] ${styles.panel}`}>
              <div>
                <p className={`text-sm font-medium ${tone === "blue" ? "text-blue-700" : "text-red-700"}`}>{totalLabel}</p>
                <p className="mt-2 break-words text-2xl font-bold text-gray-900">{totalValue}</p>
              </div>
              <p className={`mt-6 text-sm ${tone === "blue" ? "text-blue-700" : "text-red-700"}`}>
                Click a bar to open that {tone === "blue" ? "customer" : "vendor"}'s invoices.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
