import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { categoryFromComparableKey, loadCategoryReadinessMap } from "@/lib/category-readiness";
import { classifyListing, isSideOnlyEarbudListing } from "@/lib/pipeline";
import { detectSoldOut, describeSignals, isSoldOut, type SourceHealthStatus } from "@/lib/sold-out";

type PackBand = 1 | 2 | 3;

type PoolRow = {
  pid: number;
  profit_band: PackBand;
  status: string;
  expected_profit_min: number;
  expected_profit_max: number;
  score: number;
  confidence: number;
  comparable_key: string | null;
  category: string | null;
  exposure_count: number;
  max_exposure: number;
  last_verified_at: string;
  reserved_until: string | null;
};

type ListingMeta = {
  pid: number;
  name: string;
  url: string;
  price: number;
  sku_name: string;
  thumbnail_url: string | null;
};

type SourceHealthRow = {
  status: SourceHealthStatus;
  checked_at: string;
};

type CandidateResult = {
  pid: number;
  band: PackBand;
  category: string | null;
  key: string | null;
  name: string | null;
  price: number | null;
  decision: "reveal_cached" | "reveal_live" | "skip" | "error";
  reason: string;
  stale: boolean;
  liveChecked: boolean;
  lastVerifiedAt: string;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

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
    // optional env file
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
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
  if (!res.ok) {
    throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

async function fetchByPids<T>(table: string, select: string, pids: number[]): Promise<T[]> {
  const rows: T[] = [];
  for (const ids of chunk(pids, 180)) {
    if (ids.length === 0) continue;
    rows.push(...await restJson<T[]>(`/${table}?select=${select}&pid=in.(${ids.join(",")})`));
  }
  return rows;
}

function freshnessMsForBand(band: PackBand) {
  if (band === 3) return 0;
  if (band === 2) return 5 * 60 * 1000;
  return 15 * 60 * 1000;
}

function poolCategory(row: Pick<PoolRow, "category" | "comparable_key">) {
  return categoryFromComparableKey(row.category) ?? categoryFromComparableKey(row.comparable_key);
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function num(value: unknown) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compactName(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 52 ? `${text.slice(0, 52)}...` : text;
}

async function loadLatestSourceHealth(): Promise<SourceHealthStatus> {
  try {
    const rows = await restJson<SourceHealthRow[]>("/mvp_source_health?select=status,checked_at&source=eq.bunjang&order=checked_at.desc&limit=1");
    return rows[0]?.status ?? "degraded";
  } catch {
    return "degraded";
  }
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateCandidate(
  row: PoolRow,
  meta: ListingMeta | undefined,
  sourceHealth: SourceHealthStatus,
  delayMs: number,
): Promise<CandidateResult> {
  const base = {
    pid: row.pid,
    band: row.profit_band,
    category: poolCategory(row),
    key: row.comparable_key,
    name: meta?.name ?? null,
    price: meta?.price ?? null,
    lastVerifiedAt: row.last_verified_at,
    expectedProfitMin: row.expected_profit_min,
    expectedProfitMax: row.expected_profit_max,
    confidence: row.confidence,
  };

  if (!meta) {
    return { ...base, decision: "skip", reason: "missing_listing_meta", stale: true, liveChecked: false };
  }
  if (isSideOnlyEarbudListing(meta.name)) {
    return { ...base, decision: "skip", reason: "side_only_earbud_title", stale: true, liveChecked: false };
  }

  const lastVerifiedMs = new Date(row.last_verified_at).getTime();
  const stale = !(Number.isFinite(lastVerifiedMs) && Date.now() - lastVerifiedMs < freshnessMsForBand(row.profit_band));
  if (!stale) {
    return { ...base, decision: "reveal_cached", reason: "fresh_cached", stale: false, liveChecked: false };
  }

  await sleep(delayMs);
  try {
    const detail = await fetchDetail(String(row.pid));
    const signals = detectSoldOut(detail, meta.price, { title: meta.name });
    if (isSoldOut(signals)) {
      return {
        ...base,
        decision: "skip",
        reason: `live_sold_${sourceHealth}_${describeSignals(signals)}`,
        stale,
        liveChecked: true,
      };
    }
    const liveType = classifyListing(meta.name, detail?.description ?? "", meta.price).listingType;
    if (liveType !== "normal") {
      return { ...base, decision: "skip", reason: `live_type_${liveType}`, stale, liveChecked: true };
    }
    return { ...base, decision: "reveal_live", reason: "live_verified", stale, liveChecked: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return { ...base, decision: "error", reason: `live_error_${message.slice(0, 80)}`, stale, liveChecked: true };
  }
}

const targetCards = intArg("targetCards", 2, 1, 4);
const reserveLimit = intArg("reserveLimit", Math.max(targetCards * 8, 12), 1, 50);
const detailLimit = intArg("detailLimit", reserveLimit, 0, reserveLimit);
const delayMs = intArg("delayMs", 150, 0, 2000);
const bands = arg("bands", "1,2,3")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value): value is PackBand => value === 1 || value === 2 || value === 3);

function renderMarkdown(report: {
  generatedAt: string;
  targetCards: number;
  reserveLimit: number;
  detailLimit: number;
  delayMs: number;
  sourceHealth: SourceHealthStatus;
  summary: Record<string, number>;
  bandSummaries: {
    band: PackBand;
    sampled: number;
    wouldReveal: number;
    targetCards: number;
    openLikely: boolean;
    liveChecked: number;
    stale: number;
    readyCategories: { category: string; count: number }[];
  }[];
  reasons: { name: string; count: number }[];
  results: CandidateResult[];
}) {
  const lines = [
    "# Pack Open Dry Run Diagnostic",
    "",
    `- generated_at: ${report.generatedAt}`,
    `- source_health: ${report.sourceHealth}`,
    `- target_cards: ${report.targetCards}`,
    `- reserve_limit_per_band: ${report.reserveLimit}`,
    `- detail_limit_per_band: ${report.detailLimit}`,
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(report.summary).map(([key, value]) => [key, num(value)])),
    "",
    "## Band Summary",
    "",
    table(
      ["band", "sampled", "would_reveal", "target", "open_likely", "live_checked", "stale", "ready_categories"],
      report.bandSummaries.map((row) => [
        row.band,
        row.sampled,
        row.wouldReveal,
        row.targetCards,
        row.openLikely ? "yes" : "no",
        row.liveChecked,
        row.stale,
        row.readyCategories.map((item) => `${item.category}:${item.count}`).join(", "),
      ]),
    ),
    "",
    "## Reasons",
    "",
    table(["reason", "count"], report.reasons.map((row) => [row.name, num(row.count)])),
    "",
    "## Sample Results",
    "",
    table(
      ["band", "pid", "decision", "reason", "name", "price", "profit", "key"],
      report.results.slice(0, 80).map((row) => [
        row.band,
        row.pid,
        row.decision,
        row.reason,
        compactName(row.name),
        num(row.price),
        `${num(row.expectedProfitMin)}~${num(row.expectedProfitMax)}`,
        row.key ?? "-",
      ]),
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const [poolRows, readiness, sourceHealth] = await Promise.all([
    restJson<PoolRow[]>("/mvp_candidate_pool?select=pid,profit_band,status,expected_profit_min,expected_profit_max,score,confidence,comparable_key,category,exposure_count,max_exposure,last_verified_at,reserved_until&status=eq.ready&order=profit_band.asc,exposure_count.asc,confidence.desc,score.desc,last_verified_at.desc&limit=5000"),
    loadCategoryReadinessMap(),
    loadLatestSourceHealth(),
  ]);

  const eligibleByBand = new Map<PackBand, PoolRow[]>();
  const categoryCountsByBand = new Map<PackBand, Map<string, number>>();

  for (const band of bands) {
    const bandRows = poolRows.filter((row) => row.profit_band === band && row.exposure_count < row.max_exposure);
    const categoryCounts = new Map<string, number>();
    for (const row of bandRows) {
      const category = poolCategory(row);
      if (!category) continue;
      const config = readiness[category];
      if (!config || config.status !== "ready") continue;
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
    categoryCountsByBand.set(band, categoryCounts);
    eligibleByBand.set(
      band,
      bandRows.filter((row) => {
        const category = poolCategory(row);
        if (!category) return false;
        const config = readiness[category];
        if (!config || config.status !== "ready") return false;
        return (categoryCounts.get(category) ?? 0) >= config.minReadyPool;
      }).slice(0, reserveLimit),
    );
  }

  const sampledRows = [...eligibleByBand.values()].flat();
  const metas = await fetchByPids<ListingMeta>(
    "mvp_listings",
    "pid,name,url,price,sku_name,thumbnail_url",
    sampledRows.map((row) => row.pid),
  );
  const metaByPid = new Map(metas.map((row) => [Number(row.pid), row]));

  const results: CandidateResult[] = [];
  for (const band of bands) {
    const rows = eligibleByBand.get(band) ?? [];
    let liveChecks = 0;
    for (const row of rows) {
      const lastVerifiedMs = new Date(row.last_verified_at).getTime();
      const stale = !(Number.isFinite(lastVerifiedMs) && Date.now() - lastVerifiedMs < freshnessMsForBand(row.profit_band));
      if (stale && liveChecks >= detailLimit) {
        results.push({
          pid: row.pid,
          band: row.profit_band,
          category: poolCategory(row),
          key: row.comparable_key,
          name: metaByPid.get(row.pid)?.name ?? null,
          price: metaByPid.get(row.pid)?.price ?? null,
          decision: "skip",
          reason: "not_checked_detail_limit",
          stale: true,
          liveChecked: false,
          lastVerifiedAt: row.last_verified_at,
          expectedProfitMin: row.expected_profit_min,
          expectedProfitMax: row.expected_profit_max,
          confidence: row.confidence,
        });
        continue;
      }
      if (stale) liveChecks += 1;
      results.push(await simulateCandidate(row, metaByPid.get(row.pid), sourceHealth, delayMs));
    }
  }

  const revealed = results.filter((row) => row.decision === "reveal_cached" || row.decision === "reveal_live");
  const bandSummaries = bands.map((band) => {
    const rows = results.filter((row) => row.band === band);
    const reveals = rows.filter((row) => row.decision === "reveal_cached" || row.decision === "reveal_live");
    const categories = categoryCountsByBand.get(band) ?? new Map();
    return {
      band,
      sampled: rows.length,
      wouldReveal: reveals.length,
      targetCards,
      openLikely: reveals.length >= targetCards,
      liveChecked: rows.filter((row) => row.liveChecked).length,
      stale: rows.filter((row) => row.stale).length,
      readyCategories: [...categories.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count })),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    targetCards,
    reserveLimit,
    detailLimit,
    delayMs,
    sourceHealth,
    summary: {
      sampled: results.length,
      wouldReveal: revealed.length,
      skipped: results.filter((row) => row.decision === "skip").length,
      errors: results.filter((row) => row.decision === "error").length,
      liveChecked: results.filter((row) => row.liveChecked).length,
    },
    bandSummaries,
    reasons: countBy(results, (row) => `${row.band}:${row.reason}`),
    results,
  };

  const jsonPath = path.join(reportsDir, "pack-open-dry-run-latest.json");
  const mdPath = path.join(reportsDir, "pack-open-dry-run-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));

  console.log(JSON.stringify({
    summary: report.summary,
    bandSummaries: report.bandSummaries.map((row) => ({
      band: row.band,
      sampled: row.sampled,
      wouldReveal: row.wouldReveal,
      openLikely: row.openLikely,
      liveChecked: row.liveChecked,
    })),
    jsonPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
