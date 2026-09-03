import { Suspense } from "react";
import { CustomerLedgerPageClient } from "./page-client";

export default function CustomerLedgerPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLedgerPageClient />
    </Suspense>
  );
}
