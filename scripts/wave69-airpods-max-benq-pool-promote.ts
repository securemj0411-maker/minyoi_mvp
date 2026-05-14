// Wave 69 — airpods_max_usbc + monitor_xl2540k 잔여 매물 pool 진입 마킹.
// Wave 54 apply 패턴 동일: pool_eligible=true + score_dirty=true.
// scoreStage가 다음 tick에서 candidate_pool에 진입시킴.

import { restFetch, serviceHeaders } from "@/lib/supabase-rest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const APPLY = process.argv.includes("--apply=1");

async function loadEnv(p: string) {
  try { const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...r] = t.split("="); if (!process.env[k]) process.env[k] = r.join("=").trim().replace(/^["']|["']$/g, "");
    }} catch {}
}

async function main() {
  if (APPLY && process.env.CANDIDATE_POOL_PROMOTION_APPROVED !== "1") {
    throw new Error("Mutation refused: set CANDIDATE_POOL_PROMOTION_APPROVED=1");
  }
  await loadEnv(".env.local"); await loadEnv(".env");
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const targetSkus = ["airpods-max-usbc", "monitor-xl2540k"];
  const candidates: Array<{ pid: number; sku: string; name: string }> = [];

  for (const sku of targetSkus) {
    const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?select=pid,name,detail_status,pool_eligible,sale_status,listing_state&sku_id=eq.${sku}&order=first_seen_at.desc&limit=200`, { headers: serviceHeaders() });
    const rows = await res.json();
    for (const r of rows) {
      const detailDone = r.detail_status === "done";
      const isActive = r.sale_status === "SELLING" || r.sale_status === "selling" || r.listing_state === "active";
      const notInPool = r.pool_eligible !== true;
      if (detailDone && isActive && notInPool) {
        candidates.push({ pid: r.pid, sku, name: r.name?.slice(0, 80) ?? "" });
      }
    }
  }

  console.log(`Wave 69 후보: ${candidates.length}건`);
  for (const c of candidates) {
    console.log(`  [${c.sku}] pid=${c.pid}  ${c.name}`);
  }

  let updated = 0;
  if (APPLY && candidates.length > 0) {
    const pids = candidates.map(c => c.pid);
    const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?pid=in.(${pids.join(",")})`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ pool_eligible: true, score_dirty: true }),
    });
    if (!res.ok) throw new Error(`update failed ${res.status}: ${await res.text()}`);
    updated = candidates.length;
    console.log(`\n✅ APPLIED: ${updated}건 pool_eligible=true + score_dirty=true 마킹`);
  } else if (!APPLY) {
    console.log(`\n⚠ DRY-RUN: --apply=1 + CANDIDATE_POOL_PROMOTION_APPROVED=1 로 실행`);
  }

  const result = {
    wave: 69, kind: APPLY ? "airpods_max_benq_pool_promote_apply" : "dry_run",
    measured_at: new Date().toISOString(), apply: APPLY,
    candidates_count: candidates.length, updated, candidates,
  };
  const reportsDir = path.join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `wave69-airpods-benq-promote-${APPLY ? "apply" : "dryrun"}-latest.json`), JSON.stringify(result, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
