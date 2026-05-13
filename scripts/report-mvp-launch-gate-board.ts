import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type PackQuality = {
  sourceHealth?: string;
  summary?: {
    sampled?: string;
    reveal?: string;
    activeReadyPool?: string;
  };
  packs?: { key?: string; requested?: number; returned?: number; refunded?: boolean }[];
};

type DbHotpaths = {
  generatedAt?: string;
  runs?: { total?: number; failed?: number; failureRate?: number; failureReasons?: Record<string, number> };
  latestSourceHealth?: { status?: string; reason?: string };
};

type LaneSplit = {
  generatedAt?: string;
  actionCounts?: Record<string, number>;
};

type AiFk = {
  decision?: string;
  counts?: { needsReviewMissingFromListings?: number; aiCacheMissingFromRaw?: number };
};

type MiningQueue = {
  groupCounts?: Record<string, number>;
};

type PackAtomicity = {
  betaStatus?: "pass" | "hold";
  paidMvpStatus?: "pass" | "hold";
  residualRisk?: string;
};

type PoolEligibilityMigration = {
  decision?: string;
  currentState?: {
    prodColumnExists?: boolean;
    proposedInternalRowsBlocked?: number;
    candidatePoolConflictRows?: number;
    keyMismatchRows?: number;
  };
};

type InternalAcquisitionPreflight = {
  metrics?: {
    lanes?: number;
    pass?: number;
    hold?: number;
    totalFutureWriteCap?: number;
  };
};

type Gate = {
  gate: string;
  status: "pass" | "hold" | "blocked";
  evidence: string;
  next: string;
};

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const OUT_JSON = path.join(REPORT_DIR, "mvp-launch-gate-board-latest.json");
const OUT_MD = path.join(REPORT_DIR, "mvp-launch-gate-board-latest.md");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function pct(value: number | undefined): string {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

const pack = readJson<PackQuality>(path.join(REPORT_DIR, "pack-open-quality-latest.json"), {});
const db = readJson<DbHotpaths>(path.join(REPORT_DIR, "db-hotpaths-latest.json"), {});
const lane = readJson<LaneSplit>(path.join(REPORT_DIR, "lane-next-action-split-latest.json"), {});
const fk = readJson<AiFk>(path.join(REPORT_DIR, "ai-l2-fk-owner-checklist-latest.json"), {});
const mining = readJson<MiningQueue>(path.join(REPORT_DIR, "mining-query-repair-queue-latest.json"), {});
const packAtomicity = readJson<PackAtomicity>(path.join(REPORT_DIR, "pack-open-atomicity-gap-latest.json"), {});
const poolEligibility = readJson<PoolEligibilityMigration>(path.join(REPORT_DIR, "pool-eligibility-migration-owner-packet-latest.json"), {});
const internalPreflight = readJson<InternalAcquisitionPreflight>(path.join(REPORT_DIR, "internal-acquisition-executor-preflight-latest.json"), {});

const packTotal = Number.parseInt(String(pack.summary?.sampled ?? "0"), 10);
const packReturned = Number.parseInt(String(pack.summary?.reveal ?? "0"), 10);
const gates: Gate[] = [
  {
    gate: "Operational source health",
    status: db.latestSourceHealth?.status === "healthy" ? "pass" : "hold",
    evidence: `${db.latestSourceHealth?.status ?? "unknown"} / ${db.latestSourceHealth?.reason ?? "-"} / failed=${db.runs?.failed ?? "?"}/${db.runs?.total ?? "?"} (${pct(db.runs?.failureRate)})`,
    next: "Keep observing. Do not apply raw-touch RPC/DDL while degraded.",
  },
  {
    gate: "Pack open surface",
    status: packTotal > 0 && packReturned === packTotal ? "pass" : "hold",
    evidence: `packReturned=${packReturned}/${packTotal}, activeReadyPool=${pack.summary?.activeReadyPool ?? "unknown"}, sourceHealth=${pack.sourceHealth ?? "-"}`,
    next: "Preserve 38/38 or 48/48 open quality before category expansion.",
  },
  {
    gate: "Pack open atomicity",
    status: packAtomicity.paidMvpStatus === "pass" ? "pass" : "hold",
    evidence: `beta=${packAtomicity.betaStatus ?? "unknown"}, paid=${packAtomicity.paidMvpStatus ?? "unknown"}`,
    next: "Before paid MVP, design a single RPC or reconciliation path for pack_open/reveals/pool commit atomicity.",
  },
  {
    gate: "Deterministic parser convergence",
    status: "pass",
    evidence: `stop=${lane.actionCounts?.stop_deterministic ?? 0}, ai_l2=${lane.actionCounts?.ai_l2_primary ?? 0}, mining=${lane.actionCounts?.mining_or_query_repair ?? 0}, owner=${lane.actionCounts?.owner_or_manual_review ?? 0}`,
    next: "Stop endless deterministic patching; route remaining ambiguity to AI L2 or query repair.",
  },
  {
    gate: "AI L2 FK decision",
    status: fk.decision === "owner_can_approve_fk_migration_only_low_traffic_window" ? "hold" : "blocked",
    evidence: `${fk.decision ?? "unknown"}, missingListings=${fk.counts?.needsReviewMissingFromListings ?? "?"}, cacheMissingRaw=${fk.counts?.aiCacheMissingFromRaw ?? "?"}`,
    next: "Requires explicit owner approval before DDL. FK only, no broad AI enablement.",
  },
  {
    gate: "Internal acquisition pool eligibility",
    status: poolEligibility.currentState?.prodColumnExists ? "pass" : "hold",
    evidence: `prodColumnExists=${poolEligibility.currentState?.prodColumnExists ?? "unknown"}, blockedRows=${poolEligibility.currentState?.proposedInternalRowsBlocked ?? "?"}, lanes=${internalPreflight.metrics?.lanes ?? "?"}, pass=${internalPreflight.metrics?.pass ?? "?"}, hold=${internalPreflight.metrics?.hold ?? "?"}, futureCap=${internalPreflight.metrics?.totalFutureWriteCap ?? "?"}`,
    next: "Requires explicit owner approval for pool_eligible/score_dirty migration before internal-only executor writes.",
  },
  {
    gate: "Mining/query repair queue",
    status: "hold",
    evidence: Object.entries(mining.groupCounts ?? {}).map(([key, value]) => `${key}=${value}`).join(", ") || "unknown",
    next: "Run report-only backfill/mining plans; no runtime promotion.",
  },
];

const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  gates,
  nextOwnerDecision:
    "Most direct acquisition unlock is pool_eligible/score_dirty migration; AI L2 FK migration is separate and should not be bundled with public promotion.",
};

const md = [
  "# MVP Launch Gate Board",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  "",
  "## Gates",
  "",
  mdTable(
    ["gate", "status", "evidence", "next"],
    gates.map((row) => [row.gate, row.status, row.evidence, row.next]),
  ),
  "",
  "## Next Owner Decision",
  "",
  `- ${output.nextOwnerDecision}`,
  "",
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(OUT_MD, md);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
