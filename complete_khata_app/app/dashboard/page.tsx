"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Package,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LeaderboardCard } from "./_components/leaderboard-card";
import { customersService } from "@/services/customers.service";
import { cashSalesService } from "@/services/cash-sales.service";
import { dashboardService } from "@/services/dashboard.service";
import { purchaseInvoicesService } from "@/services/purchase-invoices.service";
import { salesInvoicesService } from "@/services/sales-invoices.service";
import { vendorsService } from "@/services/vendors.service";
import { expensesService } from "@/services/expenses.service";
import { stockService } from "@/services/stock.service";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { DashboardPeriod, DashboardSummaryResponse } from "@/types/dashboard.types";
import type { PurchaseInvoice, SalesInvoice } from "@/types/invoice.types";
import type { StockItem } from "@/types/stock.types";

function shortCurrency(value: number) {
  if (value >= 1_000_000) return `Rs ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Rs ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

function formatKg(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "1d": "1 Day",
  "7d": "7 Days",
  "1m": "1 Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

export default function DashboardPage() {
  const [activeSalesId, setActiveSalesId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>("7d");

  const { data } = useQuery({
    queryKey: ["dashboard", "counts"],
    queryFn: () => dashboardService.getCounts(),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["dashboard", "summary", selectedPeriod],
    queryFn: () => dashboardService.getSummary(selectedPeriod),
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers", "dashboard-credit"],
    queryFn: () => customersService.list({ limit: 200 }),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ["vendors", "dashboard-debit"],
    queryFn: () => vendorsService.list({ limit: 200 }),
  });

  const { data: salesData } = useQuery({
    queryKey: ["sales-invoices", "dashboard-chart"],
    queryFn: () => salesInvoicesService.list({ limit: 200 }),
  });

  const { data: cashSalesData } = useQuery({
    queryKey: ["cash-sales", "dashboard-chart"],
    queryFn: () => cashSalesService.list({ limit: 50 }),
  });

  const { data: purchaseInvoicesData } = useQuery({
    queryKey: ["purchase-invoices", "dashboard-chart"],
    queryFn: () => purchaseInvoicesService.list({ limit: 200 }),
  });

  const { data: stockData } = useQuery({
    queryKey: ["stock", "dashboard-chart"],
    queryFn: () => stockService.list({ limit: 200 }),
  });

  const { data: expensesTimelineData } = useQuery({
    queryKey: ["expenses", "timeline"],
    queryFn: () => expensesService.list({ limit: 200 }),
  });

  const customers = useMemo(() => customersData?.items ?? [], [customersData]);
  const vendors = useMemo(() => vendorsData?.items ?? [], [vendorsData]);
  const creditRows = useMemo(
    () =>
      customers
        .map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone ?? "",
          credit: Number(customer.credit_amount ?? 0),
        }))
        .sort((a, b) => b.credit - a.credit)
        .slice(0, 6),
    [customers]
  );
  const totalCustomerCredit = useMemo(
    () => customers.reduce((sum, customer) => sum + Number(customer.credit_amount ?? 0), 0),
    [customers]
  );
  const debitRows = useMemo(() => {
    return vendors
      .map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        phone: vendor.phone ?? "",
        debit: Number(vendor.debit_amount ?? 0),
      }))
      .sort((a, b) => b.debit - a.debit)
      .slice(0, 6);
  }, [vendors]);
  const totalVendorDebit = useMemo(
    () => vendors.reduce((sum, vendor) => sum + Number(vendor.debit_amount ?? 0), 0),
    [vendors]
  );
  const purchaseInvoices = useMemo(() => purchaseInvoicesData?.items ?? [], [purchaseInvoicesData]);
  const invoices = useMemo(() => salesData?.items ?? [], [salesData]);
  const cashSales = useMemo(() => cashSalesData?.items ?? [], [cashSalesData]);
  const cashSalesChartItems = useMemo(() => {
    const grouped = new Map<string, { from_date: string; to_date: string; amount: number }>();
    for (const item of cashSales) {
      const key = `${item.from_date}|${item.to_date}`;
      const current = grouped.get(key) ?? {
        from_date: item.from_date,
        to_date: item.to_date,
        amount: 0,
      };
      current.amount += Number(item.amount ?? 0);
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .sort((a, b) => new Date(a.from_date).getTime() - new Date(b.from_date).getTime())
      .slice(-7);
  }, [cashSales]);
  const maxCashSaleAmount = Math.max(...cashSalesChartItems.map((item) => item.amount), 1);
  const salesSummary = useMemo(
    () =>
      invoices.reduce(
        (summary, invoice) => ({
          total: summary.total + Number(invoice.total_amount ?? 0),
          paid: summary.paid + Number(invoice.amount_paid ?? 0),
          balance: summary.balance + Number(invoice.balance_due ?? 0),
          creditInvoices:
            summary.creditInvoices +
            (invoice.sale_type === "credit" || Number(invoice.balance_due) > 0 ? 1 : 0),
        }),
        { total: 0, paid: 0, balance: 0, creditInvoices: 0 }
      ),
    [invoices]
  );

  const purchaseSummary = useMemo(
    () =>
      purchaseInvoices.reduce(
        (summary, invoice) => ({
          total: summary.total + Number(invoice.total_amount ?? 0),
          paid: summary.paid + Number(invoice.amount_paid ?? 0),
          balance: summary.balance + Number(invoice.balance_due ?? 0),
          debitInvoices:
            summary.debitInvoices +
            (invoice.purchase_type === "credit" || Number(invoice.balance_due) > 0 ? 1 : 0),
        }),
        { total: 0, paid: 0, balance: 0, debitInvoices: 0 }
      ),
    [purchaseInvoices]
  );

  const recentInvoices = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime())
        .slice(-8),
    [invoices]
  );

  const recentPurchaseInvoices = useMemo(
    () =>
      [...purchaseInvoices]
        .sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime())
        .slice(-8),
    [purchaseInvoices]
  );

  const stockRows = useMemo(
    () =>
      [...(stockData?.items ?? [])]
        .sort((a, b) => Number(b.quantity_kg) - Number(a.quantity_kg))
        .slice(0, 8),
    [stockData]
  );
  const totalStockKg = useMemo(
    () => (stockData?.items ?? []).reduce((sum, item) => sum + Number(item.quantity_kg ?? 0), 0),
    [stockData]
  );

  const maxInvoiceTotal = Math.max(...recentInvoices.map((invoice) => Number(invoice.total_amount ?? 0)), 1);
  const maxPurchaseInvoiceTotal = Math.max(
    ...recentPurchaseInvoices.map((invoice) => Number(invoice.total_amount ?? 0)),
    1
  );
  const maxStockKg = Math.max(...stockRows.map((item) => Number(item.quantity_kg ?? 0)), 1);
  const activeInvoice = recentInvoices.find((invoice) => invoice.id === activeSalesId) ?? recentInvoices.at(-1);
  const activePurchaseInvoice = recentPurchaseInvoices.at(-1);

  const totalCustomers = Number(data?.total_customers ?? 0);
  const totalVendors = Number(data?.total_vendors ?? 0);
  const totalSalesInvoices = Number(data?.total_sales_invoices ?? 0);
  const totalPurchaseInvoices = Number(data?.total_purchase_invoices ?? 0);
  const purchaseDebitTotal = Number(data?.purchase_balance_due_total ?? totalVendorDebit ?? 0);
  const monthlyExpensesTotal = Number(data?.monthly_expenses_total ?? 0);
  const periodStats: DashboardSummaryResponse | null = summaryData ?? null;

  return (
    <>
      <Header title="Dashboard" />
      <PageContainer>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <StatCard label="Customers" value={totalCustomers} icon={<Users size={22} />} color="blue" />
          <StatCard label="Vendors" value={totalVendors} icon={<Building2 size={22} />} color="purple" />
          <StatCard label="Sales Invoices" value={totalSalesInvoices} icon={<FileText size={22} />} color="green" />
          <StatCard label="Purchase Invoices" value={totalPurchaseInvoices} icon={<FileText size={22} />} color="blue" />
          <StatCard label="Customer Credit" value={formatCurrency(totalCustomerCredit)} icon={<CreditCard size={22} />} color="yellow" />
          <StatCard label="Vendor Debit" value={formatCurrency(purchaseDebitTotal)} icon={<CreditCard size={22} />} color="red" />
          <StatCard label="Monthly Expenses" value={formatCurrency(monthlyExpensesTotal)} icon={<Receipt size={22} />} color="red" href="/dashboard/expenses" />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Period Summary</h2>
              <p className="text-sm text-gray-500">
                {PERIOD_LABELS[selectedPeriod]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((period) => (
                <Button
                  key={period}
                  type="button"
                  size="sm"
                  variant={selectedPeriod === period ? "primary" : "secondary"}
                  onClick={() => setSelectedPeriod(period)}
                >
                  {PERIOD_LABELS[period]}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Link href="/dashboard/cash-sales" className="block rounded-lg bg-emerald-50 p-4 transition-colors hover:bg-emerald-100">
                <p className="text-xs font-medium uppercase text-emerald-700">Cash Sales</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">{periodStats ? periodStats.cash_sales_count : "—"}</p>
                <p className="text-sm text-gray-600">{periodStats ? formatCurrency(periodStats.cash_sales_total) : "Loading..."}</p>
              </Link>
              <Link href="/dashboard/sales-invoices" className="block rounded-lg bg-blue-50 p-4 transition-colors hover:bg-blue-100">
                <p className="text-xs font-medium uppercase text-blue-700">Invoices</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">{periodStats ? periodStats.sales_invoices_count : "—"}</p>
                <p className="text-sm text-gray-600">{periodStats ? formatCurrency(periodStats.sales_total) : "Loading..."}</p>
              </Link>
              <Link href="/dashboard/purchase-invoices" className="block rounded-lg bg-purple-50 p-4 transition-colors hover:bg-purple-100">
                <p className="text-xs font-medium uppercase text-purple-700">Purchase Invoices</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">
                  {periodStats ? periodStats.purchase_invoices_count : "—"}
                </p>
                <p className="text-sm text-gray-600">{periodStats ? formatCurrency(periodStats.purchase_total) : "Loading..."}</p>
              </Link>
              <Link href="/dashboard/expenses" className="block rounded-lg bg-red-50 p-4 transition-colors hover:bg-red-100">
                <p className="text-xs font-medium uppercase text-red-700">Expenses</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">{periodStats ? formatCurrency(periodStats.expenses_total) : "—"}</p>
                <p className="text-sm text-gray-600">{periodStats ? formatCurrency(periodStats.expenses_total) : "Loading..."}</p>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Link
          href="/dashboard/cash-sales"
          className="block rounded-xl border border-emerald-100 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
          aria-label="Open Cash Sales page"
          title="Open Cash Sales"
        >
          <div className="flex flex-col gap-3 border-b border-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-semibold text-gray-900">Cash Sales Trend</h2>
              <p className="text-sm text-gray-500">Click to open the Cash Sales page</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-700">
              <BarChart3 size={18} />
              <span className="text-sm font-medium">{cashSalesChartItems.length} points</span>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">Total Cash Sales</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">
                  {formatCurrency(cashSalesChartItems.reduce((sum, item) => sum + item.amount, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">Entries</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{cashSales.length || "—"}</p>
              </div>
            </div>
            {cashSalesChartItems.length === 0 ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
                No cash sales yet
              </div>
            ) : (
              <div className="flex h-44 items-end gap-2">
                {cashSalesChartItems.map((item) => {
                  const height = Math.max((item.amount / maxCashSaleAmount) * 100, 8);
                  return (
                    <div key={`${item.from_date}|${item.to_date}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-md bg-emerald-500 transition-all hover:bg-emerald-600"
                          style={{ height: `${height}%` }}
                          title={`${formatDate(item.from_date, "dd MMM yyyy")} to ${formatDate(item.to_date, "dd MMM yyyy")} ${formatCurrency(item.amount)}`}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-gray-500">
                          {item.from_date === item.to_date
                            ? formatDate(item.from_date, "dd MMM")
                            : `${formatDate(item.from_date, "dd MMM")} - ${formatDate(item.to_date, "dd MMM")}`}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-900">{shortCurrency(item.amount)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Link>

        <Card href="/dashboard/expenses">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Expenses Trend</h2>
              <p className="text-sm text-gray-500">Daily expense amounts</p>
            </div>
            <Receipt size={18} className="text-red-600" />
          </CardHeader>
          <CardBody>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">Total Expenses</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(monthlyExpensesTotal)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">Entries</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{expensesTimelineData?.total ?? "—"}</p>
              </div>
            </div>
            {(() => {
              const headingMap = new Map<string, number>();
              for (const item of expensesTimelineData?.items ?? []) {
                headingMap.set(item.heading, (headingMap.get(item.heading) ?? 0) + Number(item.amount ?? 0));
              }
              const headings = [...headingMap.entries()]
                .map(([name, amount]) => ({ name, amount }))
                .sort((a, b) => b.amount - a.amount);
              const maxHeadingAmount = Math.max(...headings.map((h) => h.amount), 1);
              return headings.length > 0 ? (
                <div className="rounded-lg border border-gray-100 p-4">
                  <p className="mb-1 text-sm font-medium text-gray-900">By Heading</p>
                  <p className="mb-3 text-xs text-gray-500">Total per category</p>
                  <div className="flex items-end gap-3">
                    {headings.map((heading) => {
                      const height = Math.max((heading.amount / maxHeadingAmount) * 100, 8);
                      return (
                        <div key={heading.name} className="flex h-40 flex-1 flex-col items-center justify-end gap-2">
                          <div className="flex w-full flex-1 items-end">
                            <div
                              className="w-full rounded-t-md bg-red-500 transition-all hover:bg-red-600"
                              style={{ height: `${height}%` }}
                              title={`${heading.name}: ${formatCurrency(heading.amount)}`}
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-[11px] text-gray-500">{heading.name.split(" ")[0]}</p>
                            <p className="text-[11px] font-semibold text-gray-900">{shortCurrency(heading.amount)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <LeaderboardCard
            title="Customer Credit"
            description="Highest outstanding balances"
            linkHref="/dashboard/customers"
            linkLabel="Customers"
            items={creditRows.map((customer) => ({
              id: customer.id,
              name: customer.name,
              amount: customer.credit,
              amountLabel: shortCurrency(customer.credit),
              href: `/dashboard/customers/${customer.id}`,
            }))}
            totalLabel="Total Credit"
            totalValue={formatCurrency(totalCustomerCredit)}
            emptyMessage="No customers yet"
            tone="blue"
          />

          <Card className="h-full">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Sales Invoices</h2>
                  <p className="text-sm text-gray-500">Invoice movement for the selected period</p>
                </div>
              </div>
              <Link href="/dashboard/sales-invoices" className="text-sm font-medium text-blue-700 hover:text-blue-800">
                Invoices
              </Link>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total", value: salesSummary.total, color: "bg-emerald-600" },
                  { label: "Collected", value: salesSummary.paid, color: "bg-blue-600" },
                  { label: "Balance", value: salesSummary.balance, color: "bg-amber-500" },
                  { label: "Credit", value: salesSummary.creditInvoices, color: "bg-gray-700", count: true },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium uppercase text-gray-500">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {item.count ? item.value : formatCurrency(item.value)}
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-gray-200">
                      <div
                        className={`h-1.5 rounded-full ${item.color}`}
                        style={{
                          width: `${item.count
                            ? Math.min(Number(item.value) * 12, 100)
                            : Math.max((Number(item.value) / Math.max(salesSummary.total, 1)) * 100, 4)
                            }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-gray-100 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Selected Period Sales</p>
                    <p className="text-xs text-gray-500">
                      {activeInvoice
                        ? `${activeInvoice.invoice_number} - ${formatCurrency(activeInvoice.total_amount)}`
                        : "No invoices yet"}
                    </p>
                  </div>
                  <BarChart3 size={18} className="text-emerald-600" />
                </div>
                <div className="flex h-56 items-end gap-2">
                  {recentInvoices.length === 0 ? (
                    <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-400">
                      No sales invoices yet
                    </div>
                  ) : (
                    recentInvoices.map((invoice: SalesInvoice) => {
                      const height = Math.max((Number(invoice.total_amount) / maxInvoiceTotal) * 100, 8);
                      const isActive = activeInvoice?.id === invoice.id;

                      return (
                        <Link
                          key={invoice.id}
                          href={`/dashboard/sales-invoices/${invoice.id}`}
                          onMouseEnter={() => setActiveSalesId(invoice.id)}
                          onFocus={() => setActiveSalesId(invoice.id)}
                          className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                          title={`${invoice.invoice_number} ${formatCurrency(invoice.total_amount)}`}
                        >
                          <div
                            className={`w-full rounded-t-md transition-all ${isActive ? "bg-emerald-600" : "bg-emerald-200 hover:bg-emerald-500"
                              }`}
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-xs text-gray-500">{formatDate(invoice.invoice_date, "dd MMM")}</span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Purchase Invoices</h2>
                  <p className="text-sm text-gray-500">Invoice movement for purchases in the selected period</p>
                </div>
              </div>
              <Link href="/dashboard/purchase-invoices" className="text-sm font-medium text-blue-700 hover:text-blue-800">
                Invoices
              </Link>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total", value: purchaseSummary.total, color: "bg-purple-600" },
                  { label: "Paid", value: purchaseSummary.paid, color: "bg-blue-600" },
                  { label: "Balance", value: purchaseSummary.balance, color: "bg-amber-500" },
                  { label: "Debit", value: purchaseSummary.debitInvoices, color: "bg-gray-700", count: true },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium uppercase text-gray-500">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {item.count ? item.value : formatCurrency(item.value)}
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-gray-200">
                      <div
                        className={`h-1.5 rounded-full ${item.color}`}
                        style={{
                          width: `${item.count
                            ? Math.min(Number(item.value) * 12, 100)
                            : Math.max((Number(item.value) / Math.max(purchaseSummary.total, 1)) * 100, 4)
                            }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-gray-100 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Selected Period Purchase</p>
                    <p className="text-xs text-gray-500">
                      {activePurchaseInvoice
                        ? `${activePurchaseInvoice.invoice_number} - ${formatCurrency(activePurchaseInvoice.total_amount)}`
                        : "No purchase invoices yet"}
                    </p>
                  </div>
                  <BarChart3 size={18} className="text-purple-600" />
                </div>
                <div className="flex h-56 items-end gap-2">
                  {recentPurchaseInvoices.length === 0 ? (
                    <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-400">
                      No purchase invoices yet
                    </div>
                  ) : (
                    recentPurchaseInvoices.map((invoice: PurchaseInvoice) => {
                      const height = Math.max((Number(invoice.total_amount) / maxPurchaseInvoiceTotal) * 100, 8);

                      return (
                        <Link
                          key={invoice.id}
                          href={`/dashboard/purchase-invoices/${invoice.id}`}
                          className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                          title={`${invoice.invoice_number} ${formatCurrency(invoice.total_amount)}`}
                        >
                          <div
                            className="w-full rounded-t-md bg-purple-200 transition-all hover:bg-purple-500"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-xs text-gray-500">{formatDate(invoice.invoice_date, "dd MMM")}</span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <LeaderboardCard
            title="Vendor Debit"
            description="Highest outstanding purchase balances"
            linkHref="/dashboard/purchase-invoices"
            linkLabel="Purchase Invoices"
            items={debitRows.map((vendor) => ({
              id: vendor.id,
              name: vendor.name,
              amount: vendor.debit,
              amountLabel: shortCurrency(vendor.debit),
              href: `/dashboard/vendors/${vendor.id}`,
            }))}
            totalLabel="Total Debit"
            totalValue={formatCurrency(purchaseDebitTotal)}
            emptyMessage="No vendors yet"
            tone="red"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Package size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Stock Overview</h2>
                <p className="text-sm text-gray-500">Top available inventory by kg</p>
              </div>
            </div>
            <Link href="/dashboard/stock-management" className="text-sm font-medium text-blue-700 hover:text-blue-800">
              Stock
            </Link>
          </CardHeader>
          <CardBody>
            {stockRows.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
                No stock items yet
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_0.8fr]">
                <div className="flex h-72 items-end gap-3">
                {stockRows.map((item: StockItem) => {
                  const quantity = Number(item.quantity_kg ?? 0);
                  const height = Math.max((quantity / maxStockKg) * 100, 10);
                  return (
                    <Link
                      key={item.id}
                      href="/dashboard/stock-management"
                      className="flex h-full flex-1 flex-col justify-end rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:border-teal-100 hover:bg-teal-50"
                        title={`${item.item_name} ${formatKg(quantity)}`}
                      >
                        <div className="flex min-h-0 flex-1 items-end">
                          <div
                            className="w-full rounded-t-md bg-teal-600 transition-all group-hover:bg-teal-700"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="mt-3 min-h-[52px]">
                          <p className="truncate text-sm font-semibold text-gray-900">{item.item_name}</p>
                          <p className="text-xs font-medium text-teal-700">{formatKg(quantity)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="rounded-lg bg-teal-50 p-4">
                  <p className="text-sm font-medium text-teal-700">Total Stock</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{formatKg(totalStockKg)}</p>
                  <div className="mt-6 space-y-3">
                    {stockRows.slice(0, 4).map((item) => {
                      const quantity = Number(item.quantity_kg ?? 0);
                      return (
                        <div key={item.id}>
                          <div className="mb-1 flex justify-between gap-3 text-xs">
                            <span className="truncate font-medium text-gray-700">{item.item_name}</span>
                            <span className="text-teal-700">{formatKg(quantity)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white">
                            <div
                              className="h-2 rounded-full bg-teal-600"
                              style={{ width: `${Math.max((quantity / maxStockKg) * 100, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </PageContainer>

    </>
  );
}
