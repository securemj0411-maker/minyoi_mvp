import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PoolRow = {
  pid: number;
  profit_band: number | null;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  confidence: number | null;
};

type AnalysisRow = {
  pid: number;
  score_flags: string[] | null;
  risk_hits: number | null;
  score: number | null;
};

type ListingRow = {
  pid: number;
  name: string | null;
  sku_name: string | null;
  price: number | null;
  sku_median: number | null;
};

type AiRow = {
  pid: number;
  listing_type: string | null;
  confidence: string | null;
  risk_keywords: string[] | null;
  classified_at: string | null;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const AI_HARD_RISK_KEYWORDS = [
  "case_only",
  "charging_case_only",
  "protective_case_only",
  "cover_only",
  "unit_only",
  "one_side",
  "parts",
  "broken",
  "damaged",
  "counterfeit",
  "fake",
  "replica",
  "buying",
  "wanted",
  "sold_out",
  "reserved",
  "multi_sku",
  "commercial",
  "dealer",
  "케이스단독",
  "케이스 단독",
  "유닛단독",
  "유닛 단독",
  "단품",
  "가품",
  "짝퉁",
  "삽니다",
  "구매",
  "판매완료",
  "거래완료",
];

const AI_TRIGGER_FLAGS = new Set([
  "deep_discount_review",
  "extreme_discount_review",
  "risk_keyword_review",
  "weak_description",
  "coarse_market_price",
  "market_stat_missing",
  "market_confidence_low",
  "option_parse_review",
  "option_needs_review",
  "condition_review",
  "commercial_review",
  "multi_model_review",
  "suspicious_model_review",
  "short_title",
  "weak_normal_signal",
]);

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
  } catch {
    // optional
  }
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function chunks<T>(rows: T[], size: number) {
  const output: T[][] = [];
  for (let i = 0; i < rows.length; i += size) output.push(rows.slice(i, i + size));
  return output;
}

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasHardRisk(ai: AiRow | undefined) {
  const text = normalize((ai?.risk_keywords ?? []).join(" "));
  return AI_HARD_RISK_KEYWORDS.some((keyword) => text.includes(normalize(keyword)));
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(value: unknown, length = 70) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function latestAiByPid(rows: AiRow[]) {
  const map = new Map<number, AiRow>();
  for (const row of rows) {
    const pid = Number(row.pid);
    const existing = map.get(pid);
    if (!existing || String(row.classified_at ?? "") > String(existing.classified_at ?? "")) {
      map.set(pid, row);
    }
  }
  return map;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const generatedAt = new Date().toISOString();
  const pool = await restJson<PoolRow[]>(
    "/mvp_candidate_pool?select=pid,profit_band,status,category,comparable_key,expected_profit_min,expected_profit_max,confidence&status=in.(ready,reserved)&limit=5000",
  );
  const pids = [...new Set(pool.map((row) => Number(row.pid)).filter(Number.isFinite))];

  const analyses = new Map<number, AnalysisRow>();
  const listings = new Map<number, ListingRow>();
  const aiRows: AiRow[] = [];

  for (const chunk of chunks(pids, 180)) {
    const ids = chunk.join(",");
    const [analysisRows, listingRows, classificationRows] = await Promise.all([
      restJson<AnalysisRow[]>(`/mvp_listing_analysis?select=pid,score_flags,risk_hits,score&pid=in.(${ids})`),
      restJson<ListingRow[]>(`/mvp_listings?select=pid,name,sku_name,price,sku_median&pid=in.(${ids})`),
      restJson<AiRow[]>(`/mvp_listing_ai_classifications?select=pid,listing_type,confidence,risk_keywords,classified_at&pid=in.(${ids})`),
    ]);
    for (const row of analysisRows) analyses.set(Number(row.pid), row);
    for (const row of listingRows) listings.set(Number(row.pid), row);
    aiRows.push(...classificationRows);
  }

  const aiByPid = latestAiByPid(aiRows);

  const impactRows = pool.map((row) => {
    const pid = Number(row.pid);
    const analysis = analyses.get(pid);
    const listing = listings.get(pid);
    const ai = aiByPid.get(pid);
    const flags = Array.isArray(analysis?.score_flags) ? analysis.score_flags : [];
    const hasTrigger = flags.some((flag) => AI_TRIGGER_FLAGS.has(flag)) || flags.some((flag) => flag.startsWith("ai_"));
    let escrowStatus = "not_ai_reviewed";
    if (ai) {
      const type = String(ai.listing_type ?? "unknown");
      const confidence = String(ai.confidence ?? "low");
      if (type === "normal" && confidence === "high" && !hasHardRisk(ai)) escrowStatus = "would_pass_on_recheck";
      else if (type !== "normal" && confidence !== "low") escrowStatus = "would_reject_on_recheck";
      else escrowStatus = "would_hold_on_recheck";
    } else if (hasTrigger) {
      escrowStatus = "needs_ai_review_next_score";
    }
    return {
      ...row,
      name: listing?.name ?? null,
      skuName: listing?.sku_name ?? null,
      price: listing?.price ?? null,
      skuMedian: listing?.sku_median ?? null,
      scoreFlags: flags,
      riskHits: analysis?.risk_hits ?? null,
      aiType: ai?.listing_type ?? null,
      aiConfidence: ai?.confidence ?? null,
      aiRiskKeywords: ai?.risk_keywords ?? [],
      escrowStatus,
    };
  });

  const summary = {
    generatedAt,
    poolRows: impactRows.length,
    readyRows: impactRows.filter((row) => row.status === "ready").length,
    reservedRows: impactRows.filter((row) => row.status === "reserved").length,
    aiCacheRows: impactRows.filter((row) => row.aiType).length,
    wouldPassOnRecheck: impactRows.filter((row) => row.escrowStatus === "would_pass_on_recheck").length,
    wouldHoldOnRecheck: impactRows.filter((row) => row.escrowStatus === "would_hold_on_recheck").length,
    wouldRejectOnRecheck: impactRows.filter((row) => row.escrowStatus === "would_reject_on_recheck").length,
    needsAiReviewNextScore: impactRows.filter((row) => row.escrowStatus === "needs_ai_review_next_score").length,
    notAiReviewed: impactRows.filter((row) => row.escrowStatus === "not_ai_reviewed").length,
  };

  const statusRows = countBy(impactRows, (row) => row.escrowStatus);
  const categoryRows = countBy(impactRows, (row) => `${row.category ?? "unknown"}:${row.escrowStatus}`);
  const flagRows = countBy(
    impactRows.flatMap((row) => row.scoreFlags.map((flag) => ({ flag }))),
    (row) => row.flag,
  ).slice(0, 20);
  const attentionExamples = impactRows
    .filter((row) => row.escrowStatus !== "would_pass_on_recheck" && row.escrowStatus !== "not_ai_reviewed")
    .sort((a, b) => Number(b.expected_profit_max ?? 0) - Number(a.expected_profit_max ?? 0))
    .slice(0, 20);

  const report = {
    summary,
    statusRows,
    categoryRows,
    flagRows,
    attentionExamples,
  };

  const markdown = [
    "# AI Second Opinion Impact Report",
    "",
    `- generated_at: ${generatedAt}`,
    "- mode: read_only_no_mutation",
    "- scope: current mvp_candidate_pool ready/reserved rows",
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(summary).map(([key, value]) => [key, value])),
    "",
    "## Escrow Status",
    "",
    table(["status", "count"], statusRows.map((row) => [row.name, row.count])),
    "",
    "## Category x Status",
    "",
    table(["category_status", "count"], categoryRows.slice(0, 30).map((row) => [row.name, row.count])),
    "",
    "## Top Score Flags",
    "",
    table(["flag", "count"], flagRows.map((row) => [row.name, row.count])),
    "",
    "## Attention Examples",
    "",
    table(
      ["pid", "status", "band", "category", "profit_max", "ai", "flags", "title"],
      attentionExamples.map((row) => [
        row.pid,
        row.escrowStatus,
        row.profit_band,
        row.category,
        row.expected_profit_max,
        `${row.aiType ?? "-"}:${row.aiConfidence ?? "-"}`,
        row.scoreFlags.slice(0, 4).join(", "),
        compact(row.name),
      ]),
    ),
    "",
    "## Decision",
    "",
    summary.wouldHoldOnRecheck + summary.wouldRejectOnRecheck === 0
      ? "- 현재 ready/reserved 후보풀에서 기존 AI cache 때문에 즉시 보류/탈락으로 뒤집힐 행은 없다."
      : "- 기존 AI cache 기준으로 다음 재점수 때 보류/탈락될 수 있는 후보가 있으므로 공개 영향 확인이 필요하다.",
    "- `needs_ai_review_next_score`는 다음 scoring 때 AI escrow 대상이 될 가능성이 있는 행이며, 즉시 DB 변경을 뜻하지 않는다.",
    "",
  ].join("\n");

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "ai-second-opinion-impact-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "ai-second-opinion-impact-latest.md"), markdown);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
