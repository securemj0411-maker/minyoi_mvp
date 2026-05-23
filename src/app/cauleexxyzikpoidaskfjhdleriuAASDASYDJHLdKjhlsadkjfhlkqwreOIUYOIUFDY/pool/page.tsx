// Wave launch-105 (2026-05-24): 운영자 풀 검토 (AdminPoolBrowser) — cau 운영자 페이지로 이전.
// Wave launch-108 (2026-05-24): layout.tsx 가 admin auth + AdminTopBar 공유 → 본문만.

import AdminPoolBrowser from "@/components/admin-pool-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminPoolPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 border-b border-zinc-800 pb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">▌POOL BROWSER</p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-100">candidate_pool · live inspector</h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          card click → market price daily / comparable sample / verification memo
        </p>
      </header>

      <AdminPoolBrowser />
    </main>
  );
}
