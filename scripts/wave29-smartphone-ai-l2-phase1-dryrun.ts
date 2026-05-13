import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { shouldReviewByPolicy, isAiL2PolicyEnabled, AI_L2_MODEL } from "@/lib/ai-l2-policy";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const SMARTPHONE_IPHONE_PREFIXES = ["iphone-15-pro","iphone-16-pro","iphone-14-pro","iphone-13-pro","iphone-12-pro","iphone-15-pro-max","iphone-16-pro-max","iphone-14-pro-max","iphone-13-pro-max","iphone-16e","iphone-15-pro-128-self","iphone-16-pro-128-self","iphone-14-pro-128-self","iphone-13-pro-128-self","iphone-12-pro-128-self"];

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
  sku_id: string;
  name: string;
  price: number;
  description_preview?: string | null;
  parsed?: {
    comparable_key: string | null;
    parse_confidence: number;
    needs_review: boolean | null;
    critical_unknown?: string[];
  } | null;
  analysis?: {
    price_gap: number;
    score_flags: string[];
  } | null;
};

async function fetchSmartphoneRows(): Promise<Row[]> {
  const skuFilter = SMARTPHONE_IPHONE_PREFIXES.map((s) => `"${s}"`).join(",");
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,name,price,description_preview&listing_state=eq.active&listing_type=eq.normal&sku_id=in.(${skuFilter})&limit=2000`,
    { headers: serviceHeaders() },
  );
  const raws = (await res.json()) as Array<Row>;
  const pids = raws.map((r) => r.pid);
  if (pids.length === 0) return [];

  // batch parsed + analysis lookup
  const pidsCsv = pids.join(",");
  const parsedRes = await restFetch(
    `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${pidsCsv})&limit=2000`,
    { headers: serviceHeaders() },
  );
  const parsedRows = (await parsedRes.json()) as Array<{ pid: number; comparable_key: string | null; parse_confidence: number; needs_review: boolean | null; parsed_json: { critical_unknown?: string[] } | null }>;
  const parsedByPid = new Map<number, NonNullable<Row["parsed"]>>();
  for (const p of parsedRows) {
    parsedByPid.set(p.pid, {
      comparable_key: p.comparable_key,
      parse_confidence: Number(p.parse_confidence ?? 0),
      needs_review: p.needs_review,
      critical_unknown: p.parsed_json?.critical_unknown ?? [],
    });
  }

  const analysisRes = await restFetch(
    `${tableUrl("mvp_listing_analysis")}?select=pid,price_gap,score_flags&pid=in.(${pidsCsv})&limit=2000`,
    { headers: serviceHeaders() },
  );
  const analysisRows = (await analysisRes.json()) as Array<{ pid: number; price_gap: number; score_flags: string[] }>;
  const analysisByPid = new Map<number, NonNullable<Row["analysis"]>>();
  for (const a of analysisRows) {
    analysisByPid.set(a.pid, { price_gap: Number(a.price_gap ?? 0), score_flags: a.score_flags ?? [] });
  }

  return raws.map((r) => ({ ...r, parsed: parsedByPid.get(r.pid) ?? null, analysis: analysisByPid.get(r.pid) ?? null }));
}

async function fetchCacheCount(): Promise<number> {
  const res = await restFetch(
    `${tableUrl("mvp_listing_ai_classifications")}?select=pid`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  const total = res.headers.get("content-range")?.split("/")[1] ?? "0";
  return Number(total);
}

async function fetchCachedPids(pids: number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set();
  const pidsCsv = pids.join(",");
  const res = await restFetch(
    `${tableUrl("mvp_listing_ai_classifications")}?select=pid&pid=in.(${pidsCsv})&limit=2000`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ pid: number }>;
  return new Set(rows.map((r) => r.pid));
}

function buildPromptSummary(row: Row) {
  return {
    title: row.name,
    price: row.price,
    sku: row.sku_id,
    flags: row.analysis?.score_flags ?? [],
    parser: {
      comparable_key: row.parsed?.comparable_key ?? null,
      parse_confidence: row.parsed?.parse_confidence ?? null,
      needs_review: row.parsed?.needs_review ?? null,
      critical_unknown: row.parsed?.critical_unknown ?? [],
    },
    description_preview: (row.description_preview ?? "").slice(0, 200),
  };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const startedAt = new Date().toISOString();
  const policyEnabled = isAiL2PolicyEnabled();
  const aiModel = process.env.OPENAI_CLASSIFIER_MODEL ?? AI_L2_MODEL;
  const inputUsdPer1M = Number(process.env.OPENAI_CLASSIFIER_INPUT_USD_PER_1M ?? 0.4);
  const outputUsdPer1M = Number(process.env.OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M ?? 1.6);

  const rows = await fetchSmartphoneRows();
  console.log(`smartphone iPhone active normal rows: ${rows.length}`);

  // partition
  const nrTrue = rows.filter((r) => r.parsed?.needs_review === true);
  const nrFalse = rows.filter((r) => r.parsed?.needs_review === false);
  const nrNull = rows.filter((r) => !r.parsed || r.parsed.needs_review === null);

  // which would currently trigger AI review (legacy/policy path, only nrFalse since nrTrue is skipped)
  const wouldReviewToday = nrFalse.filter((r) => {
    return shouldReviewByPolicy({
      priceGap: r.analysis?.price_gap ?? 0,
      scoreFlags: r.analysis?.score_flags ?? [],
      category: "smartphone",
      legacySuspicious: false,
    });
  });

  // phase-2 escrow candidates: nrTrue rows would be unlocked behind tiny cap
  const phase2EscrowCandidates = nrTrue;

  // cache hit rate today
  const cachedPids = await fetchCachedPids(rows.map((r) => r.pid));
  const cacheHitsAmongReview = wouldReviewToday.filter((r) => cachedPids.has(r.pid)).length;
  const cacheMissAmongReview = wouldReviewToday.length - cacheHitsAmongReview;

  // tiny cap dry-run: top-50 escrow candidates by priceGap desc (proxy for ROI)
  const TINY_CAP = 50;
  const sortedEscrow = [...phase2EscrowCandidates]
    .sort((a, b) => (b.analysis?.price_gap ?? 0) - (a.analysis?.price_gap ?? 0))
    .slice(0, TINY_CAP);

  // estimated tokens: ~800 input / ~120 output per call (observed avg from earlier reports).
  const estInputTokens = 800;
  const estOutputTokens = 120;
  const estCostPerCall = (estInputTokens * inputUsdPer1M + estOutputTokens * outputUsdPer1M) / 1_000_000;
  const estTinyCapCost = estCostPerCall * sortedEscrow.length;
  const estTodayCost = estCostPerCall * cacheMissAmongReview;

  const cacheTotal = await fetchCacheCount();

  // sample 5 prompts from each partition (verification of metadata bridge)
  const promptSamples = {
    needs_review_false_to_review: wouldReviewToday.slice(0, 5).map(buildPromptSummary),
    needs_review_true_phase2_candidates: sortedEscrow.slice(0, 5).map(buildPromptSummary),
  };

  // partition by SKU
  const skuBreakdown: Record<string, { total: number; nr_true: number; nr_false: number; would_review: number }> = {};
  for (const r of rows) {
    const key = r.sku_id;
    skuBreakdown[key] ??= { total: 0, nr_true: 0, nr_false: 0, would_review: 0 };
    skuBreakdown[key].total += 1;
    if (r.parsed?.needs_review === true) skuBreakdown[key].nr_true += 1;
    if (r.parsed?.needs_review === false) skuBreakdown[key].nr_false += 1;
  }
  for (const r of wouldReviewToday) {
    if (skuBreakdown[r.sku_id]) skuBreakdown[r.sku_id].would_review += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    scope: "smartphone (iPhone family only)",
    aiL2PolicyEnabled: policyEnabled,
    aiModel,
    promptVersion: "ai_l2_parser_metadata_v1",
    metadataBridgeStatus: {
      pipelineRowFields: ["parseConfidence", "parserNeedsReview", "comparableKey", "parserUnknownParts", "parserCriticalUnknown", "aiEscrowKind"],
      promptIncludesParserContext: true,
      sourceLine: "pipeline.ts:1274-1281 (classifyWithAi parser block)",
    },
    population: {
      totalActiveNormal: rows.length,
      needsReviewTrue: nrTrue.length,
      needsReviewFalse: nrFalse.length,
      needsReviewNull: nrNull.length,
    },
    currentPhase1State: {
      wouldReviewTodayCount: wouldReviewToday.length,
      cacheHitsAmongReview,
      cacheMissAmongReview,
      estTodayCostUsd: Number(estTodayCost.toFixed(4)),
      note: "Phase 1 metadata reaches AI for any needs_review=false smartphone listing that triggers the review policy. needs_review=true rows are skipped at scoreStage (tick-pipeline.ts:3344) and never reach AI today.",
    },
    phase2EscrowOpportunity: {
      candidateCount: phase2EscrowCandidates.length,
      tinyCapSelected: sortedEscrow.length,
      tinyCap: TINY_CAP,
      estTinyCapCostUsd: Number(estTinyCapCost.toFixed(4)),
      note: "needs_review=true smartphone rows are the Phase 2 escrow population. Unblocking requires (a) AI cache FK migration from mvp_listings → mvp_raw_listings, (b) scoreStage exception path for tiny-cap escrow.",
    },
    aiCacheState: {
      totalRows: cacheTotal,
      fkTarget: "mvp_listings(pid) — blocks needs_review=true escrow",
      requiredMigration: "ALTER FK to mvp_raw_listings(pid) before Phase 2. review-only, no apply this wave.",
    },
    skuBreakdown,
    promptSamples,
    nextActions: [
      "Phase 2 prerequisite: write FK migration review-only doc (mvp_listing_ai_classifications.pid → mvp_raw_listings(pid)).",
      "Phase 2 prerequisite: scoreStage exception path design (tiny-cap escrow for needs_review=true smartphone narrow lane rows only).",
      "Phase 2 prerequisite: pool-policy keep blocking AI-pass needs_review rows until escrow is explicit.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave29-smartphone-ai-l2-phase1-dryrun-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  console.log("\n--- Wave 29 Smartphone AI L2 Phase 1 dry-run ---");
  console.log(`total active normal iPhone rows: ${rows.length}`);
  console.log(`needs_review=true (Phase 2 candidates): ${nrTrue.length}`);
  console.log(`needs_review=false (Phase 1 visible to AI today): ${nrFalse.length}`);
  console.log(`would_review_today (legacy/policy gate): ${wouldReviewToday.length}`);
  console.log(`cache hits among review today: ${cacheHitsAmongReview}`);
  console.log(`tiny-cap escrow (top-${TINY_CAP} by price_gap): est cost $${estTinyCapCost.toFixed(4)}`);
  console.log(`AI cache total rows: ${cacheTotal}, FK target: mvp_listings (blocks Phase 2 until migrated)`);
  console.log(`report: ${jsonPath}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
