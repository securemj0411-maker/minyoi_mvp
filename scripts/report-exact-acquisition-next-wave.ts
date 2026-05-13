import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type MonitorReport = {
  exactLaneCandidates?: { code: string; brand: string; model: string; note: string }[];
  nextStepDecision?: string;
  currentState?: { exactBackfillRows?: number; manualRows?: number; holdRows?: number };
};

type LgGramReport = {
  decision?: { nextStep?: string } | string;
  proposedQueryVariants?: { query: string; rationale: string }[];
  metrics?: {
    totalFetched?: number;
    parseReadyCount?: number;
    rejectedCount?: number;
    strict2024CleanRowsInExistingSamples?: number;
  };
};

type BeatsReport = {
  priceTooHighDecision?: string | { classification?: string };
  queueSplit?: Record<string, number>;
};

type IpadReport = {
  nextStep?: { decision?: string };
  proposedQueryGroups?: { queries?: string[] }[];
};

type IphoneReport = {
  byLane?: {
    lane: string;
    total?: number;
    explicitSelfUnlocked?: number;
    cleanExplicitSelfUnlocked?: number;
    decision?: string;
  }[];
  totals?: Record<string, number>;
  decision?: { deterministicRecall?: string };
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const monitor = readJson<MonitorReport>(path.join(reportDir, "monitor-exact-model-code-backfill-readiness-latest.json"), {});
const lgGram = readJson<LgGramReport>(path.join(reportDir, "lg-gram-17-2024-query-precision-repair-latest.json"), {});
const beats = readJson<BeatsReport>(path.join(reportDir, "beats-solo4-backfill-queue-split-latest.json"), {});
const ipad = readJson<IpadReport>(path.join(reportDir, "ipad-pro-13-m2-exact-mining-plan-latest.json"), {});
const iphone = readJson<IphoneReport>(path.join(reportDir, "iphone-self-unlocked-ai-l2-eval-packet-latest.json"), {});

const tasks = [
  {
    id: "monitor_exact_model_code_wave1",
    category: "monitor",
    mode: "exact_lane_backfill",
    status: "ready_for_report_only_acquisition",
    scope: (monitor.exactLaneCandidates ?? []).map((row) => row.code),
    evidence: `exactBackfillRows=${monitor.currentState?.exactBackfillRows ?? "?"}, manual=${monitor.currentState?.manualRows ?? "?"}, hold=${monitor.currentState?.holdRows ?? "?"}`,
    forbidden: "No broad monitor_discovered runtime promotion.",
  },
  {
    id: "lg_gram_17_2024_query_repair_wave1",
    category: "laptop",
    mode: "query_precision_repair",
    status: "ready_for_no_write_query_sample",
    scope: (lgGram.proposedQueryVariants ?? []).map((row) => row.query),
    evidence: `total=${lgGram.metrics?.totalFetched ?? "?"}, parseReady=${lgGram.metrics?.parseReadyCount ?? "?"}, rejected=${lgGram.metrics?.rejectedCount ?? "?"}, strictClean=${lgGram.metrics?.strict2024CleanRowsInExistingSamples ?? "?"}`,
    forbidden: "No weak year/generation fallback; do not broaden laptop parser.",
  },
  {
    id: "ipad_pro_13_m2_exact_wifi_wave1",
    category: "tablet",
    mode: "structured_more_mining",
    status: "ready_for_no_write_query_sample",
    scope: (ipad.proposedQueryGroups ?? []).flatMap((group) => group.queries ?? []),
    evidence: `decision=${ipad.nextStep?.decision ?? "unknown"}`,
    forbidden: "Do not infer Wi-Fi from silence.",
  },
  {
    id: "beats_solo4_backfill_wave1",
    category: "headphone",
    mode: "exact_lane_backfill",
    status: "ready_for_leak_watch_backfill",
    scope: ["detail_confirmed_clean", "search_scope_clean_requires_detail_gate", "hold_leak_rows"],
    evidence: `priceTooHigh=${typeof beats.priceTooHighDecision === "string" ? beats.priceTooHighDecision : beats.priceTooHighDecision?.classification ?? "unknown"}, queue=${JSON.stringify(beats.queueSplit ?? {})}`,
    forbidden: "No parser/catalog patch for recall; price_too_high is policy/backfill, not parser.",
  },
  {
    id: "iphone_12_13_pro_self_unlocked_ai_eval",
    category: "smartphone",
    mode: "ai_l2_eval_only",
    status: "ready_for_eval_packet",
    scope: (iphone.byLane ?? []).map((row) => row.lane),
    evidence: (iphone.byLane ?? [])
      .map((row) => `${row.lane}: total=${row.total ?? "?"}, explicit=${row.explicitSelfUnlocked ?? "?"}, cleanExplicit=${row.cleanExplicitSelfUnlocked ?? "?"}`)
      .join("; "),
    forbidden: "Do not treat silent carrier state as self-unlocked.",
  },
];

const output = {
  generatedAt: new Date().toISOString(),
  mode: "report_only_no_runtime_mutation",
  tasks,
  summary: {
    totalTasks: tasks.length,
    noWriteAcquisitionTasks: tasks.filter((task) => task.status.includes("no_write")).length,
    runtimeMutationTasks: 0,
    publicPromotionTasks: 0,
  },
  next:
    "Run no-write acquisition/sample runners for monitor exact codes, LG Gram exact queries, and iPad Pro M2 exact Wi-Fi queries. Keep iPhone as AI L2 eval packet and Beats as leak-watch backfill.",
};

function table(headers: string[], rows: string[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

const md = [
  "# Exact Acquisition Next Wave",
  "",
  `- generatedAt: ${output.generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  "",
  "## Summary",
  "",
  `- totalTasks: ${output.summary.totalTasks}`,
  `- runtimeMutationTasks: ${output.summary.runtimeMutationTasks}`,
  `- publicPromotionTasks: ${output.summary.publicPromotionTasks}`,
  "",
  "## Tasks",
  "",
  table(
    ["id", "category", "mode", "status", "scope", "evidence", "forbidden"],
    tasks.map((task) => [
      task.id,
      task.category,
      task.mode,
      task.status,
      task.scope.slice(0, 10).join("<br>") || "-",
      task.evidence || "-",
      task.forbidden,
    ]),
  ),
  "",
  "## Next",
  "",
  `- ${output.next}`,
  "",
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(path.join(reportDir, "exact-acquisition-next-wave-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(path.join(reportDir, "exact-acquisition-next-wave-latest.md"), md);

console.log("wrote reports/exact-acquisition-next-wave-latest.json");
console.log("wrote reports/exact-acquisition-next-wave-latest.md");
console.log(JSON.stringify(output.summary));
