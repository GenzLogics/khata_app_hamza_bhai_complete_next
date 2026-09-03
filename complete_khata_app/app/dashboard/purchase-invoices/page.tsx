import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import PurchaseInvoicesClient from "@/components/dashboard/PurchaseInvoicesClient";

export default function PurchaseInvoicesPage() {
  return (
    <>
      <Header
        title="Purchase Invoices"
        actions={
          <Link href="/dashboard/purchase-invoices/new">
            <Button size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
              <Plus size={16} />
              <span className="hidden sm:inline"> New Purchase Invoice</span>
            </Button>
          </Link>
        }
      />

      <PageContainer>
        <Suspense fallback={<div className="py-8 text-center">Loading...</div>}>
          <PurchaseInvoicesClient />
        </Suspense>
      </PageContainer>
    </>
  );
}
