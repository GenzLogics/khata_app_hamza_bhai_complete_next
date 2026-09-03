"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Download, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { ToastContainer } from "@/components/ui/Toast";
import { Table, Pagination } from "@/components/ui/Table";
import { customersService } from "@/services/customers.service";
import { salesInvoicesService } from "@/services/sales-invoices.service";
import { extractErrorMessage } from "@/services/api";
import { downloadInvoicePdf } from "@/utils/invoice-pdf";
import { formatCurrency, formatDate, capitalizeFirst } from "@/utils/formatters";
import type { SalesInvoice } from "@/types/invoice.types";
import { useToast } from "@/hooks/useToast";

const LIMIT = 20;

function SalesInvoicesContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer_id") ?? undefined;
  const [skip, setSkip] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SalesInvoice | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["sales-invoices", skip, customerId],
    queryFn: () => salesInvoicesService.list({ skip, limit: LIMIT, customer_id: customerId }),
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => customersService.getById(customerId!),
    enabled: Boolean(customerId),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", "sales-invoice-names"],
    queryFn: () => customersService.list({ limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: salesInvoicesService.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["sales-invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Sales invoice deleted");
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const title = customerId
    ? `${customer?.name ?? "Customer"} Invoices`
    : "Sales Invoices";

  const columns = [
    { header: "Invoice #", accessor: "invoice_number" as const },
    { header: "Customer", accessor: (r: SalesInvoice) => customer?.name ?? customers?.items.find((item) => item.id === r.customer_id)?.name ?? r.customer_id },
    { header: "Date", accessor: (r: SalesInvoice) => formatDate(r.invoice_date) },
    { header: "Due Date", accessor: (r: SalesInvoice) => formatDate(r.due_date) },
    { header: "Type", accessor: (r: SalesInvoice) => capitalizeFirst(r.sale_type) },
    { header: "Notes", accessor: (r: SalesInvoice) => (
      <span className="block max-w-[280px] truncate" title={r.notes ?? ""}>
        {r.notes || "-"}
      </span>
    ) },
    { header: "Total", accessor: (r: SalesInvoice) => formatCurrency(r.total_amount) },
    { header: "Paid", accessor: (r: SalesInvoice) => formatCurrency(r.amount_paid) },
    { header: "Balance", accessor: (r: SalesInvoice) => formatCurrency(r.balance_due) },
    { header: "", accessor: (r: SalesInvoice) => (
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/sales-invoices/${r.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
          aria-label="View sales invoice"
          title="View"
        >
          <Eye size={15} />
        </Link>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          aria-label="Download sales invoice"
          title="Download"
          onClick={async () => {
            const invoice = await salesInvoicesService.getById(r.id);
            const customer = await customersService.getById(invoice.customer_id);
            downloadInvoicePdf({
              documentTypeLabel: "Sales Invoice",
              invoiceNumber: invoice.invoice_number,
              invoiceDate: invoice.invoice_date,
              dueDate: invoice.due_date,
              partyLabel: "Customer",
              partyName: customer.name || invoice.customer_id,
              saleOrPurchaseTypeLabel: invoice.sale_type,
              notes: invoice.notes ?? undefined,
              subtotal: invoice.subtotal,
              discount: invoice.discount,
              totalAmount: invoice.total_amount,
              amountPaid: invoice.amount_paid,
              balanceDue: invoice.balance_due,
              items: invoice.items,
              payments: invoice.payments?.map((p) => ({
                payment_date: p.payment_date,
                amount: p.amount,
                notes: p.notes ?? null,
              })),
            });
          }}
        >
          <Download size={15} />
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
          aria-label="Delete sales invoice"
          title="Delete"
          onClick={() => setDeleteTarget(r)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    )},
  ];

  return (
    <>
      <Header
        title={title}
        actions={
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {customerId && (
              <Link href="/dashboard/customers">
                <Button variant="ghost" size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline"> Customers</span>
                </Button>
              </Link>
            )}
            <Link href="/dashboard/sales-invoices/new">
              <Button size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
                <Plus size={16} />
                <span className="hidden sm:inline"> New Invoice</span>
              </Button>
            </Link>
          </div>
        }
      />
      <PageContainer>
        <Table columns={columns} data={data?.items ?? []} keyExtractor={(r) => r.id} isLoading={isLoading} />
        {data && data.total > LIMIT && <Pagination total={data.total} skip={skip} limit={LIMIT} onPageChange={setSkip} />}
      </PageContainer>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
        title="Delete Sales Invoice"
        message={`Are you sure you want to delete invoice #${deleteTarget?.invoice_number ?? ""}? This action cannot be undone.`}
      />
    </>
  );
}

export default function SalesInvoicesPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-400">Loading...</div>}>
      <SalesInvoicesContent />
    </Suspense>
  );
}
