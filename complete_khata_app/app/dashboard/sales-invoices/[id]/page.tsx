"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, DollarSign, Download } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { customersService } from "@/services/customers.service";
import { salesInvoicesService } from "@/services/sales-invoices.service";
import { formatCurrency, formatDate, capitalizeFirst, getLocalDateString, isOverdue } from "@/utils/formatters";
import { extractErrorMessage } from "@/services/api";
import { downloadInvoicePdf, formatSoldBreakdown } from "@/utils/invoice-pdf";

const paySchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
  payment_date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});
type PayForm = z.infer<typeof paySchema>;

export default function SalesInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["sales-invoice", id],
    queryFn: () => salesInvoicesService.getById(id),
  });

  const { data: customer, isLoading: isCustomerLoading } = useQuery({
    queryKey: ["customer", invoice?.customer_id],
    queryFn: () => customersService.getById(invoice!.customer_id),
    enabled: Boolean(invoice?.customer_id),
  });

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { payment_date: getLocalDateString() },
  });

  const payMutation = useMutation({
    mutationFn: (data: PayForm) => salesInvoicesService.recordPayment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-invoice", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setPayOpen(false);
      reset();
    },
    onError: (e) => setPayError(extractErrorMessage(e)),
  });

  const handleDownloadPdf = () => {
    if (!invoice || !customer) return;
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
  };

  const paymentAmount = Number(useWatch({ control, name: "amount" }) ?? 0);
  if (isLoading) return <div className="flex h-full items-center justify-center text-gray-400">Loading…</div>;
  if (!invoice) return <div className="flex h-full items-center justify-center text-gray-400">Invoice not found</div>;

  const canPay = Number(invoice.balance_due) > 0;
  const invoiceIsOverdue = isOverdue(invoice.due_date) && Number(invoice.balance_due) > 0;
  const customerLabel = customer?.name ?? (isCustomerLoading ? "Loading..." : invoice.customer_id);

  return (
    <>
      <Header
        title={`#${invoice.invoice_number}`}
        actions={
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/dashboard/sales-invoices">
              <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleDownloadPdf}>
              <Download size={16} /> PDF
            </Button>
            {canPay && (
              <Button size="sm" onClick={() => { setPayError(null); setPayOpen(true); }} className="sm:px-3">
                <DollarSign size={16} className="sm:hidden" />
                <span className="hidden sm:inline"><DollarSign size={16} /> Record Payment</span>
                <span className="sm:hidden">Pay</span>
              </Button>
            )}
          </div>
        }
      />
      <PageContainer>
        <div className="mx-auto w-full max-w-4xl">
          <Card>
            <CardBody className="space-y-8 p-4 sm:p-10">
              {/* Company + document title */}
              <div className="flex flex-col justify-between gap-6 border-b-2 border-black pb-6 sm:flex-row sm:items-start">
                <div>
                  <p className="mt-2 text-lg font-extrabold text-black sm:text-xl">{customerLabel}</p>
                  <p className="text-sm font-bold uppercase tracking-wide text-gray-700 sm:text-base">Bill To</p>
                </div>
                <div className="sm:text-right">
                  <h2 className="text-lg font-bold uppercase tracking-wider text-black sm:text-xl">Sales Invoice</h2>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Invoice #: {invoice.invoice_number}</p>
                    <p>Date: {formatDate(invoice.invoice_date)}</p>
                    <p>
                      Due Date: {formatDate(invoice.due_date)}
                      {invoiceIsOverdue && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">Overdue</span>}
                    </p>
                    <p>Type: {capitalizeFirst(invoice.sale_type)}</p>
                  </div>
                </div>
              </div>

              {/* Line items — bordered grid, yellow header.
                  Scrolls horizontally on small screens instead of squeezing columns unreadably. */}
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] border-2 border-black text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-yellow-400">
                      <th className="border border-black px-2 py-2 text-right font-bold whitespace-nowrap text-black">Qty</th>
                      <th className="border border-black px-2 py-2 text-left font-bold text-black min-w-[140px]">Description</th>
                      <th className="border border-black px-2 py-2 text-left font-bold whitespace-nowrap text-black">Unit</th>
                      <th className="border border-black px-2 py-2 text-right font-bold whitespace-nowrap text-black">Kg/Bag</th>
                      <th className="border border-black px-2 py-2 text-right font-bold whitespace-nowrap text-black">Weight</th>
                      <th className="border border-black px-2 py-2 text-right font-bold whitespace-nowrap text-black">Price</th>
                      <th className="border border-black px-2 py-2 text-right font-bold whitespace-nowrap text-black">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="border border-black px-2 py-2 text-right whitespace-nowrap text-black">
                          {item.unit_type === "kg"
                            ? `${item.total_weight ?? item.quantity}`
                            : `${item.total_weight ?? item.quantity}`}
                        </td>
                        <td className="border border-black px-2 py-2 text-black">{item.description}</td>
                        <td className="border border-black px-2 py-2 whitespace-nowrap text-black">
                          {item.unit_type === "bag" ? "bags" : item.unit_type}
                        </td>
                        <td className="border border-black px-2 py-2 text-right whitespace-nowrap text-black">
                          {item.weight_per_unit != null ? `${item.weight_per_unit} kg` : "—"}
                        </td>
                        <td className="border border-black px-2 py-2 text-right whitespace-nowrap text-black">{item.total_weight ?? item.quantity} kg</td>
                        <td className="border border-black px-2 py-2 text-right whitespace-nowrap text-black">{formatCurrency(item.unit_price)}</td>
                        <td className="border border-black px-2 py-2 text-right font-medium whitespace-nowrap text-black">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={6} className="border border-black px-3 py-1.5 text-right font-medium text-black">Subtotal</td>
                      <td className="border border-black px-3 py-1.5 text-right whitespace-nowrap text-black">{formatCurrency(invoice.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-3 py-1.5 text-right font-medium text-black">Discount</td>
                      <td className="border border-black px-3 py-1.5 text-right whitespace-nowrap text-black">- {formatCurrency(invoice.discount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-3 py-1.5 text-right font-semibold text-black">Total</td>
                      <td className="border border-black px-3 py-1.5 text-right font-semibold whitespace-nowrap text-black">{formatCurrency(invoice.total_amount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-3 py-1.5 text-right font-medium text-black">Paid</td>
                      <td className="border border-black px-3 py-1.5 text-right whitespace-nowrap text-black">{formatCurrency(invoice.amount_paid)}</td>
                    </tr>
                    <tr className="bg-yellow-400">
                      <td colSpan={6} className="border border-black px-3 py-1.5 text-right font-bold text-black">Balance Due</td>
                      <td className="border border-black px-3 py-1.5 text-right font-bold whitespace-nowrap text-black">{formatCurrency(invoice.balance_due)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div className="text-sm text-black">
                {invoice.notes && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
                  </>
                )}
              </div>

              <p className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">Thank you for your business.</p>
            </CardBody>
          </Card>

          {/* Payment history — app-side, kept outside the printable invoice block */}
          <Card className="mt-6">
            <CardHeader><h2 className="font-semibold text-gray-900">Payment History</h2></CardHeader>
            {invoice.payments?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[320px] divide-y divide-gray-200 text-sm lg:min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-black">Date</th>
                      <th className="px-4 py-3 text-right font-medium text-black">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-black">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-black">{formatDate(payment.payment_date)}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                        <td className="px-4 py-3 text-black text-xs">{payment.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardBody>
                <p className="text-sm text-gray-500">No payments recorded yet.</p>
              </CardBody>
            )}
          </Card>
        </div>
      </PageContainer>

      <Modal isOpen={payOpen} onClose={() => setPayOpen(false)} title="Record Payment" size="sm">
        {payError && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{payError}</div>}
        <p className="mb-4 text-sm text-gray-600">Balance: <span className="font-semibold">{formatCurrency(invoice.balance_due)}</span></p>
        <form onSubmit={handleSubmit((d) => { setPayError(null); payMutation.mutate(d); })} className="space-y-4">
          <Input label="Amount (PKR)" type="number" step="1" error={errors.amount?.message} required {...register("amount")} />
          <p className="text-xs text-gray-500">
            You are paying <span className="font-semibold text-gray-700">{formatCurrency(paymentAmount)}</span>. New balance will be{" "}
            <span className="font-semibold text-gray-700">{formatCurrency(Math.max(Number(invoice.balance_due) - paymentAmount, 0))}</span>.
          </p>
          <Input label="Payment Date" type="date" error={errors.payment_date?.message} required {...register("payment_date")} />
          <Input label="Notes" placeholder="Add payment notes (optional)" error={errors.notes?.message} {...register("notes")} />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={payMutation.isPending}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}