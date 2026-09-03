"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { customersService } from "@/services/customers.service";
import { salesInvoicesService } from "@/services/sales-invoices.service";
import { AccountLedgerPage } from "../../_components/account-ledger-page";

export function CustomerLedgerPageClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersService.getById(id),
    enabled: Boolean(id),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["sales-invoices", "ledger", id],
    queryFn: () => salesInvoicesService.list({ customer_id: id, limit: 200 }),
    enabled: Boolean(id),
  });

  const invoices = invoicesData?.items ?? [];
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const paidAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
  const balanceAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  return (
    <>
      <Header title={customer?.name ?? "Customer Ledger"} />
      <PageContainer>
        <AccountLedgerPage
          title={customer?.name ?? "Customer Ledger"}
          subtitle={customer ? (customer.phone ?? "No phone") : "Loading customer details..."}
          backHref="/dashboard/customers"
          backLabel="Back to Customers"
          summaryLabel="Total Credit"
          summaryValue={totalAmount}
          paidLabel="Total Paid"
          paidValue={paidAmount}
          balanceLabel="Balance Due"
          balanceValue={balanceAmount}
          rows={invoices.map((invoice) => ({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            total_amount: Number(invoice.total_amount ?? 0),
            amount_paid: Number(invoice.amount_paid ?? 0),
            balance_due: Number(invoice.balance_due ?? 0),
            href: `/dashboard/sales-invoices/${invoice.id}`,
          }))}
          emptyMessage="No sales invoices found for this customer."
        />
      </PageContainer>
    </>
  );
}
