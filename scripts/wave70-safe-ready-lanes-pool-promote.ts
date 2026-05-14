// Wave 70 — Safe ready lanes 일괄 pool 진입 마킹.
// catalog mustContain strict (model code/model name) lanes만. self-unlocked/iPad Air M3 같은 위험 lane 제외.
// detail_done + active + pool_eligible=false 매물에 pool_eligible=true + score_dirty=true 마킹.

import { restFetch, serviceHeaders } from "@/lib/supabase-rest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const APPLY = process.argv.includes("--apply=1");

// 안전한 SKU 리스트: 모델 코드/모델명 strict (false positive 본질적 0).
// 제외: ipad-air-m3-11-256-wifi (오염 53%), iPhone/Galaxy 자급제 (자급제 명시 누락 위험), ipad-mini-7 (표본 부족).
const SAFE_SKUS = [
  // 헤드폰/이어폰 (모델 strict)
  "galaxy-buds-3-pro", "bose-qc45", "sony-wh-1000xm4",
  "beats-studio-pro", "airpods-max-usbc", "airpods-pro-3", "airpods-4-anc",
  // 게임기 (모델+OLED/Slim/Disc/Digital strict)
  "switch-oled", "ps5-slim-digital", "ps5-slim-disc",
  // 스피커 (단일 모델)
  "speaker-jbl-flip-6", "speaker-bose-soundlink-flex",
  // 노트북 (chip+screen+ram+ssd narrow)
  "lg-gram-17-2024", "macbook-pro-14-m3-18-512", "macbook-air-m3-13-256",
  "macbook-air-m2-13-256",
  // 모니터 (model code)
  "monitor-xl2540k", "monitor-27us550", "monitor-27gl650f", "monitor-39gx900a",
  // 가전 (단일 모델)
  "home-appliance-dyson-v12-detect-slim", "home-appliance-roborock-s8-pro-ultra",
  // 데스크탑 (M3 strict)
  "desktop-imac-m3-24", "desktop-mac-mini-m2-256",
  // iPad Pro M4 (narrow strict)
  "ipad-pro-11-m4-256-wifi", "ipad-pro-13-m4-256-wifi",
];

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
  const allCandidates: Array<{pid: number; sku: string; name: string}> = [];
  const perSkuCounts: Record<string, number> = {};

  for (const sku of SAFE_SKUS) {
    const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?select=pid,name,detail_status,pool_eligible,sale_status,listing_state&sku_id=eq.${sku}&order=first_seen_at.desc&limit=300`, { headers: serviceHeaders() });
    const rows = await res.json();
    const candidates = rows.filter((r: any) =>
      r.detail_status === "done" &&
      r.pool_eligible !== true &&
      (r.sale_status === "SELLING" || r.sale_status === "selling" || r.listing_state === "active")
    );
    perSkuCounts[sku] = candidates.length;
    for (const c of candidates) {
      allCandidates.push({ pid: c.pid, sku, name: c.name?.slice(0, 70) ?? "" });
    }
  }

  console.log(`\n=== Wave 70 candidates per SKU ===`);
  for (const [sku, n] of Object.entries(perSkuCounts).sort((a, b) => b[1] - a[1])) {
    if (n > 0) console.log(`  ${sku}: ${n}`);
  }
  console.log(`\n총 ${allCandidates.length}건`);

  let updated = 0;
  if (APPLY && allCandidates.length > 0) {
    // chunked update (100 pids at a time)
    const chunkSize = 100;
    for (let i = 0; i < allCandidates.length; i += chunkSize) {
      const chunk = allCandidates.slice(i, i + chunkSize);
      const pids = chunk.map(c => c.pid);
      const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?pid=in.(${pids.join(",")})`, {
        method: "PATCH",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ pool_eligible: true, score_dirty: true }),
      });
      if (!res.ok) throw new Error(`update failed ${res.status}: ${await res.text()}`);
      updated += chunk.length;
      console.log(`  chunk ${i}-${i + chunk.length}: ${chunk.length} updated`);
    }
    console.log(`\n✅ APPLIED: ${updated}건 pool_eligible=true + score_dirty=true 마킹`);
  } else if (!APPLY) {
    console.log(`\n⚠ DRY-RUN: --apply=1 + CANDIDATE_POOL_PROMOTION_APPROVED=1 로 실행`);
  }

  const result = {
    wave: 70, kind: APPLY ? "safe_ready_lanes_pool_promote_apply" : "dry_run",
    measured_at: new Date().toISOString(), apply: APPLY,
    safe_skus: SAFE_SKUS,
    per_sku_counts: perSkuCounts,
    total_candidates: allCandidates.length,
    updated,
    candidates_sample: allCandidates.slice(0, 30),
  };
  const reportsDir = path.join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `wave70-safe-ready-lanes-promote-${APPLY ? "apply" : "dryrun"}-latest.json`), JSON.stringify(result, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
