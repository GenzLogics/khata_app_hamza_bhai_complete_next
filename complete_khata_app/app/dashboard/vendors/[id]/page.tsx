import { Suspense } from "react";
import { VendorLedgerPageClient } from "./page-client";

export default function VendorLedgerPage() {
  return (
    <Suspense fallback={null}>
      <VendorLedgerPageClient />
    </Suspense>
  );
}
