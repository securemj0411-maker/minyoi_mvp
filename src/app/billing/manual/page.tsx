import { Suspense } from "react";
import ManualDepositClient from "./manual-deposit-client";

export const dynamic = "force-dynamic";

export default function ManualDepositPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb] dark:bg-zinc-950" />}>
      <ManualDepositClient />
    </Suspense>
  );
}
