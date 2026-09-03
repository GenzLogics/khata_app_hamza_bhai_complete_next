"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { ToastContainer } from "@/components/ui/Toast";
import Link from "next/link";
import { dashboardService } from "@/services/dashboard.service";
import { investorsService } from "@/services/investors.service";
import { formatCurrency, formatDate, getLocalDateString } from "@/utils/formatters";
import type { DashboardDailyResponse, DashboardSummaryResponse } from "@/types/dashboard.types";
import type { Investor } from "@/types/investor.types";
import { REPORT_TYPE_LABEL } from "@/types/dashboard.types";

type PresetPeriod = "1d" | "7d";

const PRESET_LABELS: Record<PresetPeriod, string> = {
  "1d": "1 Day",
  "7d": "7 Days",
};

function getDefaultFromDate(period: PresetPeriod): string {
  const today = new Date();
  const from = new Date(today);
  if (period === "1d") {
    from.setDate(from.getDate() - 1);
  } else if (period === "7d") {
    from.setDate(from.getDate() - 6);
  }
  return getLocalDateString(from);
}

function getPeriodDates(period: PresetPeriod): { from_date: string; to_date: string } {
  const today = new Date();
  const from = new Date(today);
  if (period === "1d") {
    from.setDate(from.getDate() - 1);
  } else if (period === "7d") {
    from.setDate(from.getDate() - 6);
  }
  return {
    from_date: getLocalDateString(from),
    to_date: getLocalDateString(today),
  };
}

function getActiveDateRange(
  mode: "preset" | "custom",
  selectedPeriod: PresetPeriod,
  fromDate: string,
  toDate: string
): { from_date: string; to_date: string } {
  if (mode === "custom") {
    return { from_date: fromDate, to_date: toDate };
  }
  return getPeriodDates(selectedPeriod);
}

type ReportItem = {
  date: string;
  type: DashboardDailyResponse["items"][number]["type"] | "investment";
  amount: number;
  notes: string | null;
  heading: string | null;
  sub_heading: string | null;
  customer_name: string | null;
  vendor_name: string | null;
  invoice_id?: string | null;
};

export default function ReportsPage() {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedPeriod, setSelectedPeriod] = useState<PresetPeriod>("7d");
  const [fromDate, setFromDate] = useState(getDefaultFromDate("7d"));
  const [toDate, setToDate] = useState(getLocalDateString());
  const toast = useToast();

  const activeRange = useMemo(
    () => getActiveDateRange(mode, selectedPeriod, fromDate, toDate),
    [mode, selectedPeriod, fromDate, toDate]
  );

  const queryParams = useMemo(() => {
    if (mode === "custom") {
      return { from_date: fromDate, to_date: toDate };
    }
    return { period: selectedPeriod };
  }, [mode, selectedPeriod, fromDate, toDate]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "reports", queryParams],
    queryFn: () =>
      dashboardService.getSummary(
        mode === "custom" ? undefined : selectedPeriod,
        mode === "custom" ? fromDate : undefined,
        mode === "custom" ? toDate : undefined
      ),
  });

  const { data: dailyData } = useQuery({
    queryKey: ["dashboard", "daily", mode, selectedPeriod, fromDate, toDate],
    queryFn: () => {
      const dates = getActiveDateRange(mode, selectedPeriod, fromDate, toDate);
      return dashboardService.getDaily(dates.from_date, dates.to_date);
    },
  });

  const { data: investorsData } = useQuery({
    queryKey: ["investors", "reports", mode, selectedPeriod, fromDate, toDate],
    queryFn: () => investorsService.list({ skip: 0, limit: 200 }),
  });

  const stats = data as DashboardSummaryResponse | null;
  const activeFrom = activeRange.from_date;
  const activeTo = activeRange.to_date;

  const cashSales = Number(stats?.cash_sales_total ?? 0);
  const reportItems = useMemo<ReportItem[]>(() => {
    const baseItems =
      dailyData?.items.filter(
        (item) =>
          item.type !== "invoice" &&
          item.type !== "invoice_credit" &&
          item.type !== "purchase_invoice"
      ) ?? [];
    const investmentItems = (investorsData?.items ?? [])
      .filter(
        (investor: Investor) =>
          !!investor.investment_date &&
          investor.investment_date >= activeFrom &&
          investor.investment_date <= activeTo
      )
      .map((investor) => ({
        date: investor.investment_date!,
        type: "investment" as const,
        amount: Number(investor.investment_amount ?? 0),
        notes: investor.investor_name ? `Investor - ${investor.investor_name}` : "Investor contribution",
        heading: null,
        sub_heading: null,
        customer_name: null,
        vendor_name: null,
        invoice_id: null,
      }));

    return [...baseItems, ...investmentItems].sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyData?.items, investorsData?.items, activeFrom, activeTo]);

  const salesPaymentIncome = useMemo(() => {
    return reportItems
      .filter((item) => item.type === "payment")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  }, [reportItems]);

  const investmentIncome = useMemo(() => {
    return (investorsData?.items ?? [])
      .filter((investor: Investor) => investor.investment_date && investor.investment_date >= activeFrom && investor.investment_date <= activeTo)
      .reduce((sum, investor) => sum + Number(investor.investment_amount ?? 0), 0);
  }, [investorsData?.items, activeFrom, activeTo]);

  const totalIncome = cashSales + investmentIncome + salesPaymentIncome;

  const purchasePaymentTotal = useMemo(() => {
    return reportItems
      .filter((item) => item.type === "purchase_payment")
      .reduce((sum, item) => sum + item.amount, 0);
  }, [reportItems]);

  const expenseTotal = useMemo(() => {
    return reportItems
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
  }, [reportItems]);

  const totalExpenses = purchasePaymentTotal + expenseTotal;
  const netBalance = totalIncome - totalExpenses;

  function handlePresetSelect(period: PresetPeriod) {
    setMode("preset");
    setSelectedPeriod(period);
  }

  function handleCustomApply() {
    setMode("custom");
  }

  function handleDownloadPDF() {
    if (!dailyData || dailyData.items.length === 0) {
      toast.warning("No data available to export.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const colWidth = (pageWidth - margin * 3.5) / 2;
    const leftX = margin;
    const rightX = margin * 2 + colWidth;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Income Balance Sheet", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `From: ${formatDate(activeRange.from_date)}    To: ${formatDate(activeRange.to_date)}`,
      pageWidth / 2,
      28,
      { align: "center" }
    );

    let yPos = 36;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 128, 61);
    doc.text(`Total Income: ${formatCurrency(totalIncome)}`, leftX, yPos);
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`, rightX, yPos);
    yPos += 5;
    doc.setTextColor(0, 0, 0);
    doc.text(`Net Balance: ${formatCurrency(netBalance)}`, rightX, yPos);
    yPos += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 128, 61);
    doc.text("Income", leftX, yPos);
    doc.setTextColor(220, 38, 38);
    doc.text("Expenses", rightX, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 4;

    if (reportItems.length === 0) {
      doc.text("No transactions found.", margin, yPos);
      doc.save(`Income_Balance_sheet ${activeRange.from_date} to ${activeRange.to_date}.pdf`.trim());
      return;
    }

    const incomeItems = reportItems.filter((item) => item.type !== "expense" && item.type !== "purchase_payment");
    const expenseItems = reportItems.filter((item) => item.type === "expense" || item.type === "purchase_payment");

    function buildRows(items: ReportItem[]) {
      return items.map((item) => {
        const typeLabel = REPORT_TYPE_LABEL[item.type] ?? item.type;

        const isExpense = item.type === "expense" || item.type === "purchase_payment";
        const sign = isExpense ? "-" : "+";

        let notesText = item.notes || "";
        if (item.type === "expense" && item.heading) {
          notesText = [item.heading, item.sub_heading].filter(Boolean).join(" - ") || notesText;
        }
        const partyName = item.customer_name || item.vendor_name || "";
        if (partyName) {
          notesText = partyName + (notesText ? ` - ${notesText}` : "");
        }

        return [formatDate(item.date), typeLabel, notesText, `${sign} ${formatCurrency(item.amount)}`];
      });
    }

    const incomeRows = incomeItems.length > 0 ? buildRows(incomeItems) : [["â€”", "â€”", "No transactions", "â€”"]];
    const expenseRows = expenseItems.length > 0 ? buildRows(expenseItems) : [["â€”", "â€”", "No transactions", "â€”"]];
    const emptySide = ["", "", "", ""];
    const rowCount = Math.max(incomeRows.length, expenseRows.length);

    const pairedBody = Array.from({ length: rowCount }, (_, i) => [
      ...(incomeRows[i] ?? emptySide),
      ...(expenseRows[i] ?? emptySide),
    ]);

    const halfColWidth = colWidth / 4;
    const incomeHeadColor: [number, number, number] = [21, 128, 61];
    const expenseHeadColor: [number, number, number] = [220, 38, 38];

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
      head: [
        [
          { content: "Date", styles: { fillColor: incomeHeadColor } },
          { content: "Type", styles: { fillColor: incomeHeadColor } },
          { content: "Notes", styles: { fillColor: incomeHeadColor } },
          { content: "Amount", styles: { fillColor: incomeHeadColor } },
          { content: "Date", styles: { fillColor: expenseHeadColor } },
          { content: "Type", styles: { fillColor: expenseHeadColor } },
          { content: "Notes", styles: { fillColor: expenseHeadColor } },
          { content: "Amount", styles: { fillColor: expenseHeadColor } },
        ],
      ],
      body: pairedBody,
      foot: [["", "", "Total", `+ ${formatCurrency(totalIncome)}`, "", "", "Total", `- ${formatCurrency(totalExpenses)}`]],
      theme: "grid",
      headStyles: { textColor: 255, fontSize: 8, fontStyle: "bold" },
      footStyles: { fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak", valign: "top" },
      columnStyles: {
        0: { cellWidth: halfColWidth * 0.9 },
        1: { cellWidth: halfColWidth * 0.95 },
        3: { halign: "right", cellWidth: halfColWidth * 1.15 },
        4: { cellWidth: halfColWidth * 0.9 },
        5: { cellWidth: halfColWidth * 0.95 },
        7: { halign: "right", cellWidth: halfColWidth * 1.15 },
      },
      showHead: "everyPage",
      showFoot: "lastPage",
      didParseCell: (data) => {
        if (data.section === "foot") {
          if (data.column.index <= 3) {
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.textColor = incomeHeadColor;
          } else {
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.textColor = expenseHeadColor;
          }
        }
        if (data.section === "body" && data.column.index === 3 && data.cell.raw) {
          data.cell.styles.textColor = incomeHeadColor;
        }
        if (data.section === "body" && data.column.index === 7 && data.cell.raw) {
          data.cell.styles.textColor = expenseHeadColor;
        }
      },
    });

    const fileName = `Income_Balance_sheet ${activeRange.from_date} to ${activeRange.to_date}.pdf`.trim();
    doc.save(fileName);
  }

  return (
    <>
      <Header title="Balance Sheet" />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <PageContainer>
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Period</h2>
              <p className="text-sm text-gray-500">
                Select a range to view income vs expenses
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRESET_LABELS) as PresetPeriod[]).map((period) => (
                  <Button
                    key={period}
                    type="button"
                    size="sm"
                    variant={mode === "preset" && selectedPeriod === period ? "primary" : "secondary"}
                    onClick={() => handlePresetSelect(period)}
                  >
                    {PRESET_LABELS[period]}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  label="From"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="max-w-[160px]"
                />
                <Input
                  label="To"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="max-w-[160px]"
                />
                <Button type="button" size="sm" onClick={handleCustomApply}>
                  Apply
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={handleDownloadPDF}>
                  Download PDF
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {reportItems.length > 0 && (
          <Card>
            <CardBody>
              <div className="mb-4">
                <h2 className="font-semibold text-gray-900">Day-wise Statement</h2>
                <p className="text-xs text-gray-500">
                  From {formatDate(activeRange.from_date)} to {formatDate(activeRange.to_date)}
                </p>
              </div>
              <div className="space-y-4">
                {Object.entries(
                  reportItems.reduce<Record<string, ReportItem[]>>((acc, item) => {
                    if (!acc[item.date]) acc[item.date] = [];
                    acc[item.date].push(item);
                    return acc;
                  }, {})
                ).map(([date, items]) => (
                  <div key={date} className="rounded-lg border border-gray-100">
                    <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-sm font-semibold text-gray-900">{formatDate(date)}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {items.map((item, idx) => {
                        let isPositive = true;
                        const typeLabel = REPORT_TYPE_LABEL[item.type] ?? item.type;

                        if (item.type === "expense" || item.type === "purchase_payment") {
                          isPositive = false;
                        }

                        let notesContent: React.ReactNode = item.notes || typeLabel;
                        let href: string | undefined;

                        if (item.type === "expense") {
                          notesContent = (
                            <>
                              <span>{[item.heading, item.sub_heading].filter(Boolean).join(" - ") || typeLabel}</span>
                              <span className="block text-xs text-gray-500">
                                From {formatDate(activeRange.from_date)} to {formatDate(activeRange.to_date)}
                              </span>
                            </>
                          );
                        } else if (item.invoice_id) {
                          href = item.type === "purchase_payment"
                            ? `/dashboard/purchase-invoices/${item.invoice_id}`
                            : `/dashboard/sales-invoices/${item.invoice_id}`;
                          const partyName = item.customer_name || item.vendor_name || "";
                          notesContent = (
                            <Link
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-blue-600 hover:underline"
                            >
                              {partyName ? `${partyName} - ` : ""}{item.notes || typeLabel}
                            </Link>
                          );
                        } else if (item.type === "investment") {
                          notesContent = item.notes || "Investor contribution";
                        } else if (item.type === "cash_sale") {
                          notesContent = `From ${formatDate(activeRange.from_date)} to ${formatDate(activeRange.to_date)}`;
                        }

                        return (
                          <div key={idx} className="flex items-center justify-between px-3 py-2">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                                {typeLabel}
                              </p>
                              {notesContent && <p className="text-xs text-gray-500">{notesContent}</p>}
                            </div>
                            <p className={`text-sm font-bold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                              {isPositive ? "+" : "-"}{formatCurrency(item.amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold text-gray-900">Breakdown</h2>
            <p className="mb-4 text-xs text-gray-500">
              From {formatDate(activeRange.from_date)} to {formatDate(activeRange.to_date)}
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <span className="text-sm text-gray-600">Cash Sales</span>
                  <p className="text-xs text-gray-500">
                    {formatDate(activeRange.from_date)} to {formatDate(activeRange.to_date)}
                    {mode === "preset" ? ` (${PRESET_LABELS[selectedPeriod]})` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{isLoading ? "—" : formatCurrency(cashSales)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-sm text-gray-600">Sales Payments</span>
                <span className="text-sm font-semibold text-gray-900">{isLoading ? "—" : formatCurrency(salesPaymentIncome)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-sm text-gray-600">Investments</span>
                <span className="text-sm font-semibold text-gray-900">{isLoading ? "—" : formatCurrency(investmentIncome)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
                <span className="text-sm font-medium text-emerald-700">Total Income</span>
                <span className="text-sm font-bold text-emerald-700">{isLoading ? "—" : formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <span className="text-sm font-medium text-red-700">Purchase Payments</span>
                <span className="text-sm font-bold text-red-700">{isLoading ? "—" : formatCurrency(purchasePaymentTotal)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <span className="text-sm font-medium text-red-700">Expenses</span>
                <span className="text-sm font-bold text-red-700">{isLoading ? "—" : formatCurrency(expenseTotal)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <span className="text-sm font-medium text-red-700">Total Expenses</span>
                <span className="text-sm font-bold text-red-700">{isLoading ? "—" : formatCurrency(totalExpenses)}</span>
              </div>
              <div className={`flex items-center justify-between rounded-lg p-3 ${netBalance >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <span className={`text-sm font-medium ${netBalance >= 0 ? "text-emerald-700" : "text-red-700"}`}>Net Balance</span>
                <span className={`text-sm font-bold ${netBalance >= 0 ? "text-emerald-700" : "text-red-700"}`}>{isLoading ? "—" : formatCurrency(netBalance)}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {stats && (
          <Card>
            <CardBody>
              <p className="text-xs text-gray-500">
                Showing data from {formatDate(stats.from_date)} to {formatDate(stats.to_date)}
                {mode === "preset" ? ` (${PRESET_LABELS[selectedPeriod]})` : " (custom range)"}
              </p>
            </CardBody>
          </Card>
        )}
      </PageContainer>
    </>
  );
}

