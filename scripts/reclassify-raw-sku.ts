// Wave 109 (2026-05-15): raw_listings.sku_id 재분류. ruleMatch 새 logic (Wave 108 narrow promotion +
// normalize fix + Wave 109 parser) 적용해서 기존 매물도 narrow lane으로 흡수.
// reparse-direct.ts는 mvp_listing_parsed만 update하고 raw_listings.sku_id는 안 건드림.
// 이 스크립트가 raw_listings.sku_id 직접 update.
// 사용: npx tsx scripts/reclassify-raw-sku.ts [--sku=...] [--limit=5000]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ruleMatch } from "../src/lib/catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnv(p: string) {
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

function arg(name: string, def: string | null = null) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : def;
}

async function main() {
  await loadEnv(path.join(appDir, ".env.local"));
  await loadEnv(path.join(appDir, ".env"));

  const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const HDR: Record<string, string> = { apikey: KEY, authorization: `Bearer ${KEY}` };

  const SKU_LIST = (arg("sku", "iphone-15-pro-max,iphone-16-pro-max,galaxy-s23,galaxy-s24,galaxy-s25,galaxy-s23-ultra,galaxy-s24-ultra,galaxy-s25-ultra,iphone-13-pro,iphone-14-pro,iphone-15-pro,iphone-16-pro") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const LIMIT = Math.max(100, Math.min(20_000, Number(arg("limit", "5000"))));

  async function fetchJson(p: string) {
    const r = await fetch(URL_BASE + p, { headers: HDR });
    if (!r.ok) throw new Error(`${r.status} ${p} ${await r.text()}`);
    return r.json();
  }
  async function patchJson(p: string, body: unknown) {
    const r = await fetch(URL_BASE + p, {
      method: "PATCH",
      headers: { ...HDR, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${r.status} ${p} ${await r.text()}`);
  }

  console.log("[1/3] fetching active listings per SKU...");
  type Row = { pid: number; name: string; description_preview: string | null; sku_id: string | null };
  const rows: Row[] = [];
  for (const sku of SKU_LIST) {
    const skuRows = (await fetchJson(
      `/mvp_raw_listings?select=pid,name,description_preview,sku_id&sku_id=eq.${sku}&listing_state=eq.active&order=last_seen_at.desc&limit=${LIMIT}`,
    )) as Row[];
    console.log(`    ${sku}: ${skuRows.length}`);
    rows.push(...skuRows);
  }
  console.log(`  → total ${rows.length}`);

  console.log("[2/3] re-classifying with new ruleMatch...");
  const changes: { pid: number; from: string; to: string }[] = [];
  for (const row of rows) {
    const newSku = ruleMatch(row.name, row.description_preview ?? "");
    if (newSku && newSku.id !== row.sku_id) {
      changes.push({ pid: row.pid, from: row.sku_id ?? "(null)", to: newSku.id });
    }
  }
  console.log(`  → ${changes.length} reclassification (${Math.round((changes.length / rows.length) * 100)}%)`);

  // Top 변화 통계
  const transitionMap = new Map<string, number>();
  for (const c of changes) {
    const key = `${c.from} → ${c.to}`;
    transitionMap.set(key, (transitionMap.get(key) ?? 0) + 1);
  }
  console.log("  Top transitions:");
  for (const [k, v] of [...transitionMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${v.toString().padStart(4)} : ${k}`);
  }

  if (changes.length === 0) {
    console.log("✅ No changes needed.");
    return;
  }

  console.log("[3/3] updating raw_listings.sku_id (chunk 50)...");
  const CHUNK = 50;
  // Group by new sku_id to PATCH in batch
  const byNewSku = new Map<string, number[]>();
  for (const c of changes) {
    const arr = byNewSku.get(c.to) ?? [];
    arr.push(c.pid);
    byNewSku.set(c.to, arr);
  }
  let done = 0;
  for (const [newSku, pids] of byNewSku.entries()) {
    for (let i = 0; i < pids.length; i += CHUNK) {
      const chunk = pids.slice(i, i + CHUNK);
      await patchJson(
        `/mvp_raw_listings?pid=in.(${chunk.join(",")})`,
        { sku_id: newSku, score_dirty: true },
      );
      done += chunk.length;
      process.stdout.write(`\r  → ${done}/${changes.length}`);
    }
  }
  console.log("\n✅ reclassify 완료. pool-warmer cron이 narrow lane ready 진입 처리.");
}

main().catch((e) => { console.error(e); process.exit(1); });
