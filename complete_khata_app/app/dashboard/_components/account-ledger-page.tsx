"use client";

import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/utils/formatters";

type LedgerRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  href: string;
};

interface AccountLedgerPageProps {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  summaryLabel: string;
  summaryValue: number;
  paidLabel: string;
  paidValue: number;
  balanceLabel: string;
  balanceValue: number;
  rows: LedgerRow[];
  emptyMessage: string;
}

export function AccountLedgerPage({
  title,
  subtitle,
  backHref,
  backLabel,
  summaryLabel,
  summaryValue,
  paidLabel,
  paidValue,
  balanceLabel,
  balanceValue,
  rows,
  emptyMessage,
}: AccountLedgerPageProps) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <Link href={backHref}>
          <Button variant="secondary" size="sm">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{backLabel}</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">{summaryLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(summaryValue)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">{paidLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(paidValue)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-gray-500">{balanceLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(balanceValue)}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Invoices</h2>
            <p className="text-sm text-gray-500">Open any invoice to add payments.</p>
          </div>
        </CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
              {emptyMessage}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto md:hidden">
                <div className="grid grid-cols-2 gap-3">
                  {rows.map((row) => (
                    <Link
                      key={row.id}
                      href={row.href}
                      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                    >
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Invoice #</p>
                          <p className="text-sm font-medium text-gray-900">{row.invoice_number}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Date</p>
                          <p className="text-sm text-gray-700">{formatDate(row.invoice_date, "dd MMM yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Total</p>
                          <p className="text-sm text-gray-700">{formatCurrency(row.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Paid</p>
                          <p className="text-sm text-gray-700">{formatCurrency(row.amount_paid)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Balance</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(row.balance_due)}</p>
                        </div>
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-blue-700">
                            <Eye size={14} />
                            <span className="text-xs font-medium">Open</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-100 hidden md:block">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice #</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Total</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Paid</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Balance</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.invoice_number}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(row.invoice_date, "dd MMM yyyy")}</td>
                        <td className="px-4 py-3 text-gray-700">{formatCurrency(row.total_amount)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatCurrency(row.amount_paid)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatCurrency(row.balance_due)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={row.href}
                            className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-blue-700 transition-colors hover:bg-blue-50"
                          >
                            <Eye size={15} />
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
