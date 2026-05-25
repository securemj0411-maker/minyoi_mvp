import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ruleMatch, skuById } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const PATCH_CHUNK_SIZE = 80;
const CONSOLE_BODY_SKUS = new Set([
  "switch-v1",
  "switch-lite",
  "switch-oled",
  "switch-2",
  "ps5-disc-standard",
  "ps5-digital-standard",
  "ps5-slim-disc",
  "ps5-slim-digital",
  "ps5-pro",
  "ps4-broad",
  "ps4-pro",
  "xbox-series-x",
  "xbox-series-s",
  "xbox-one",
  "steamdeck-oled",
  "steamdeck-lcd",
]);

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: string | null;
  comparable_key: string | null;
  condition_tier: string | null;
  needs_review: boolean | null;
  parse_confidence: number | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
};

type Candidate = {
  pid: number;
  title: string | null;
  category: string | null;
  rawSkuId: string | null;
  currentSkuId: string | null;
  comparableKey: string | null;
  oldTier: string | null;
  newTier: string | null;
  parserVersion: string | null;
  currentParserVersion: string | null;
  skippedReason: string | null;
  parsedRow: Record<string, unknown> | null;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

function summarizeBy(items: Candidate[], selector: (item: Candidate) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item) ?? "(null)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function hasConsoleBundleAxisPending(raw: RawRow | undefined) {
  if (!raw?.sku_id || !CONSOLE_BODY_SKUS.has(raw.sku_id)) return false;
  const text = `${raw.name ?? ""}\n${raw.description_preview ?? ""}`.toLowerCase();
  return (
    /(?:\+|＋|&|및|와|과|함께|포함|세트|번들|같이).{0,32}(?:타이틀|게임|칩|카트리지|알칩|디스크|케이스|파우치|ssd|sd\s*카드|sd카드|메모리\s*카드|메모리카드|조이콘|프로콘|듀얼센스|패드|충전|드라이브|추가\s*구성품|추가구성품|헤드셋|모니터|포탈|portal|\blg\b|삼성|nox|녹스|레데리|소드|실드|바이올렛|스칼렛|마리오|젤다|포켓몬|동물의\s*숲)/i.test(text) ||
    /(?:타이틀|게임|칩|카트리지|알칩).{0,16}(?:및|여러가지|일괄|포함|같이|세트|번들)/i.test(text) ||
    /(?:케이스|파우치|ssd|sd\s*카드|sd카드|메모리\s*카드|메모리카드|조이콘|프로콘|듀얼센스|패드|헤드셋|모니터|디스크\s*드라이브).{0,16}(?:포함|같이|세트|번들)/i.test(text)
  );
}

function hasConsoleVariantAxisPending(raw: RawRow | undefined) {
  if (!raw?.sku_id || !CONSOLE_BODY_SKUS.has(raw.sku_id)) return false;
  const text = `${raw.name ?? ""}\n${raw.description_preview ?? ""}`.toLowerCase();
  if (raw.sku_id.startsWith("switch-")) {
    return /(?:마리오\s*레드|마리오\s*에디션|마리오에디션|마리오\s*카트\s*8?.{0,16}(?:세트|번들|에디션)|스칼렛.{0,12}바이올렛|바이올렛.{0,12}스칼렛|포켓몬(?:스터)?.{0,20}에디션|동물의\s*숲.{0,12}에디션|모동숲.{0,12}에디션|젤다.{0,20}에디션|왕국의\s*눈물|티어스\s*오브\s*더\s*킹덤|스플래툰|splatoon|몬헌|몬스터\s*헌터|monster\s*hunter|하우징|커펌|ㅋㅍ|(?:128|256|512)\s*(?:gb|기가))/i.test(text);
  }
  if (raw.sku_id.startsWith("ps5-")) {
    return /(?:하이퍼\s*팝|하이퍼팝|커스텀\s*카모|스파이더맨|spider-?man|30주년|파이널\s*판타지|final\s*fantasy|ff\s*16)/i.test(text);
  }
  return false;
}

async function fetchParsedRows(categories: string[], limit: number) {
  return fetchJson<ParsedRow>(
    `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,category,comparable_key,condition_tier,needs_review,parse_confidence&category=in.(${categories.join(",")})&condition_tier=is.null&needs_review=eq.false&parse_confidence=gte.0.65&order=parsed_at.desc&limit=${limit}`,
  );
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,bunjang_condition_label&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchPoolRows(pids: number[]) {
  const rows: PoolRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,status&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function upsertParsed(rows: Record<string, unknown>[]) {
  for (const part of chunk(rows, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody(part),
    });
  }
}

async function markRawDirty(pids: number[]) {
  for (const part of chunk([...new Set(pids)], PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({ score_dirty: true }),
    });
  }
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const categories = arg("categories", "game_console,sport_golf").split(",").map((item) => item.trim()).filter(Boolean);
  const limit = Number(arg("limit", "1000"));
  const includeActivePool = hasFlag("include-active-pool");
  const includeRejectTier = hasFlag("include-reject-tier");
  const parsedRows = await fetchParsedRows(categories, limit);
  const rawRows = await fetchRawRows(parsedRows.map((row) => Number(row.pid)));
  const poolRows = await fetchPoolRows(parsedRows.map((row) => Number(row.pid)));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));

  const candidates: Candidate[] = [];
  const skipped: Candidate[] = [];
  for (const parsed of parsedRows) {
    const pid = Number(parsed.pid);
    const raw = rawByPid.get(pid);
    const activePool = poolByPid.get(pid)?.status === "ready" || poolByPid.get(pid)?.status === "reserved";
    const rawSku = raw?.sku_id ? skuById(raw.sku_id) ?? null : null;
    const currentSku = raw ? ruleMatch(raw.name ?? "", raw.description_preview ?? "") : null;
    const base = {
      pid,
      title: raw?.name ?? null,
      category: parsed.category,
      rawSkuId: raw?.sku_id ?? null,
      currentSkuId: currentSku?.id ?? null,
      comparableKey: parsed.comparable_key,
      oldTier: parsed.condition_tier,
      parserVersion: parsed.parser_version,
      currentParserVersion: null,
    };

    let skippedReason: string | null = null;
    if (!raw) skippedReason = "missing_raw";
    else if (activePool && !includeActivePool) skippedReason = "active_pool_skipped";
    else if (!rawSku) skippedReason = "raw_sku_not_in_catalog";
    else if (!currentSku) skippedReason = "current_catalog_rejects";
    else if (currentSku.id !== rawSku.id) skippedReason = "current_sku_differs";
    else if (currentSku.category !== parsed.category) skippedReason = "category_differs";
    else if (hasConsoleBundleAxisPending(raw)) skippedReason = "console_bundle_axis_pending";
    else if (hasConsoleVariantAxisPending(raw)) skippedReason = "console_variant_axis_pending";

    const reparsed = !skippedReason && rawSku
      ? parseListingOptions({
          title: raw?.name ?? "",
          description: raw?.description_preview ?? "",
          skuId: rawSku.id,
          skuName: rawSku.modelName,
          category: rawSku.category,
          bunjangConditionLabel: raw?.bunjang_condition_label,
          defaultProductType: rawSku.defaultProductType ?? null,
        })
      : null;
    const parsedRow = reparsed ? toParsedListingRow(pid, reparsed) : null;
    const newTier = parsedRow?.condition_tier ? String(parsedRow.condition_tier) : null;
    if (!skippedReason && !newTier) skippedReason = "current_tier_null";
    if (!skippedReason && newTier === "reject" && !includeRejectTier) skippedReason = "condition_reject_skipped";
    if (!skippedReason && parsedRow?.comparable_key !== parsed.comparable_key) skippedReason = "current_key_differs";

    const item: Candidate = {
      ...base,
      newTier,
      currentParserVersion: reparsed?.parserVersion ?? null,
      skippedReason,
      parsedRow: skippedReason ? null : parsedRow,
    };
    if (skippedReason) skipped.push(item);
    else candidates.push(item);
  }

  if (apply && candidates.length > 0) {
    await upsertParsed(candidates.map((item) => item.parsedRow).filter((row): row is Record<string, unknown> => Boolean(row)));
    await markRawDirty(candidates.map((item) => item.pid));
  }

  const suffix = apply ? "apply" : "dry-run";
  const report = {
    generatedAt: new Date().toISOString(),
    mode: suffix,
    categories,
    limit,
    includeActivePool,
    includeRejectTier,
    totals: {
      scannedParsedRows: parsedRows.length,
      rawRows: rawRows.length,
      candidateRows: candidates.length,
      skippedRows: skipped.length,
      applied: apply,
    },
    byCategory: summarizeBy(candidates, (item) => item.category),
    byTier: summarizeBy(candidates, (item) => item.newTier),
    skippedByReason: summarizeBy(skipped, (item) => item.skippedReason),
    samples: candidates.slice(0, 80).map(({ parsedRow: _parsedRow, ...item }) => item),
    skippedSamples: skipped.slice(0, 80).map(({ parsedRow: _parsedRow, ...item }) => item),
  };
  const jsonPath = path.join(reportsDir, `cross-category-tier-backfill-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `cross-category-tier-backfill-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Cross Category Tier Backfill",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Category",
    ...Object.entries(report.byCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Tier",
    ...Object.entries(report.byTier).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Skipped By Reason",
    ...Object.entries(report.skippedByReason).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
    ...report.samples.slice(0, 40).map((row) => `- pid ${row.pid}: ${row.title} / ${row.rawSkuId} / ${row.comparableKey} / ${row.oldTier}->${row.newTier}`),
    "",
    "## Skipped Samples",
    ...report.skippedSamples.slice(0, 40).map((row) => `- pid ${row.pid}: ${row.title} / ${row.rawSkuId}->${row.currentSkuId ?? "null"} / reason=${row.skippedReason}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    byCategory: report.byCategory,
    byTier: report.byTier,
    skippedByReason: report.skippedByReason,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
