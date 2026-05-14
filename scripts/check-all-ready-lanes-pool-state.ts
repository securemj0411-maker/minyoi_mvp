import { restFetch, serviceHeaders } from "@/lib/supabase-rest";
import { readFile } from "node:fs/promises";

async function loadEnv(p: string) {
  try { const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...r] = t.split("="); if (!process.env[k]) process.env[k] = r.join("=").trim().replace(/^["']|["']$/g, "");
    }} catch {}
}

// LANE_READINESS ready SKU ids 전수
const READY_SKUS = [
  "airpods-max-usbc", "ipad-pro-11-m4-256-wifi", "ipad-pro-13-m4-256-wifi",
  "iphone-15-pro-128gb-self", "iphone-16-pro-128gb-self", "ipad-air-m2-11-256-wifi",
  "galaxy-s25-ultra-256-self", "ipad-air-m3-11-256-wifi", "galaxy-tab-s10-ultra-256-self",
  "macbook-air-m3-13-256", "macbook-pro-14-m3-18-512", "macbook-air-m2-13-256",
  "monitor-xl2540k", "monitor-27us550", "monitor-39gx900a", "monitor-27gl650f",
  "monitor-lg-27up850n", "monitor-lg-27gp850",
  "speaker-jbl-flip-6", "speaker-bose-soundlink-flex", "speaker-bose-soundlink-mini-ii",
  "speaker-marshall-emberton-ii", "speaker-sonos-roam",
  "home-appliance-dyson-v12-detect-slim", "home-appliance-roborock-s8-pro-ultra",
  "desktop-imac-m3-24", "desktop-mac-mini-m2-256",
  "ps5-disc-digital-standard", "ps5-slim-disc", "ps5-slim-digital",
  "switch-oled",
  "iphone-12-pro-128gb-self", "iphone-13-pro-128gb-self", "iphone-14-pro-128gb-self",
  "galaxy-s23-ultra-256-self", "galaxy-s24-ultra-256-self",
  "ipad-pro-11-m2-256-wifi", "ipad-pro-13-m2-256-wifi", "ipad-mini-7-128-wifi",
  "galaxy-z-flip-5-256-self", "iphone-11-pro-128gb-self",
  "lg-gram-17-2024",
  "applewatch-series10", "applewatch-ultra-2",
  "airpods-pro-3", "airpods-4-anc", "galaxy-buds-3-pro",
  "beats-solo-4", "beats-studio-pro", "bose-qc-ultra", "bose-qc45",
  "sony-wh-1000xm4", "sony-wh-ch520",
];

async function main() {
  await loadEnv(".env.local"); await loadEnv(".env");
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  const results: Array<{sku: string; raw: number; eligible: number; gap: number; samples: string[]}> = [];
  
  for (const sku of READY_SKUS) {
    const res = await restFetch(`${base}/rest/v1/mvp_raw_listings?select=pid,name,detail_status,pool_eligible,sale_status,listing_state&sku_id=eq.${sku}&order=first_seen_at.desc&limit=200`, { headers: serviceHeaders() });
    const rows = await res.json();
    if (rows.length === 0) continue;
    
    const candidates = rows.filter((r: any) => 
      r.detail_status === "done" && 
      r.pool_eligible !== true && 
      (r.sale_status === "SELLING" || r.sale_status === "selling" || r.listing_state === "active")
    );
    const eligibleCount = rows.filter((r: any) => r.pool_eligible === true).length;
    
    if (candidates.length > 0) {
      results.push({
        sku,
        raw: rows.length,
        eligible: eligibleCount,
        gap: candidates.length,
        samples: candidates.slice(0, 3).map((r: any) => r.name?.slice(0, 60) ?? ""),
      });
    }
  }
  
  results.sort((a, b) => b.gap - a.gap);
  console.log(`\n=== gap 발견 ${results.length} SKU (pool_eligible 마킹 가능 매물 있음) ===\n`);
  let totalGap = 0;
  for (const r of results) {
    console.log(`${r.sku}: raw=${r.raw}, eligible=${r.eligible}, gap=${r.gap}`);
    for (const s of r.samples) console.log(`  - ${s}`);
    totalGap += r.gap;
  }
  console.log(`\n=== 총 gap: ${totalGap} 건 ===`);
}
main().catch(e => { console.error(e); process.exit(1); });
