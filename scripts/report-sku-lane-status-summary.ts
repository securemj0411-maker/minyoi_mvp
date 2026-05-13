import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Status =
  | "public_active"
  | "public_ready"
  | "internal_owner_review_ready"
  | "internal_apply_clean"
  | "internal_apply_blocked"
  | "internal_learning"
  | "needs_ai_l2"
  | "needs_more_mining"
  | "blocked_policy_decision"
  | "blocked_market_noise";

type SummaryRow = {
  lane: string;
  status: Status;
  rowCount: number | null;
  evidence?: string;
  sourceStages: string[];
  note: string;
};

type ConvergenceLane = {
  lane: string;
  status: string;
  sampleTotal?: number;
  detailFetched?: number;
  detailActiveClean?: number;
  detailSold?: number;
  detailProshop?: number;
  statusReason?: string;
  expansionStage?: string;
  publicReady?: string;
};

type ConvergenceMap = {
  generatedAt?: string;
  categories?: { category: string; lanes: ConvergenceLane[] }[];
};

type ExpansionPlan = {
  generatedAt?: string;
  rows?: { lane: string; stage: string; reason?: string; next?: string }[];
};

type TinyPacket = {
  generatedAt?: string;
  approvedCandidates?: {
    lane: string;
    fetched?: number;
    activeClean?: number;
    reviewRows?: number;
    readiness?: string;
    blocker?: string;
  }[];
};

type DryRun = {
  generatedAt?: string;
  rows?: {
    lane: string;
    validationErrors?: string[];
  }[];
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readLaneReadinessKeys(): string[] {
  const filePath = path.join(root, "src/lib/category-readiness.ts");
  const src = readFileSync(filePath, "utf8");
  const body = src.match(/export const LANE_READINESS:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1] ?? "";
  return [...body.matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\{/gm)].map((m) => m[1]);
}

function toStatusFromConvergence(status: string): Status | null {
  if (status === "owner_review_ready") return "internal_owner_review_ready";
  if (status === "needs_ai_l2") return "needs_ai_l2";
  if (status === "needs_more_mining") return "needs_more_mining";
  if (status === "blocked_policy_decision") return "blocked_policy_decision";
  if (status === "blocked_market_noise") return "blocked_market_noise";
  return null;
}

function toStatusFromExpansion(stage: string): Status | null {
  if (stage === "owner_review_ready") return "internal_owner_review_ready";
  if (stage === "internal_learning") return "internal_learning";
  if (stage === "internal_candidate") return "internal_learning";
  if (stage === "ai_l2_escrow") return "needs_ai_l2";
  if (stage === "collect_only") return "needs_more_mining";
  return null;
}

const statusPriority: Status[] = [
  "public_active",
  "internal_apply_clean",
  "internal_apply_blocked",
  "internal_owner_review_ready",
  "internal_learning",
  "needs_ai_l2",
  "needs_more_mining",
  "blocked_policy_decision",
  "blocked_market_noise",
  "public_ready",
];

function preferStatus(current: Status | undefined, next: Status): Status {
  if (!current) return next;
  return statusPriority.indexOf(next) < statusPriority.indexOf(current) ? next : current;
}

async function main() {
const rows = new Map<string, SummaryRow>();

function upsert(lane: string, status: Status, rowCount: number | null, source: string, note: string, evidence?: string) {
  const previous = rows.get(lane);
  const finalStatus = preferStatus(previous?.status, status);
  const sourceStages = [...(previous?.sourceStages ?? []), `${source}:${status}`];
  const nextWins = finalStatus === status;
  rows.set(lane, {
    lane,
    status: finalStatus,
    rowCount: nextWins ? rowCount : (previous?.rowCount ?? rowCount),
    evidence: nextWins ? evidence : (previous?.evidence ?? evidence),
    sourceStages,
    note: nextWins ? note : (previous?.note ?? note),
  });
}

const convergence = readJson<ConvergenceMap>("category-convergence-map-latest.json", {});
for (const category of convergence.categories ?? []) {
  for (const lane of category.lanes) {
    const status = toStatusFromConvergence(lane.status);
    if (!status) continue;
    const count = lane.detailFetched && lane.detailFetched > 0 ? lane.detailActiveClean ?? lane.detailFetched : lane.sampleTotal ?? null;
    const evidence = `category-convergence-map:${category.category}`;
    const note = `${lane.statusReason ?? lane.status}; activeClean=${lane.detailActiveClean ?? 0}/${lane.detailFetched ?? 0}`;
    upsert(lane.lane, status, count, evidence, note, evidence);
  }
}

const expansion = readJson<ExpansionPlan>("internal-acquisition-expansion-plan-latest.json", {});
for (const lane of expansion.rows ?? []) {
  const status = toStatusFromExpansion(lane.stage);
  if (!status) continue;
  upsert(lane.lane, status, null, "internal-acquisition-expansion-plan", lane.reason ?? lane.stage, "internal-acquisition-expansion-plan-latest.json");
}

const tiny = readJson<TinyPacket>("tiny-acquisition-owner-packet-latest.json", {});
for (const lane of tiny.approvedCandidates ?? []) {
  if (lane.readiness === "live_reveal_verified") {
    upsert(
      lane.lane,
      "public_active",
      lane.activeClean ?? lane.fetched ?? null,
      "tiny-acquisition-owner-packet",
      `live_reveal_verified activeClean=${lane.activeClean ?? 0}/${lane.fetched ?? 0}`,
      "tiny-acquisition-owner-packet-latest.json",
    );
  } else {
    upsert(
      lane.lane,
      "internal_owner_review_ready",
      lane.activeClean ?? lane.fetched ?? null,
      "tiny-acquisition-owner-packet",
      `${lane.readiness ?? "owner_candidate"} activeClean=${lane.activeClean ?? 0}/${lane.fetched ?? 0}`,
      "tiny-acquisition-owner-packet-latest.json",
    );
  }
}

const dryRun = readJson<DryRun>("wave52-acquisition-dryrun-cap39-latest.json", {});
const dryRunCounts = new Map<string, { clean: number; blocked: number }>();
for (const row of dryRun.rows ?? []) {
  const current = dryRunCounts.get(row.lane) ?? { clean: 0, blocked: 0 };
  if ((row.validationErrors ?? []).length > 0) current.blocked += 1;
  else current.clean += 1;
  dryRunCounts.set(row.lane, current);
}
for (const [lane, count] of dryRunCounts) {
  if (count.blocked > 0) {
    upsert(lane, "internal_apply_blocked", count.blocked, "wave52-dryrun", `dry-run failed rows=${count.blocked}`, "wave52-acquisition-dryrun-cap39-latest.json");
  } else {
    upsert(lane, "internal_apply_clean", count.clean, "wave52-dryrun", `dry-run clean rows=${count.clean}`, "wave52-acquisition-dryrun-cap39-latest.json");
  }
}

for (const lane of readLaneReadinessKeys()) {
  if (!rows.has(lane)) {
    upsert(lane, "public_ready", null, "src/lib/category-readiness.ts", "runtime LANE_READINESS ready config exists, but no fresher operational board row was found", "src/lib/category-readiness.ts");
  }
}

const grouped: Record<Status, SummaryRow[]> = {
  public_ready: [],
  public_active: [],
  internal_owner_review_ready: [],
  internal_apply_clean: [],
  internal_apply_blocked: [],
  internal_learning: [],
  needs_ai_l2: [],
  needs_more_mining: [],
  blocked_policy_decision: [],
  blocked_market_noise: [],
};

for (const row of [...rows.values()].sort((a, b) => a.lane.localeCompare(b.lane))) {
  grouped[row.status].push(row);
}

const output = {
  generatedAt: new Date().toISOString(),
  scope: "sku_lane_status_summary",
  reportOnly: true,
  runtimeMutation: false,
  supabaseMutation: false,
  publicPromotion: false,
  candidatePoolPatch: false,
  sourceReports: {
    convergenceMap: convergence.generatedAt ?? null,
    expansionPlan: expansion.generatedAt ?? null,
    tinyPacket: tiny.generatedAt ?? null,
    wave52DryRun: dryRun.generatedAt ?? null,
  },
  definitions: {
    public_active: "live/reveal verified SKU-lane from latest owner packet; treated as already user-facing/live lane evidence.",
    public_ready: "runtime LANE_READINESS ready config exists, but no fresher public_active/internal/blocked board row overrode it. This is config-ready, not proof of live inventory.",
    internal_owner_review_ready: "no-write/detail-verified owner review candidate; can become capped internal acquisition only after explicit owner apply approval.",
    internal_apply_clean: "Wave52 dry-run clean subset; eligible for next internal acquisition apply wave if owner approves.",
    internal_apply_blocked: "Wave52 dry-run failed subset; root cause must be fixed before apply.",
    internal_learning: "collected/monitored lane; not acquisition-ready.",
    needs_ai_l2: "deterministic L1 should stop; ambiguity belongs to AI L2/manual after separate approval.",
    needs_more_mining: "query/sample/lane scope needs repair before runtime or acquisition.",
    blocked_policy_decision: "owner policy or product-bundle semantics unresolved.",
    blocked_market_noise: "live market/detail evidence too noisy for acquisition.",
  },
  counts: Object.fromEntries(Object.entries(grouped).map(([status, lanes]) => [status, lanes.length])),
  groups: grouped,
};

await mkdir(reportDir, { recursive: true });
await writeFile(path.join(reportDir, "sku-lane-status-summary-latest.json"), `${JSON.stringify(output, null, 2)}\n`);

const md: string[] = [];
md.push("# SKU/Lane Status Summary");
md.push("");
md.push(`- generatedAt: ${output.generatedAt}`);
md.push("- mode: report_only_no_write");
md.push("- runtimeMutation / supabaseMutation / publicPromotion / candidatePool: false / false / false / false");
md.push("");
md.push("## Counts");
md.push("");
md.push("| status | lane count |");
md.push("| --- | ---: |");
for (const status of Object.keys(grouped) as Status[]) {
  md.push(`| ${status} | ${grouped[status].length} |`);
}
md.push("");
md.push("## Notes");
md.push("");
md.push("- `public_ready` here means runtime config-ready only. It does not mean fresh/live inventory has passed pack-public verification.");
md.push("- `internal_apply_clean` and `internal_apply_blocked` are based on the latest Wave52 cap39 dry-run.");
md.push("- Buckets are primary-status buckets; each lane appears once, using the most operationally advanced/current status available from the source reports.");
md.push("");

for (const status of Object.keys(grouped) as Status[]) {
  md.push(`## ${status} (${grouped[status].length})`);
  md.push("");
  if (grouped[status].length === 0) {
    md.push("- none");
    md.push("");
    continue;
  }
  md.push("| lane/SKU | row count | note | source |");
  md.push("| --- | ---: | --- | --- |");
  for (const row of grouped[status]) {
    md.push(`| ${row.lane} | ${row.rowCount ?? "—"} | ${row.note.replaceAll("|", "/")} | ${row.evidence ?? row.sourceStages.at(-1) ?? "—"} |`);
  }
  md.push("");
}

await writeFile(path.join(reportDir, "sku-lane-status-summary-latest.md"), `${md.join("\n")}\n`);

console.log(`Wrote reports/sku-lane-status-summary-latest.{json,md}`);
console.log(output.counts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
