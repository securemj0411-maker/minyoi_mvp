// Wave 90 (2026-05-15): 직접 reparse — supabase fetch + parseListingOptions + upsert.
// 일회성. 사용: npx tsx scripts/reparse-direct.ts [--sku=...] [--limit=5000]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../src/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "../src/lib/option-parser";

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

  const SKU_LIST = (arg("sku", "ipad-pro,ipad-air,ipad-mini,galaxy-tab-s8-ultra,galaxy-tab-s9") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const LIMIT = Math.max(100, Math.min(20_000, Number(arg("limit", "5000"))));
  const catalogById = new Map(CATALOG.map((s) => [s.id, s]));

  async function fetchJson(p: string) {
    const r = await fetch(URL_BASE + p, { headers: HDR });
    if (!r.ok) throw new Error(`${r.status} ${p} ${await r.text()}`);
    return r.json();
  }
  async function upsertJson(p: string, body: unknown) {
    const r = await fetch(URL_BASE + p, {
      method: "POST",
      headers: { ...HDR, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${r.status} ${p} ${await r.text()}`);
  }

  console.log(`[1/4] fetching active listings per SKU (PostgREST 1000 limit 우회)...`);
  const cols = "pid,name,price,description_preview,listing_type,sku_id,sku_name";
  const rows: Array<{
    pid: number; name: string; price: number; description_preview: string;
    listing_type: string | null; sku_id: string | null; sku_name: string | null;
  }> = [];
  for (const sku of SKU_LIST) {
    const skuRows = (await fetchJson(`/mvp_raw_listings?select=${cols}&sku_id=eq.${sku}&listing_state=eq.active&order=last_seen_at.desc&limit=${LIMIT}`)) as typeof rows;
    rows.push(...skuRows);
    console.log(`    ${sku}: ${skuRows.length}`);
  }
  console.log(`  → total ${rows.length}`);
  const skuFilter = `sku_id=in.(${SKU_LIST.join(",")})&listing_state=eq.active`;

  console.log(`[2/4] parsing...`);
  const parsedRows: Record<string, unknown>[] = [];
  const versionCount = new Map<string, number>();
  for (const row of rows) {
    const sku = catalogById.get(row.sku_id ?? "");
    const category = sku?.category ?? null;
    const parsed = parseListingOptions({
      title: row.name,
      description: row.description_preview ?? "",
      skuId: row.sku_id,
      skuName: row.sku_name,
      category,
    });
    versionCount.set(parsed.parserVersion, (versionCount.get(parsed.parserVersion) ?? 0) + 1);
    parsedRows.push(toParsedListingRow(row.pid, parsed));
  }
  for (const [v, c] of [...versionCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${v}: ${c}`);
  }

  console.log(`[3/4] upserting mvp_listing_parsed (chunk 200)...`);
  for (let i = 0; i < parsedRows.length; i += 200) {
    await upsertJson(`/mvp_listing_parsed?on_conflict=pid`, parsedRows.slice(i, i + 200));
  }
  console.log(`  → upserted ${parsedRows.length}`);

  console.log(`[4/4] marking score_dirty=true...`);
  const dirtyRes = await fetch(`${URL_BASE}/mvp_raw_listings?${skuFilter}`, {
    method: "PATCH",
    headers: { ...HDR, "content-type": "application/json", Prefer: "return=minimal,count=exact" },
    body: JSON.stringify({ score_dirty: true }),
  });
  console.log(`  → ${dirtyRes.headers.get("content-range")}`);
  console.log(`\n✅ reparse 완료. 다음 score tick에 시세 재계산.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
