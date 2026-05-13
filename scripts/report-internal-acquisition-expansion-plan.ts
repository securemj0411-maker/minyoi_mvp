import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type FrontierLane = {
  lane: string;
  fetched: number;
  activeClean: number;
  reviewRows: number;
  readiness: string;
  next: string;
  blocker: string;
  evidence: string;
  bucket: string;
};

type Frontier = {
  metrics?: {
    lanes: number;
    ownerReviewReady: number;
    secondWaveCandidates: number;
    aiL2OrManual: number;
    hold: number;
  };
  buckets?: Record<string, FrontierLane[]>;
};

type LaneAction = {
  lane: string;
  action: string;
  actionReason: string;
  grade: string;
  skuMatchPct: string;
  comparableKeyCompletePct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  routingDecision?: string;
  aiL2Reason?: string | null;
};

type LaneSplit = {
  actionCounts?: Record<string, number>;
  rows?: LaneAction[];
};

type Stage =
  | "collect_only"
  | "internal_learning"
  | "internal_candidate"
  | "ai_l2_escrow"
  | "owner_review_ready"
  | "public_ready_blocked";

type PlanRow = {
  lane: string;
  stage: Stage;
  reason: string;
  next: string;
  evidence: string[];
  writeAllowedNow: false;
  publicAllowedNow: false;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function rowFromFrontier(lane: FrontierLane): PlanRow {
  if (lane.bucket === "owner_review_ready") {
    return {
      lane: lane.lane,
      stage: "owner_review_ready",
      reason: `detail verified no-write lane with ${lane.activeClean}/${lane.fetched} active clean rows`,
      next: "Owner approval can turn this into capped internal-only acquisition. Public/candidate-pool release remains blocked.",
      evidence: [lane.evidence],
      writeAllowedNow: false,
      publicAllowedNow: false,
    };
  }
  if (lane.bucket === "ai_l2_or_manual") {
    return {
      lane: lane.lane,
      stage: "ai_l2_escrow",
      reason: lane.readiness,
      next: "Stop deterministic broadening. Use AI L2/manual review for residual ambiguity after FK/cache approval.",
      evidence: [lane.evidence],
      writeAllowedNow: false,
      publicAllowedNow: false,
    };
  }
  return {
    lane: lane.lane,
    stage: lane.activeClean > 0 ? "internal_learning" : "collect_only",
    reason: lane.readiness,
    next: lane.next,
    evidence: [lane.evidence],
    writeAllowedNow: false,
    publicAllowedNow: false,
  };
}

function rowFromLaneAction(lane: LaneAction, existing: Set<string>): PlanRow | null {
  if (existing.has(lane.lane)) return null;

  if (lane.action === "stop_deterministic") {
    return {
      lane: lane.lane,
      stage: "internal_learning",
      reason: `deterministic L1 is mature enough for learning/watch, but not an acquisition write packet (${lane.grade}, complete ${lane.comparableKeyCompletePct}%)`,
      next: "Keep collecting and watch leaks. Do not public-promote without no-write detail verification.",
      evidence: ["reports/lane-next-action-split-latest.md"],
      writeAllowedNow: false,
      publicAllowedNow: false,
    };
  }
  if (lane.action === "ai_l2_primary") {
    return {
      lane: lane.lane,
      stage: "ai_l2_escrow",
      reason: `${lane.aiL2Reason ?? lane.actionReason}; complete ${lane.comparableKeyCompletePct}%, needsReviewFalse ${lane.needsReviewFalsePct}%`,
      next: "Route to tiny AI L2 escrow after FK/cache approval. Do not weaken deterministic rules to chase recall.",
      evidence: ["reports/lane-next-action-split-latest.md"],
      writeAllowedNow: false,
      publicAllowedNow: false,
    };
  }
  if (lane.action === "mining_or_query_repair") {
    return {
      lane: lane.lane,
      stage: "collect_only",
      reason: lane.actionReason,
      next: "Repair query/mining scope first, then replay. Runtime patch is not the next step.",
      evidence: ["reports/lane-next-action-split-latest.md"],
      writeAllowedNow: false,
      publicAllowedNow: false,
    };
  }
  if (lane.action === "owner_or_manual_review") {
    return {
      lane: lane.lane,
      stage: "internal_learning",
      reason: lane.actionReason,
      next: "Needs owner policy/manual review before internal acquisition.",
      evidence: ["reports/lane-next-action-split-latest.md"],
      writeAllowedNow: false,
      publicAllowedNow: false,
    };
  }
  return null;
}

function stageRank(stage: Stage) {
  return {
    owner_review_ready: 0,
    internal_candidate: 1,
    ai_l2_escrow: 2,
    internal_learning: 3,
    collect_only: 4,
    public_ready_blocked: 5,
  }[stage];
}

function stageCounts(rows: PlanRow[]) {
  return rows.reduce<Record<Stage, number>>(
    (acc, row) => {
      acc[row.stage] += 1;
      return acc;
    },
    {
      collect_only: 0,
      internal_learning: 0,
      internal_candidate: 0,
      ai_l2_escrow: 0,
      owner_review_ready: 0,
      public_ready_blocked: 0,
    },
  );
}

function mdTable(rows: PlanRow[]) {
  return [
    "| lane | stage | reason | next |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.lane} | ${row.stage} | ${row.reason} | ${row.next} |`),
  ].join("\n");
}

async function main() {
  const frontier = readJson<Frontier>("exact-acquisition-frontier-latest.json", {});
  const laneSplit = readJson<LaneSplit>("lane-next-action-split-latest.json", {});

  const rows: PlanRow[] = [];
  const existing = new Set<string>();
  for (const lane of Object.values(frontier.buckets ?? {}).flat()) {
    const row = rowFromFrontier(lane);
    rows.push(row);
    existing.add(row.lane);
  }
  for (const lane of laneSplit.rows ?? []) {
    const row = rowFromLaneAction(lane, existing);
    if (row) rows.push(row);
  }

  rows.sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.lane.localeCompare(b.lane));

  const output = {
    generatedAt: new Date().toISOString(),
    scope: "internal_acquisition_expansion_plan",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    principle:
      "Collect and learn broadly, acquire internally only through capped owner-approved lanes, and public-promote only after separate live/fresh/pack verification.",
    deterministicCeiling:
      "No fixed 80% cutoff. Keep deterministic patches while they preserve meaning and provide material lift; stop when gains flatten or require semantic guessing, then route to AI L2/manual.",
    stageCounts: stageCounts(rows),
    rows,
    currentSafeExpansion: rows
      .filter((row) => row.stage === "owner_review_ready")
      .map((row) => row.lane),
    nextDecisions: [
      "Approve or reject internal-only tiny acquisition executor for owner_review_ready lanes.",
      "Keep public/candidate-pool release blocked until separate pack/live verification.",
      "Do not remove internal_only globally; replace it with lane-level stages.",
      "Prepare AI L2 tiny escrow only after FK/cache owner decision.",
    ],
  };

  const byStage = rows.reduce<Record<string, PlanRow[]>>((acc, row) => {
    acc[row.stage] ??= [];
    acc[row.stage].push(row);
    return acc;
  }, {});

  const md = [
    "# Internal Acquisition Expansion Plan",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- principle: ${output.principle}`,
    `- deterministicCeiling: ${output.deterministicCeiling}`,
    "",
    "## Stage Counts",
    "",
    "| stage | count |",
    "| --- | ---: |",
    ...Object.entries(output.stageCounts).map(([stage, count]) => `| ${stage} | ${count} |`),
    "",
    "## Current Safe Expansion",
    "",
    output.currentSafeExpansion.length > 0
      ? output.currentSafeExpansion.map((lane) => `- ${lane}`).join("\n")
      : "- none",
    "",
    "## Stage Detail",
    "",
    ...(["owner_review_ready", "ai_l2_escrow", "internal_learning", "collect_only"] as Stage[]).flatMap((stage) => [
      `### ${stage}`,
      "",
      mdTable(byStage[stage] ?? []),
      "",
    ]),
    "## Next Decisions",
    "",
    ...output.nextDecisions.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, "internal-acquisition-expansion-plan-latest.json"),
    `${JSON.stringify(output, null, 2)}\n`,
  );
  await writeFile(path.join(reportDir, "internal-acquisition-expansion-plan-latest.md"), md);
  console.log("wrote reports/internal-acquisition-expansion-plan-latest.json");
  console.log("wrote reports/internal-acquisition-expansion-plan-latest.md");
  console.log(JSON.stringify({ rows: rows.length, stageCounts: output.stageCounts }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
