import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Checklist = {
  generatedAt?: string;
  decision?: string;
  hardHolds?: unknown[];
};

type TinyEscrow = {
  generatedAt?: string;
  counts?: {
    eligibleEscrowRows?: number;
    selectedTinyCapRows?: number;
    cap?: number;
  };
  categoryCounts?: { key: string; count: number }[];
  reasonCounts?: { key: string; count: number }[];
};

type Step = {
  order: number;
  phase: "blocked" | "implementation" | "verification";
  title: string;
  detail: string;
};

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const OUT_JSON = path.join(REPORT_DIR, "ai-l2-tiny-escrow-runtime-plan-latest.json");
const OUT_MD = path.join(REPORT_DIR, "ai-l2-tiny-escrow-runtime-plan-latest.md");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function readText(file: string): string {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

const checklist = readJson<Checklist>(path.join(REPORT_DIR, "ai-l2-fk-owner-checklist-latest.json"), {});
const tiny = readJson<TinyEscrow>(path.join(REPORT_DIR, "ai-l2-tiny-escrow-candidates-latest.json"), {});
const pipeline = readText(path.join(ROOT, "src/lib/pipeline.ts"));
const tickPipeline = readText(path.join(ROOT, "src/lib/tick-pipeline.ts"));
const aiPolicy = readText(path.join(ROOT, "src/lib/ai-l2-policy.ts"));
const poolPolicy = readText(path.join(ROOT, "src/lib/pool-policy.mjs"));

const hasAiCache = pipeline.includes("mvp_listing_ai_classifications");
const scoreStageSkipsNeedsReview = tickPipeline.includes("if (parsed?.needs_review === true)");
const hasPolicyGate = aiPolicy.includes("AI_L2_POLICY_ENABLED");
const hasPoolHardBlocks = [
  "option_needs_review",
  "parser_unknown_option",
  "generation_ambiguity",
  "connectivity_ambiguity",
  "bundle_or_accessory_ambiguity",
  "self_unlocked_ambiguity",
].every((flag) => poolPolicy.includes(flag));
const fkReady = checklist.decision === "owner_can_approve_fk_migration_only_low_traffic_window"
  && (checklist.hardHolds?.length ?? 0) === 0;
const generatedAt = new Date().toISOString();

const steps: Step[] = [
  {
    order: 1,
    phase: "blocked",
    title: "Apply FK migration only after owner approval",
    detail: "Move mvp_listing_ai_classifications.pid FK target to mvp_raw_listings(pid), keep pid primary key, and do not enable runtime escrow in the same change.",
  },
  {
    order: 2,
    phase: "implementation",
    title: "Add disabled-by-default escrow feature flag",
    detail: "Use a separate env flag such as AI_L2_ESCROW_NEEDS_REVIEW_ENABLED=1 and cap such as AI_L2_ESCROW_NEEDS_REVIEW_CAP=25. Default must be off.",
  },
  {
    order: 3,
    phase: "implementation",
    title: "Reuse tiny escrow eligibility predicate",
    detail: "Runtime should mirror report-ai-l2-tiny-escrow-candidates: detail_status=done, listing_type=normal, active row, sku_id present, category known, comparable_key present, needs_review=true.",
  },
  {
    order: 4,
    phase: "implementation",
    title: "Do not let AI rescue pool hard blocks",
    detail: "AI result may add review metadata/cache only. Candidate pool must still block option_needs_review/parser_unknown_option and related flags.",
  },
  {
    order: 5,
    phase: "implementation",
    title: "Do not write parser fields from AI",
    detail: "No parser write-back in the first runtime patch. AI can classify ambiguity, but comparable_key/needs_review remain parser-owned.",
  },
  {
    order: 6,
    phase: "verification",
    title: "Observe counters before widening",
    detail: "Track aiReviewRequested, aiApiCalls, aiCacheHits, aiFiltered, aiKeptNormal, source health, and pack open. Widen only after pack open remains stable.",
  },
];

const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  ddlApplied: false,
  currentState: {
    fkReadyForOwnerApproval: fkReady,
    tinyEscrowRows: tiny.counts ?? null,
    tinyEscrowCategories: tiny.categoryCounts ?? [],
    tinyEscrowReasons: tiny.reasonCounts ?? [],
    codeGuards: {
      hasAiCache,
      scoreStageSkipsNeedsReview,
      hasPolicyGate,
      hasPoolHardBlocks,
    },
  },
  decision: fkReady ? "runtime_plan_ready_but_blocked_on_fk_owner_approval" : "hold_runtime_plan_until_fk_checklist_passes",
  steps,
};

const md = [
  "# AI L2 Tiny Escrow Runtime Plan",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_runtime_mutation_no_ddl",
  `- decision: ${output.decision}`,
  "",
  "## Current State",
  "",
  mdTable(
    ["item", "value"],
    [
      ["fkReadyForOwnerApproval", String(output.currentState.fkReadyForOwnerApproval)],
      ["eligibleEscrowRows", String(tiny.counts?.eligibleEscrowRows ?? "-")],
      ["selectedTinyCapRows", String(tiny.counts?.selectedTinyCapRows ?? "-")],
      ["cap", String(tiny.counts?.cap ?? "-")],
      ["hasAiCache", String(hasAiCache)],
      ["scoreStageSkipsNeedsReview", String(scoreStageSkipsNeedsReview)],
      ["hasPolicyGate", String(hasPolicyGate)],
      ["hasPoolHardBlocks", String(hasPoolHardBlocks)],
    ],
  ),
  "",
  "## Implementation Sequence",
  "",
  mdTable(
    ["order", "phase", "title", "detail"],
    steps.map((step) => [String(step.order), step.phase, step.title, step.detail]),
  ),
  "",
  "## Non-Negotiables",
  "",
  "- No broad AI L2 enablement in the FK migration step.",
  "- No candidate-pool release from AI pass alone.",
  "- No parser write-back from AI in the first patch.",
  "- No raw touch RPC/DDL while source health is degraded.",
  "",
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(OUT_MD, md);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
console.log(`decision=${output.decision}`);
