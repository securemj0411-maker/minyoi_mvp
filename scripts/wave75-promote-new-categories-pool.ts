// Wave 75 — Wave 67 신 SKU 중 ready 통과한 3 lane pool 마킹.
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";
import { readFile } from "node:fs/promises";

const APPLY = process.argv.includes("--apply=1");

async function loadEnv(p: string) {
  try { const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...r] = t.split("="); if (!process.env[k]) process.env[k] = r.join("=").trim().replace(/^["']|["']$/g, "");
    }} catch {}
}

const READY_SKUS = [
  "watch-casio-gshock-dw5600",
  "sport-golf-titleist-tsr2-driver",
  "sport-golf-titleist-tsr3-driver",
];

async function main() {
  if (APPLY && process.env.CANDIDATE_POOL_PROMOTION_APPROVED !== "1") {
    throw new Error("Mutation refused: set CANDIDATE_POOL_PROMOTION_APPROVED=1");
  }
  await loadEnv(".env.local"); await loadEnv(".env");
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const candidates: number[] = [];
  for (const sku of READY_SKUS) {
    const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?select=pid,name,detail_status,pool_eligible,sale_status,listing_state&sku_id=eq.${sku}&order=first_seen_at.desc&limit=200`, { headers: serviceHeaders() });
    const rows = (await res.json()) as Array<{ pid: number; detail_status?: string; pool_eligible?: boolean; sale_status?: string; listing_state?: string }>;
    const eligible = rows.filter((r) =>
      r.detail_status === "done" &&
      r.pool_eligible !== true &&
      (r.sale_status === "SELLING" || r.sale_status === "selling" || r.listing_state === "active")
    );
    console.log(`${sku}: ${eligible.length} candidates`);
    for (const c of eligible) candidates.push(c.pid);
  }
  console.log(`\n총 ${candidates.length}건`);

  if (APPLY && candidates.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?pid=in.(${chunk.join(",")})`, {
        method: "PATCH",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ pool_eligible: true, score_dirty: true }),
      });
      if (!res.ok) throw new Error(`update failed ${res.status}: ${await res.text()}`);
      console.log(`  chunk ${i}-${i + chunk.length}: ${chunk.length} updated`);
    }
    console.log(`\n✅ APPLIED: ${candidates.length}건 마킹`);
  } else if (!APPLY) {
    console.log(`\n⚠ DRY-RUN`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
