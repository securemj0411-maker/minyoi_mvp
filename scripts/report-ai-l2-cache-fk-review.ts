import fs from "node:fs";
import path from "node:path";

type CountedRows<T> = {
  count: number | null;
  rows: T[];
};

const appDir = process.cwd();
const reportDir = path.join(appDir, "reports");
const mdPath = path.join(reportDir, "ai-l2-cache-fk-review-latest.md");
const jsonPath = path.join(reportDir, "ai-l2-cache-fk-review-latest.json");

async function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL is not configured");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    prefer: "count=exact",
  };
}

function parseCount(contentRange: string | null) {
  const raw = contentRange?.split("/")[1];
  if (!raw || raw === "*") return null;
  const count = Number(raw);
  return Number.isFinite(count) ? count : null;
}

async function restRows<T>(pathAndQuery: string): Promise<CountedRows<T>> {
  const res = await fetch(`${restBase()}${pathAndQuery}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Supabase REST failed ${res.status}: ${await res.text()}`);
  }
  return {
    count: parseCount(res.headers.get("content-range")),
    rows: await res.json() as T[],
  };
}

function withPage(pathAndQuery: string, limit: number, offset: number) {
  const joiner = pathAndQuery.includes("?") ? "&" : "?";
  return `${pathAndQuery}${joiner}limit=${limit}&offset=${offset}`;
}

async function pidSet(pathAndQuery: string) {
  const pageSize = 1000;
  const first = await restRows<{ pid: number }>(withPage(pathAndQuery, pageSize, 0));
  const count = first.count;
  const rows = [...first.rows];
  const expected = count ?? first.rows.length;
  for (let offset = first.rows.length; offset < expected; offset += pageSize) {
    const page = await restRows<{ pid: number }>(withPage(pathAndQuery, pageSize, offset));
    rows.push(...page.rows);
    if (page.rows.length === 0) break;
  }
  return {
    count,
    truncated: count != null && rows.length < count,
    pids: new Set(rows.map((row) => Number(row.pid)).filter(Number.isFinite)),
  };
}

function diffCount(left: Set<number>, right: Set<number>) {
  let count = 0;
  for (const pid of left) {
    if (!right.has(pid)) count += 1;
  }
  return count;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  fs.mkdirSync(reportDir, { recursive: true });

  const [
    rawAll,
    rawDoneNormal,
    listings,
    parsedNeedsReview,
    parsedNoReview,
    aiCache,
  ] = await Promise.all([
    pidSet("/mvp_raw_listings?select=pid"),
    pidSet("/mvp_raw_listings?select=pid&detail_status=eq.done&listing_type=eq.normal"),
    pidSet("/mvp_listings?select=pid"),
    pidSet("/mvp_listing_parsed?select=pid&needs_review=eq.true"),
    pidSet("/mvp_listing_parsed?select=pid&needs_review=eq.false"),
    pidSet("/mvp_listing_ai_classifications?select=pid"),
  ]);

  const needsReviewMissingFromListings = diffCount(parsedNeedsReview.pids, listings.pids);
  const aiCacheMissingFromRaw = diffCount(aiCache.pids, rawAll.pids);
  const aiCacheMissingFromRawDoneNormal = diffCount(aiCache.pids, rawDoneNormal.pids);
  const aiCacheMissingFromListings = diffCount(aiCache.pids, listings.pids);
  const generatedAt = new Date().toISOString();

  const recommendation = {
    decision: "review_only_no_migration_applied",
    preferredMigration: "Keep mvp_listing_ai_classifications primary key on pid, but change the FK target from mvp_listings(pid) to mvp_raw_listings(pid).",
    defer: [
      "Do not revive parsed.needs_review=true rows into scoreStage until FK/cache behavior is approved.",
      "Do not change the primary key to (pid, content_hash) in the first migration; that can accumulate multiple cache rows per listing.",
      "Do not let AI pass override parser critical unknowns or pool policy blocks.",
    ],
    requiredGuards: [
      "Tiny cap for needs_review escrow rows.",
      "Retention by classified_at if AI L2 volume increases.",
      "Pool-policy blocklist remains the final gate even when AI is available.",
    ],
  };

  const summary = {
    generatedAt,
    counts: {
      rawAll: rawAll.count,
      rawDoneNormal: rawDoneNormal.count,
      listings: listings.count,
      parsedNeedsReview: parsedNeedsReview.count,
      parsedNoReview: parsedNoReview.count,
      aiCache: aiCache.count,
      needsReviewMissingFromListings,
      aiCacheMissingFromRaw,
      aiCacheMissingFromRawDoneNormal,
      aiCacheMissingFromListings,
    },
    truncated: {
      rawAll: rawAll.truncated,
      rawDoneNormal: rawDoneNormal.truncated,
      listings: listings.truncated,
      parsedNeedsReview: parsedNeedsReview.truncated,
      parsedNoReview: parsedNoReview.truncated,
      aiCache: aiCache.truncated,
    },
    recommendation,
  };

  const md = [
    "# AI L2 Cache FK Review",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Live Counts",
    "",
    mdTable(
      ["Metric", "Value", "Meaning"],
      [
        ["raw done normal", rawDoneNormal.count ?? "unknown", "Potential future AI L2 source if FK targets raw."],
        ["raw all", rawAll.count ?? "unknown", "Actual proposed FK target."],
        ["mvp_listings", listings.count ?? "unknown", "Current FK target and current scored output surface."],
        ["parsed needs_review=true", parsedNeedsReview.count ?? "unknown", "Rows that are currently skipped before AI review."],
        ["parsed needs_review=false", parsedNoReview.count ?? "unknown", "Rows eligible for normal score path."],
        ["AI cache rows", aiCache.count ?? "unknown", "Current pid-primary cache size."],
        ["needs_review missing from listings", needsReviewMissingFromListings, "Rows that would fail current FK if AI cache attempted insert."],
        ["AI cache missing from raw all", aiCacheMissingFromRaw, "Must be zero before changing FK to raw."],
        ["AI cache missing from raw done normal", aiCacheMissingFromRawDoneNormal, "Rows outside current active normal subset, not necessarily FK blockers."],
        ["AI cache missing from listings", aiCacheMissingFromListings, "Expected zero under current FK."],
      ],
    ),
    "",
    "## Decision",
    "",
    `- Status: ${recommendation.decision}`,
    `- Preferred migration: ${recommendation.preferredMigration}`,
    "- Rationale: current cache is pid-primary, so moving only the FK allows needs_review escrow caching without turning cache storage into content_hash history.",
    "- Risk: raw table is broader than listings; control the blast radius with tiny caps, retention, and pool-policy hard blocks.",
    "",
    "## Deferred",
    "",
    ...recommendation.defer.map((item) => `- ${item}`),
    "",
    "## Required Guards",
    "",
    ...recommendation.requiredGuards.map((item) => `- ${item}`),
    "",
  ].join("\n");

  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`wrote ${mdPath}`);
  console.log(`wrote ${jsonPath}`);
  console.table(summary.counts);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
