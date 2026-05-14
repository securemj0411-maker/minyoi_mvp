import { restFetch, serviceHeaders } from "@/lib/supabase-rest";
import { readFile } from "node:fs/promises";

async function loadEnv(p: string) {
  try { const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...r] = t.split("="); if (!process.env[k]) process.env[k] = r.join("=").trim().replace(/^["']|["']$/g, "");
    }} catch {}
}

async function main() {
  await loadEnv(".env.local"); await loadEnv(".env");
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  for (const sku of ["airpods-max-usbc", "monitor-xl2540k"]) {
    console.log(`\n=== ${sku} ===`);
    const eligibleRes = await restFetch(`${base}/rest/v1/mvp_raw_listings?select=pid,name,detail_status,pool_eligible,score_dirty,sale_status,listing_state,first_seen_at&sku_id=eq.${sku}&order=first_seen_at.desc&limit=50`, { headers: serviceHeaders() });
    const eligible = await eligibleRes.json();
    const stats = {
      total: eligible.length,
      detail_done: eligible.filter((r:any) => r.detail_status === "done").length,
      detail_skipped: eligible.filter((r:any) => r.detail_status === "skipped").length,
      pool_eligible_true: eligible.filter((r:any) => r.pool_eligible === true).length,
      sale_active: eligible.filter((r:any) => r.sale_status === "selling" || r.listing_state === "active").length,
    };
    console.log(`  stats:`, stats);
    
    // 풀 진입 가능 후보 (detail done + active + pool_eligible false인거)
    const candidates = eligible.filter((r:any) => 
      r.detail_status === "done" && 
      r.pool_eligible === false && 
      (r.sale_status === "SELLING" || r.sale_status === "selling" || r.listing_state === "active")
    );
    console.log(`  pool 진입 가능 후보 (현재 eligible=false): ${candidates.length}건`);
    if (candidates.length > 0) {
      for (const r of candidates.slice(0, 5)) {
        console.log(`    pid=${r.pid}  ${r.name?.slice(0,70)}`);
      }
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
