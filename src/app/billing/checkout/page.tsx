import { Suspense } from "react";
import CheckoutClient from "./checkout-client";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950" />}>
      <CheckoutClient />
    </Suspense>
  );
}
