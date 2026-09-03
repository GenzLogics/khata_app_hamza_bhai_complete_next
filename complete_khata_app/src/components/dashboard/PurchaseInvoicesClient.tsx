"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Table, Pagination } from "@/components/ui/Table";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { ToastContainer } from "@/components/ui/Toast";
import { purchaseInvoicesService } from "@/services/purchase-invoices.service";
import { vendorsService } from "@/services/vendors.service";
import { downloadInvoicePdf } from "@/utils/invoice-pdf";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { PurchaseInvoice } from "@/types/invoice.types";
import { useToast } from "@/hooks/useToast";

const LIMIT = 20;

export default function PurchaseInvoicesClient() {
  const [skip, setSkip] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const searchParams = useSearchParams();
  const vendorId = searchParams.get("vendor_id") || undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-invoices", skip, vendorId],
    queryFn: () => purchaseInvoicesService.list({ skip, limit: LIMIT, vendor_id: vendorId }),
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors", "purchase-invoice-names"],
    queryFn: () => vendorsService.list({ limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: purchaseInvoicesService.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Purchase invoice deleted");
    },
    onError: () => toast.error("Failed to delete purchase invoice"),
  });

  const columns = [
    { header: "Invoice #", accessor: "invoice_number" as const },
    { header: "Vendor", accessor: (r: PurchaseInvoice) => vendors?.items.find((item) => item.id === r.vendor_id)?.name ?? r.vendor_id },
    { header: "Date", accessor: (r: PurchaseInvoice) => formatDate(r.invoice_date) },
    { header: "Due Date", accessor: (r: PurchaseInvoice) => formatDate(r.due_date) },
    { header: "Total", accessor: (r: PurchaseInvoice) => formatCurrency(r.total_amount) },
    { header: "Paid", accessor: (r: PurchaseInvoice) => formatCurrency(r.amount_paid) },
    { header: "Balance", accessor: (r: PurchaseInvoice) => formatCurrency(r.balance_due) },
    {
      header: "",
      accessor: (r: PurchaseInvoice) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/purchase-invoices/${r.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
            aria-label="View purchase invoice"
            title="View"
          >
            <Eye size={15} />
          </Link>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="Download purchase invoice"
            title="Download"
            onClick={async () => {
              const invoice = await purchaseInvoicesService.getById(r.id);
              const vendor = await vendorsService.getById(invoice.vendor_id);
              downloadInvoicePdf({
                documentTypeLabel: "Purchase Invoice",
                invoiceNumber: invoice.invoice_number,
                invoiceDate: invoice.invoice_date,
                dueDate: invoice.due_date,
                partyLabel: "Vendor",
                partyName: vendor.name || invoice.vendor_id,
                saleOrPurchaseTypeLabel: invoice.purchase_type,
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
                headerFillColor: [37, 99, 235],
                headerTextColor: [255, 255, 255],
                balanceDueFillColor: [37, 99, 235],
                balanceDueTextColor: [255, 255, 255],
              });
            }}
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Delete purchase invoice"
            title="Delete"
            onClick={() => setDeleteTarget(r)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Table columns={columns} data={data?.items ?? []} keyExtractor={(r) => r.id} isLoading={isLoading} />
      {data && data.total > LIMIT && <Pagination total={data.total} skip={skip} limit={LIMIT} onPageChange={setSkip} />}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
        title="Delete Purchase Invoice"
        message={`Are you sure you want to delete invoice #${deleteTarget?.invoice_number ?? ""}? This action cannot be undone.`}
      />
    </>
  );
}
