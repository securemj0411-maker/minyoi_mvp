// Wave 1218 targeted reparse: remove FE products mis-pooled in NON-FE Samsung keys (시세 오염).
// Scoped to 6 VERIFIED main-product-FE pools only (excludes bundle/negation pools like
// "S25+버즈2FE", "S9 ... S9fe 아닙니다", "Z폴드7+버즈3FE" which are genuine non-FE products).
// Safety gate: only writes when the new (current-code) result is an FE-SKU or null.
//   review (default): prints old->new for every candidate, no writes.
//   --apply: upserts parsed (FE-SKU) or rejects to null + needs_review; patches raw sku_id, score_dirty.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const FE_GLUED = /[0-9]fe(?![a-z])/i;
const KEYS = [
  "galaxy_s|galaxy_s20|128gb",
  "earphone|galaxy_buds_3",
  "earphone|galaxy_buds_3_pro",
  "galaxy_s|galaxy_s24_256_self|256gb",
  "galaxy_s|galaxy_s25_256_self|256gb",
  "galaxy_s|galaxy_s23_plus|256gb",
];

type RawRow = { pid: number; sku_id: string | null; name: string | null; description_preview: string | null; bunjang_condition_label: string | null };

async function loadEnvFile(fp: string) {
  try { for (const line of (await readFile(fp, "utf-8")).split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue; const [k, ...r] = t.split("="); process.env[k] ??= r.join("=").trim().replace(/^["']|["']$/g, ""); } } catch { /* optional */ }
}
function chunk<T>(a: T[], n: number) { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
async function fetchJson<T>(url: string): Promise<T[]> { const r = await restFetch(url, { headers: serviceHeaders() }); return (await r.json()) as T[]; }

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  const apply = process.argv.includes("--apply");

  // Precise candidate pids (6 verified main-product-FE pools ∩ glued-fe), computed via MCP
  // (Postgres regex) and written to file — avoids REST regex timeout / multi-key fetch truncation.
  const parsedPids = (JSON.parse(await readFile("/tmp/wave1218_fe_pollution_pids.json", "utf-8")) as { pids: string[] }).pids.map(Number);
  const raws: RawRow[] = [];
  for (const part of chunk(parsedPids, 200)) raws.push(...await fetchJson<RawRow>(`${tableUrl("mvp_raw_listings")}?select=pid,sku_id,name,description_preview,bunjang_condition_label&pid=in.(${part.join(",")})&limit=${part.length}`));
  const candidates = raws.filter((r) => FE_GLUED.test(`${r.name ?? ""} ${r.description_preview ?? ""}`));

  // current key per pid (for old->new display)
  const oldKeyByPid = new Map((await (async () => {
    const out: Array<{ pid: number; comparable_key: string | null }> = [];
    for (const part of chunk(candidates.map((c) => Number(c.pid)), 200)) out.push(...await fetchJson<{ pid: number; comparable_key: string | null }>(`${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key&pid=in.(${part.join(",")})&limit=${part.length}`));
    return out;
  })()).map((p) => [Number(p.pid), p.comparable_key]));

  let applied = 0, skippedGate = 0, unchanged = 0;
  const upserts: Record<string, unknown>[] = [];
  const rejects: number[] = [];
  const rawPatch: Array<{ pid: number; skuId: string | null }> = [];
  console.log(`candidates=${candidates.length}\n--- old -> new (name) ---`);
  for (const raw of candidates) {
    const pid = Number(raw.pid);
    const oldKey = oldKeyByPid.get(pid) ?? null;
    const sku = ruleMatch(raw.name ?? "", raw.description_preview ?? "");
    let newRow: Record<string, unknown> | null = null;
    if (sku) {
      const parsed = parseListingOptions({ title: raw.name ?? "", description: raw.description_preview ?? "", skuId: sku.id, skuName: sku.modelName, category: sku.category, bunjangConditionLabel: raw.bunjang_condition_label, defaultProductType: sku.defaultProductType ?? null });
      newRow = toParsedListingRow(pid, parsed) as Record<string, unknown>;
    }
    const newKey = (newRow?.comparable_key as string | null) ?? null;
    const feOrNull = newKey === null || /fe/.test(newKey);
    const changed = newKey !== oldKey;
    const willApply = changed && feOrNull; // safety gate: only FE-SKU or null
    const flag = !changed ? "=" : willApply ? "APPLY" : "SKIP(gate)";
    console.log(`  [${flag}] ${oldKey ?? "null"} -> ${newKey ?? "null"} | ${(raw.name ?? "").slice(0, 44)}`);
    if (!changed) { unchanged++; continue; }
    if (!feOrNull) { skippedGate++; continue; }
    applied++;
    if (sku && newRow) { upserts.push(newRow); rawPatch.push({ pid, skuId: sku.id }); }
    else { rejects.push(pid); rawPatch.push({ pid, skuId: null }); }
  }

  console.log(`\nsummary: candidates=${candidates.length} willApply=${applied} skippedGate=${skippedGate} unchanged=${unchanged} mode=${apply ? "APPLY" : "review"}`);
  if (apply && applied > 0) {
    for (const part of chunk(upserts, 80)) await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, { method: "POST", headers: serviceHeaders("resolution=merge-duplicates,return=minimal"), body: jsonBody(part) });
    for (const part of chunk(rejects, 80)) await restFetch(`${tableUrl("mvp_listing_parsed")}?pid=in.(${part.join(",")})`, { method: "PATCH", headers: serviceHeaders("return=minimal"), body: jsonBody({ comparable_key: null, needs_review: true, parse_confidence: 0.45, parser_version: "wave1218_fe_reject" }) });
    for (const r of rawPatch) await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${r.pid}`, { method: "PATCH", headers: serviceHeaders("return=minimal"), body: jsonBody({ sku_id: r.skuId, score_dirty: true, ...(r.skuId ? {} : { pool_eligible: false }) }) });
    console.log(`APPLIED: upserts=${upserts.length} rejects=${rejects.length} rawPatched=${rawPatch.length}`);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
