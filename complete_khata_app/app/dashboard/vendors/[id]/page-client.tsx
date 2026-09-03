"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { vendorsService } from "@/services/vendors.service";
import { purchaseInvoicesService } from "@/services/purchase-invoices.service";
import { AccountLedgerPage } from "../../_components/account-ledger-page";

export function VendorLedgerPageClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: vendor } = useQuery({
    queryKey: ["vendor", id],
    queryFn: () => vendorsService.getById(id),
    enabled: Boolean(id),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["purchase-invoices", "ledger", id],
    queryFn: () => purchaseInvoicesService.list({ vendor_id: id, limit: 200 }),
    enabled: Boolean(id),
  });

  const invoices = invoicesData?.items ?? [];
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const paidAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
  const balanceAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  return (
    <>
      <Header title={vendor?.name ?? "Vendor Ledger"} />
      <PageContainer>
        <AccountLedgerPage
          title={vendor?.name ?? "Vendor Ledger"}
          subtitle={vendor ? (vendor.phone ?? "No phone") : "Loading vendor details..."}
          backHref="/dashboard/vendors"
          backLabel="Back to Vendors"
          summaryLabel="Total Debit"
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
            href: `/dashboard/purchase-invoices/${invoice.id}`,
          }))}
          emptyMessage="No purchase invoices found for this vendor."
        />
      </PageContainer>
    </>
  );
}
