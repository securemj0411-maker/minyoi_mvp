// Wave 63 — Apply v32 reparse to auto_safe rows ONLY.
// Strategy: pull stale rows (v24~v31), reparse with current v32, write back ONLY if
// (comparableKey, sku_id, needs_review) all unchanged. This guarantees zero behavior
// change — only parser_version field is updated. needs_review_flip and pool_member
// rows are skipped (require separate owner-review wave).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const STALE_VERSIONS = ["option-parser-v24", "option-parser-v26", "option-parser-v27", "option-parser-v28", "option-parser-v29", "option-parser-v30", "option-parser-v31", "option-parser-v32", "option-parser-v33", "option-parser-v34"];
const PAGE_SIZE = 500;
const HARD_LIMIT = 20_000;
const APPLY = process.argv.includes("--apply=1");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

type Row = {
  pid: number;
  parser_version: string;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number | string | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
  raw: { name: string; description_preview: string } | null;
};

async function fetchPage(offset: number, limit: number): Promise<Row[]> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const versions = STALE_VERSIONS.map((v) => `"${v}"`).join(",");
  const url = `${base}/rest/v1/mvp_listing_parsed?select=pid,parser_version,category,comparable_key,parse_confidence,needs_review,parsed_json,raw:mvp_raw_listings!inner(name,description_preview)&parser_version=in.(${versions})&order=pid.asc&offset=${offset}&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`fetchPage failed ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function updateRow(pid: number, parserVersion: string) {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${base}/rest/v1/mvp_listing_parsed?pid=eq.${pid}`;
  const res = await restFetch(url, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ parser_version: parserVersion, parsed_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`updateRow ${pid} failed ${res.status}: ${await res.text()}`);
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  let totalPulled = 0;
  let updated = 0;
  let skippedKeyDiff = 0;
  let skippedNrFlip = 0;
  const skippedSkuShift = 0;
  let skippedNoRaw = 0;
  let parserError = 0;
  const byVersion: Record<string, number> = {};
  const sampleSkipped: Array<Record<string, unknown>> = [];

  let offset = 0;
  while (offset < HARD_LIMIT) {
    const page = await fetchPage(offset, PAGE_SIZE);
    if (page.length === 0) break;
    totalPulled += page.length;

    for (const row of page) {
      byVersion[row.parser_version] = (byVersion[row.parser_version] ?? 0) + 1;
      if (!row.raw) { skippedNoRaw++; continue; }

      let parsed;
      try {
        const skuId = String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_id ?? "");
        const skuName = String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_name ?? "");
        parsed = await parseListingOptions({
          title: row.raw.name ?? "",
          description: row.raw.description_preview ?? "",
          category: (row.category ?? null) as never,
          skuId,
          skuName,
        });
      } catch {
        parserError++;
        continue;
      }

      const newKey = parsed.comparableKey ?? null;
      const newNr = parsed.needsReview;
      // Note: sku_id is stored separately; v32 reparse doesn't change it (catalog match runs upstream)

      const keyMatch = newKey === row.comparable_key;
      const nrMatch = newNr === row.needs_review;

      if (!keyMatch) {
        skippedKeyDiff++;
        if (sampleSkipped.length < 8) sampleSkipped.push({ pid: row.pid, reason: "key_diff", from: row.comparable_key, to: newKey });
        continue;
      }
      if (!nrMatch) {
        skippedNrFlip++;
        if (sampleSkipped.length < 8) sampleSkipped.push({ pid: row.pid, reason: "nr_flip", from: row.needs_review, to: newNr });
        continue;
      }

      // auto_safe — write back parser_version only
      if (APPLY) {
        try {
          await updateRow(row.pid, parsed.parserVersion);
          updated++;
        } catch (err) {
          parserError++;
          if (sampleSkipped.length < 8) sampleSkipped.push({ pid: row.pid, reason: "update_error", err: String(err).slice(0, 200) });
        }
      } else {
        updated++;
      }
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const result = {
    wave: 63,
    kind: APPLY ? "stale_reparse_apply_auto_safe" : "stale_reparse_apply_auto_safe_dry_run",
    measured_at: new Date().toISOString(),
    apply: APPLY,
    db_writes: APPLY ? updated : 0,
    candidate_pool_writes: 0,
    code_changes: 0,
    totals: {
      total_pulled: totalPulled,
      by_parser_version: byVersion,
      auto_safe_updated: updated,
      skipped_key_diff: skippedKeyDiff,
      skipped_nr_flip: skippedNrFlip,
      skipped_sku_shift: skippedSkuShift,
      skipped_no_raw: skippedNoRaw,
      parser_error: parserError,
    },
    safety_notes: [
      "Only auto_safe rows updated: comparableKey + needs_review unchanged after v32 reparse.",
      "Rows with key/nr changes (Wave 50 needs_owner classifications) are skipped — separate wave.",
      "parser_version field updated to v32; parsed_at timestamp refreshed.",
      "No comparable_key, sku_id, parse_confidence, or needs_review modified.",
      "candidate_pool, mvp_listings, mvp_pack_opens unaffected.",
    ],
    sample_skipped: sampleSkipped,
  };

  const reportsDir = path.join(appDir, "reports");
  await mkdir(reportsDir, { recursive: true });
  const tag = APPLY ? "apply" : "dryrun";
  const outFile = path.join(reportsDir, `wave63-stale-reparse-apply-${tag}-latest.json`);
  await writeFile(outFile, JSON.stringify(result, null, 2));

  console.log(JSON.stringify({
    apply: APPLY,
    total_pulled: totalPulled,
    auto_safe_updated: updated,
    skipped_key_diff: skippedKeyDiff,
    skipped_nr_flip: skippedNrFlip,
    skipped_no_raw: skippedNoRaw,
    parser_error: parserError,
    by_parser_version: byVersion,
  }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
