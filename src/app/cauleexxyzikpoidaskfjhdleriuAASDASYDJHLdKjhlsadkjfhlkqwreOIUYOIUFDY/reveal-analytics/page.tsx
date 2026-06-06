import RevealAnalyticsClient from "./reveal-analytics-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function RevealAnalyticsPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 border-b border-zinc-800 pb-3">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">▌REVEAL ANALYTICS</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-black tracking-tight text-zinc-50">user reveal ledger · product demand</h1>
          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">price/category/sku/source/funnel</span>
        </div>
      </header>
      <RevealAnalyticsClient />
    </main>
  );
}
