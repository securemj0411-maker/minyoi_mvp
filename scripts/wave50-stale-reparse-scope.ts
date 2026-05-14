// Wave 50 — Read-only dry-run scope for stale parser_version rows.
// NO DB writes. Pulls parsed rows + joined raw via PostgREST, runs current parser
// in-process, diffs against stored fields, classifies into auto-safe / needs-owner / blocked.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const STALE_VERSIONS = ["option-parser-v24", "option-parser-v26", "option-parser-v27", "option-parser-v28", "option-parser-v29", "option-parser-v30", "option-parser-v31"];
const PAGE_SIZE = 1000;
const HARD_LIMIT = 16_000;

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

type ParsedRow = {
  pid: number;
  parser_version: string;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number | string | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
  raw: { name: string; description_preview: string } | null;
};

async function fetchPage(offset: number, limit: number): Promise<ParsedRow[]> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const versions = STALE_VERSIONS.map((v) => `"${v}"`).join(",");
  const url = `${base}/rest/v1/mvp_listing_parsed?select=pid,parser_version,category,comparable_key,parse_confidence,needs_review,parsed_json,raw:mvp_raw_listings!inner(name,description_preview)&parser_version=in.(${versions})&order=pid.asc&offset=${offset}&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`page failed ${res.status}: ${await res.text()}`);
  return await res.json();
}

type Classification =
  | "auto_safe_storage_resolve"
  | "auto_safe_no_change"
  | "needs_owner_sku_shift"
  | "needs_owner_category_shift"
  | "needs_owner_pool_member"
  | "needs_owner_confidence_drop"
  | "needs_owner_needs_review_flip_to_true"
  | "blocked_raw_missing"
  | "blocked_parser_throw";

type Diff = {
  pid: number;
  parser_version: string;
  classification: Classification;
  storage_change?: { from: string; to: string };
  sku_change?: { from: string; to: string };
  category_change?: { from: string | null; to: string | null };
  key_change?: { from: string | null; to: string | null };
  confidence_change?: { from: number; to: number };
  needs_review_change?: { from: boolean | null; to: boolean };
};

function parseConf(v: number | string | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));

  // Step 1: pull pool member pids upfront — small set.
  const poolPidsRes = await restFetch(
    `${process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mvp_candidate_pool?select=pid&limit=5000`,
    { headers: serviceHeaders() },
  );
  const poolPids: Set<number> = new Set();
  if (poolPidsRes.ok) {
    const rows = (await poolPidsRes.json()) as Array<{ pid: number | string }>;
    for (const r of rows) poolPids.add(Number(r.pid));
  }

  // Step 2: pull all stale rows in pages.
  const all: ParsedRow[] = [];
  let offset = 0;
  while (offset < HARD_LIMIT) {
    const page = await fetchPage(offset, PAGE_SIZE);
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }

  const totals = {
    total_pulled: all.length,
    by_parser_version: {} as Record<string, number>,
    by_classification: {} as Record<Classification, number>,
    storage_resolution_count: 0,
    storage_resolution_buckets: {} as Record<string, number>,
    sku_shift_count: 0,
    category_shift_count: 0,
    pool_member_diff_count: 0,
    confidence_drop_count: 0,
    needs_review_flip_to_true_count: 0,
    parser_throw_count: 0,
    raw_missing_count: 0,
    pool_member_overlap_total: 0,
  };

  const sample_diffs: Diff[] = [];
  const max_sample_per_class: Record<Classification, number> = {
    auto_safe_storage_resolve: 8,
    auto_safe_no_change: 0,
    needs_owner_sku_shift: 8,
    needs_owner_category_shift: 8,
    needs_owner_pool_member: 8,
    needs_owner_confidence_drop: 8,
    needs_owner_needs_review_flip_to_true: 8,
    blocked_raw_missing: 4,
    blocked_parser_throw: 4,
  };
  const sample_taken: Record<Classification, number> = {
    auto_safe_storage_resolve: 0,
    auto_safe_no_change: 0,
    needs_owner_sku_shift: 0,
    needs_owner_category_shift: 0,
    needs_owner_pool_member: 0,
    needs_owner_confidence_drop: 0,
    needs_owner_needs_review_flip_to_true: 0,
    blocked_raw_missing: 0,
    blocked_parser_throw: 0,
  };

  for (const row of all) {
    totals.by_parser_version[row.parser_version] = (totals.by_parser_version[row.parser_version] ?? 0) + 1;
    if (poolPids.has(Number(row.pid))) totals.pool_member_overlap_total += 1;

    if (!row.raw) {
      const c: Classification = "blocked_raw_missing";
      totals.by_classification[c] = (totals.by_classification[c] ?? 0) + 1;
      totals.raw_missing_count += 1;
      if (sample_taken[c] < max_sample_per_class[c]) {
        sample_diffs.push({ pid: row.pid, parser_version: row.parser_version, classification: c });
        sample_taken[c] += 1;
      }
      continue;
    }

    let out: ReturnType<typeof parseListingOptions> | null = null;
    try {
      const skuId = String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_id ?? "");
      const skuName = String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_name ?? "");
      out = parseListingOptions({
        title: row.raw.name,
        description: row.raw.description_preview ?? "",
        category: (row.category as Parameters<typeof parseListingOptions>[0]["category"]) ?? null,
        skuId,
        skuName,
      });
    } catch {
      const c: Classification = "blocked_parser_throw";
      totals.by_classification[c] = (totals.by_classification[c] ?? 0) + 1;
      totals.parser_throw_count += 1;
      if (sample_taken[c] < max_sample_per_class[c]) {
        sample_diffs.push({ pid: row.pid, parser_version: row.parser_version, classification: c });
        sample_taken[c] += 1;
      }
      continue;
    }

    const beforeKey = row.comparable_key;
    const afterKey = out.comparableKey ?? null;
    const beforeSku = String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_id ?? "");
    const afterSku = String(((out.parsedJson ?? {}) as Record<string, unknown>).raw_sku_id ?? "");
    const beforeCat = row.category;
    const afterCat = out.category ?? null;
    const beforeConf = parseConf(row.parse_confidence);
    const afterConf = out.parseConfidence ?? 0;
    const beforeNR = row.needs_review ?? null;
    const afterNR = out.needsReview ?? false;
    const storageStrBefore = beforeKey?.match(/(\d+gb|unknown_storage)/)?.[1] ?? null;
    const storageStrAfter = afterKey?.match(/(\d+gb|unknown_storage)/)?.[1] ?? null;

    let c: Classification = "auto_safe_no_change";

    // Priority order: blocked > pool_member > sku/category shift > nr flip > confidence drop > storage resolve > no change
    if (poolPids.has(Number(row.pid)) && (beforeKey !== afterKey || beforeSku !== afterSku || beforeCat !== afterCat)) {
      c = "needs_owner_pool_member";
      totals.pool_member_diff_count += 1;
    } else if (beforeSku && afterSku && beforeSku !== afterSku) {
      c = "needs_owner_sku_shift";
      totals.sku_shift_count += 1;
    } else if (beforeCat && afterCat && beforeCat !== afterCat) {
      c = "needs_owner_category_shift";
      totals.category_shift_count += 1;
    } else if (beforeNR === false && afterNR === true) {
      c = "needs_owner_needs_review_flip_to_true";
      totals.needs_review_flip_to_true_count += 1;
    } else if (beforeConf - afterConf >= 0.15) {
      c = "needs_owner_confidence_drop";
      totals.confidence_drop_count += 1;
    } else if (storageStrBefore === "unknown_storage" && storageStrAfter && storageStrAfter !== "unknown_storage") {
      c = "auto_safe_storage_resolve";
      totals.storage_resolution_count += 1;
      totals.storage_resolution_buckets[storageStrAfter] = (totals.storage_resolution_buckets[storageStrAfter] ?? 0) + 1;
    } else {
      c = "auto_safe_no_change";
    }

    totals.by_classification[c] = (totals.by_classification[c] ?? 0) + 1;

    if (sample_taken[c] < max_sample_per_class[c]) {
      sample_diffs.push({
        pid: row.pid,
        parser_version: row.parser_version,
        classification: c,
        storage_change: storageStrBefore !== storageStrAfter && storageStrBefore && storageStrAfter
          ? { from: storageStrBefore, to: storageStrAfter } : undefined,
        sku_change: beforeSku && afterSku && beforeSku !== afterSku ? { from: beforeSku, to: afterSku } : undefined,
        category_change: beforeCat !== afterCat ? { from: beforeCat, to: afterCat } : undefined,
        key_change: beforeKey !== afterKey ? { from: beforeKey, to: afterKey } : undefined,
        confidence_change: Math.abs(beforeConf - afterConf) >= 0.05 ? { from: Number(beforeConf.toFixed(3)), to: Number(afterConf.toFixed(3)) } : undefined,
        needs_review_change: beforeNR !== afterNR ? { from: beforeNR, to: afterNR } : undefined,
      });
      sample_taken[c] += 1;
    }
  }

  const summary = {
    wave: 50,
    kind: "stale_parse_reparse_scope_dry_run",
    measured_at: new Date().toISOString(),
    db_writes: 0,
    candidate_pool_writes: 0,
    parser_code_changes: 0,
    inputs: {
      stale_parser_versions: STALE_VERSIONS,
      hard_limit: HARD_LIMIT,
      page_size: PAGE_SIZE,
    },
    totals,
    sample_diffs,
    interpretation_notes: [
      "auto_safe_storage_resolve: unknown_storage → explicit. low risk, deterministic lift.",
      "auto_safe_no_change: full reparse produces identical comparable_key/sku/conf/nr — bulk of pulls likely here.",
      "needs_owner_pool_member: this PID is in mvp_candidate_pool and reparse changes its key/sku/category. owner sign-off mandatory.",
      "needs_owner_sku_shift: catalog SKU id changed. could be improvement (broader → narrower) or regression. owner review.",
      "needs_owner_category_shift: category changed. major. owner review.",
      "needs_owner_confidence_drop: parse_confidence dropped >=0.15. AI/pool downstream could change behavior. owner review.",
      "needs_owner_needs_review_flip_to_true: row that was deterministic now becomes review-only. owner check.",
      "blocked_raw_missing: parsed row exists but raw counterpart absent. cannot reparse safely.",
      "blocked_parser_throw: parser exception on this row.",
    ],
  };

  await mkdir(path.join(appDir, "reports"), { recursive: true });
  await writeFile(path.join(appDir, "reports/wave50-stale-reparse-scope-latest.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
