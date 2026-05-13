import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type FkReview = {
  generatedAt?: string;
  counts?: {
    rawAll?: number | null;
    rawDoneNormal?: number | null;
    listings?: number | null;
    parsedNeedsReview?: number | null;
    aiCache?: number | null;
    needsReviewMissingFromListings?: number;
    aiCacheMissingFromRaw?: number;
    aiCacheMissingFromListings?: number;
  };
};

type TinyEscrow = {
  generatedAt?: string;
  counts?: {
    eligibleEscrowRows?: number;
    selectedTinyCapRows?: number;
    estimatedCostUsd?: number;
  };
};

type LaneSplit = {
  generatedAt?: string;
  actionCounts?: Record<string, number>;
};

type Check = {
  name: string;
  status: "pass" | "hold" | "warn";
  evidence: string;
};

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const OUT_JSON = path.join(REPORT_DIR, "ai-l2-fk-owner-checklist-latest.json");
const OUT_MD = path.join(REPORT_DIR, "ai-l2-fk-owner-checklist-latest.md");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function readText(file: string): string {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

function check(name: string, ok: boolean, evidence: string, warn = false): Check {
  return {
    name,
    status: ok ? "pass" : warn ? "warn" : "hold",
    evidence,
  };
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

const fkReview = readJson<FkReview>(path.join(REPORT_DIR, "ai-l2-cache-fk-review-latest.json"), {});
const tinyEscrow = readJson<TinyEscrow>(path.join(REPORT_DIR, "ai-l2-tiny-escrow-candidates-latest.json"), {});
const laneSplit = readJson<LaneSplit>(path.join(REPORT_DIR, "lane-next-action-split-latest.json"), {});
const schema = readText(path.join(ROOT, "supabase/schema.sql"));
const pipeline = readText(path.join(ROOT, "src/lib/pipeline.ts"));
const poolPolicy = readText(path.join(ROOT, "src/lib/pool-policy.mjs"));

const counts = fkReview.counts ?? {};
const tinySummary = tinyEscrow.counts ?? {};
const laneSummary = laneSplit.actionCounts ?? {};
const requiredPoolFlags = [
  "option_needs_review",
  "parser_unknown_option",
  "generation_ambiguity",
  "connectivity_ambiguity",
  "bundle_or_accessory_ambiguity",
  "self_unlocked_ambiguity",
];
const missingPoolFlags = requiredPoolFlags.filter((flag) => !poolPolicy.includes(flag));
const schemaCurrentFkLooksListing =
  /mvp_listing_ai_classifications\s*\([^;]*pid\s+bigint\s+primary key\s+references\s+public\.mvp_listings\(pid\)/.test(schema);
const pipelineUsesAiCache = pipeline.includes("mvp_listing_ai_classifications");
const pipelineUsesContentHash = pipeline.includes("content_hash");

const checks: Check[] = [
  check(
    "current cache rows have raw parent",
    counts.aiCacheMissingFromRaw === 0,
    `aiCacheMissingFromRaw=${counts.aiCacheMissingFromRaw ?? "unknown"}`,
  ),
  check(
    "current cache remains consistent with old target",
    counts.aiCacheMissingFromListings === 0,
    `aiCacheMissingFromListings=${counts.aiCacheMissingFromListings ?? "unknown"}`,
  ),
  check(
    "migration is actually needed for needs_review escrow",
    Number(counts.needsReviewMissingFromListings ?? 0) > 0,
    `needsReviewMissingFromListings=${counts.needsReviewMissingFromListings ?? "unknown"}`,
  ),
  check(
    "local schema still points FK at mvp_listings",
    schemaCurrentFkLooksListing,
    schemaCurrentFkLooksListing ? "schema.sql current FK target is mvp_listings(pid)" : "schema.sql FK target pattern not found",
    true,
  ),
  check(
    "runtime cache path uses pid + content_hash lookup",
    pipelineUsesAiCache && pipelineUsesContentHash,
    `pipelineUsesAiCache=${pipelineUsesAiCache}, pipelineUsesContentHash=${pipelineUsesContentHash}`,
  ),
  check(
    "pool hard-block flags still protect parser gap rows",
    missingPoolFlags.length === 0,
    missingPoolFlags.length ? `missing=${missingPoolFlags.join(", ")}` : "all required parser-gap flags present",
  ),
  check(
    "tiny escrow has bounded candidate set",
    Number(tinySummary.selectedTinyCapRows ?? 0) > 0 && Number(tinySummary.selectedTinyCapRows ?? 0) <= 100,
    `selectedRows=${tinySummary.selectedTinyCapRows ?? "unknown"}, eligibleRows=${tinySummary.eligibleEscrowRows ?? "unknown"}`,
  ),
  check(
    "lane split confirms AI L2 is the main next path",
    Number(laneSummary.ai_l2_primary ?? 0) > Number(laneSummary.one_measured_patch ?? 0),
    `ai_l2_primary=${laneSummary.ai_l2_primary ?? 0}, one_measured_patch=${laneSummary.one_measured_patch ?? 0}`,
  ),
];

const hardHolds = checks.filter((item) => item.status === "hold");
const warnings = checks.filter((item) => item.status === "warn");
const decision =
  hardHolds.length === 0
    ? "owner_can_approve_fk_migration_only_low_traffic_window"
    : "hold_fk_migration_until_checks_pass";
const generatedAt = new Date().toISOString();

const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  ddlApplied: false,
  decision,
  sourceReports: {
    fkReview: fkReview.generatedAt ?? null,
    tinyEscrow: tinyEscrow.generatedAt ?? null,
    laneSplit: laneSplit.generatedAt ?? null,
  },
  counts,
  tinyEscrow: tinySummary,
  laneSplit: laneSummary,
  checks,
  hardHolds,
  warnings,
  approvedScopeIfOwnerSaysYes: [
    "Only change mvp_listing_ai_classifications.pid FK target from mvp_listings(pid) to mvp_raw_listings(pid).",
    "Keep pid primary key.",
    "Do not enable broad AI L2 in the same step.",
    "Do not change candidate-pool policy or public promotion.",
  ],
  stillBlockedAfterFk: [
    "Tiny-cap runtime escrow inclusion needs a separate feature-flagged patch.",
    "AI pass cannot remove parser hard blocks.",
    "Raw touch RPC batching remains held until source health recovers.",
  ],
};

const markdown = [
  "# AI L2 FK Owner Checklist",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_ddl_no_runtime_mutation",
  `- decision: ${decision}`,
  "",
  "## Source Reports",
  "",
  mdTable(
    ["report", "generatedAt"],
    [
      ["ai-l2-cache-fk-review", fkReview.generatedAt ?? "-"],
      ["ai-l2-tiny-escrow-candidates", tinyEscrow.generatedAt ?? "-"],
      ["lane-next-action-split", laneSplit.generatedAt ?? "-"],
    ],
  ),
  "",
  "## Checks",
  "",
  mdTable(
    ["check", "status", "evidence"],
    checks.map((item) => [item.name, item.status, item.evidence]),
  ),
  "",
  "## If Owner Approves Decision 1",
  "",
  ...output.approvedScopeIfOwnerSaysYes.map((item) => `- ${item}`),
  "",
  "## Still Blocked After FK",
  "",
  ...output.stillBlockedAfterFk.map((item) => `- ${item}`),
  "",
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(OUT_MD, markdown);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
console.log(`decision=${decision}`);
