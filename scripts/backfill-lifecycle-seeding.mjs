// Wave 92 (2026-05-15): seeding gap backfill.
// 발견: active + detail_status=done인 raw_listings 11%가 mvp_lifecycle_checks row 없음.
// 원인: detail-worker side-write try/catch가 seedLifecycleChecks 실패 swallow → markQueueDone 진행 → 영구 누락.
// 일회성 backfill: missing lifecycle row를 일괄 seed (priority_tier='exploration', next_check_at=now → 즉시 처리 큐).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnv(p) {
  try {
    const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...rest] = t.split("=");
      if (!process.env[k]) process.env[k] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}
await loadEnv(path.join(appDir, ".env.local"));

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL).replace(/\/$/, "") + "/rest/v1";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HDR = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };

async function fetchJson(url, opts = {}) {
  const r = await fetch(BASE + url, { ...opts, headers: { ...HDR, ...(opts.headers ?? {}) } });
  if (!r.ok) throw new Error(`${r.status} ${url}: ${await r.text().catch(() => "")}`);
  if (r.status === 204) return null;
  return r.json();
}

console.log("[1/3] scanning active+done raws...");
const rawPids = new Set();
let offset = 0;
while (offset < 50000) {
  const batch = await fetchJson(`/mvp_raw_listings?select=pid&listing_state=eq.active&listing_type=eq.normal&detail_status=eq.done&offset=${offset}&limit=1000`);
  if (batch.length === 0) break;
  for (const r of batch) rawPids.add(Number(r.pid));
  offset += batch.length;
  if (batch.length < 1000) break;
}
console.log(`  → ${rawPids.size} active+done raws`);

console.log("[2/3] fetching existing lifecycle pids (in chunks)...");
const livePids = new Set();
const all = [...rawPids];
for (let i = 0; i < all.length; i += 500) {
  const chunk = all.slice(i, i + 500).join(",");
  const rows = await fetchJson(`/mvp_lifecycle_checks?select=pid&pid=in.(${chunk})`);
  for (const r of rows) livePids.add(Number(r.pid));
}
const missing = all.filter((p) => !livePids.has(p));
console.log(`  → ${livePids.size} have lifecycle / ${missing.length} MISSING (${(missing.length * 100 / all.length).toFixed(1)}%)`);

if (missing.length === 0) {
  console.log("nothing to backfill.");
  process.exit(0);
}

console.log("[3/3] seeding missing lifecycle rows...");
const now = new Date().toISOString();
const rows = missing.map((pid) => ({
  pid,
  source: "bunjang",
  status: "active",
  priority_tier: "exploration",
  next_check_at: now,
  state_reason: "backfill_seeding_gap_wave92",
  updated_at: now,
}));

let seeded = 0;
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const r = await fetch(BASE + "/mvp_lifecycle_checks", {
    method: "POST",
    headers: { ...HDR, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(chunk),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text().catch(() => "")}`);
  seeded += chunk.length;
  console.log(`  ${seeded}/${rows.length}`);
}
console.log(`\n✅ ${seeded} lifecycle rows seeded. lifecycle-worker가 다음 tick부터 처리.`);
