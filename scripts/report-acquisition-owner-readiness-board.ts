import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type Checklist = {
  category: string;
  target: string;
  metrics: {
    passChecks: number;
    warningChecks?: number;
    failedChecks: number;
    allowedRows: number;
    maxFutureWriteCap: number;
  };
  conclusion: string;
  nextStep: string;
};

type HeadphoneContract = {
  category: string;
  allowedSkus: string[];
  metrics: {
    allowedRows: number;
    allowedSkus: number;
    maxFutureWriteCap: number;
  };
  conclusion: string;
  requiredGateBeforeAnyFutureWrite: string[];
};

type RankingReport = {
  entries: Array<{
    category: string;
    firstTarget: string;
    score: number;
    rankGroup: string;
    reason: string;
  }>;
};

type ExactAcquisitionBoard = {
  lanes?: Array<{
    lane: string;
    activeClean: number;
    reviewRows: number;
    readiness: string;
    next: string;
    blocker: string;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function statusFromChecklist(checklist: Checklist) {
  if (checklist.metrics.failedChecks > 0) return "blocked";
  if ((checklist.metrics.warningChecks ?? 0) > 0) return "owner_review_with_warning";
  return "owner_review_ready";
}

function applyLatestDetailGate<T extends {
  category: string;
  target: string;
  status: string;
  allowedRows: number;
  maxFutureWriteCap: number;
  failedChecks: number;
  nextStep: string;
}>(entry: T, exactBoard: ExactAcquisitionBoard): T {
  const laneKey =
    entry.category === "game_console_body_narrow" && entry.target.includes("playstation-5")
      ? "ps5_disc_digital_standard"
      : null;
  if (!laneKey) return entry;

  const latest = exactBoard.lanes?.find((lane) => lane.lane === laneKey);
  if (!latest || latest.readiness.startsWith("owner_review")) return entry;

  return {
    ...entry,
    status: "blocked_latest_detail",
    allowedRows: latest.activeClean,
    maxFutureWriteCap: Math.min(entry.maxFutureWriteCap, latest.activeClean),
    failedChecks: Math.max(entry.failedChecks, 1),
    nextStep: `${latest.next} Latest detail gate overrides older checklist: ${latest.blocker}`,
  };
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const ranking = await readJson<RankingReport>("next-acquisition-readiness-ranking-latest.json");
  const exactBoard = await readJson<ExactAcquisitionBoard>("exact-acquisition-readiness-board-latest.json");
  const monitor = await readJson<Checklist>("monitor-xl2540k-execution-readiness-checklist-latest.json");
  const headphone = await readJson<Checklist>("headphone-sony-first-wave-execution-readiness-checklist-latest.json");
  const speaker = await readJson<Checklist>("speaker-jbl-flip6-execution-readiness-checklist-latest.json");
  const ps5 = await readJson<Checklist>("game-console-ps5-execution-readiness-checklist-latest.json");
  const tablet = await readJson<Checklist>("tablet-ipad-pro-m4-execution-readiness-checklist-latest.json");
  const camera = await readJson<Checklist>("camera-sony-a7m3-execution-readiness-checklist-latest.json");
  const headphoneContract = await readJson<HeadphoneContract>("headphone-first-wave-strict-write-cap-contract-latest.json");

  const entries = [
    {
      category: monitor.category,
      target: monitor.target,
      source: "monitor-xl2540k-execution-readiness-checklist-latest.json",
      status: statusFromChecklist(monitor),
      allowedRows: monitor.metrics.allowedRows,
      maxFutureWriteCap: monitor.metrics.maxFutureWriteCap,
      passChecks: monitor.metrics.passChecks,
      warningChecks: monitor.metrics.warningChecks ?? 0,
      failedChecks: monitor.metrics.failedChecks,
      score: ranking.entries.find((entry) => entry.firstTarget === monitor.target)?.score ?? null,
      nextStep: monitor.nextStep,
    },
    {
      category: headphone.category,
      target: headphone.target,
      source: "headphone-sony-first-wave-execution-readiness-checklist-latest.json",
      status: statusFromChecklist(headphone),
      allowedRows: headphone.metrics.allowedRows,
      maxFutureWriteCap: headphone.metrics.maxFutureWriteCap,
      passChecks: headphone.metrics.passChecks,
      warningChecks: headphone.metrics.warningChecks ?? 0,
      failedChecks: headphone.metrics.failedChecks,
      score: ranking.entries.find((entry) => entry.category === headphone.category)?.score ?? null,
      nextStep: `${headphone.nextStep} Allowed SKUs: ${headphoneContract.allowedSkus.join(", ")}.`,
    },
    {
      category: speaker.category,
      target: speaker.target,
      source: "speaker-jbl-flip6-execution-readiness-checklist-latest.json",
      status: statusFromChecklist(speaker),
      allowedRows: speaker.metrics.allowedRows,
      maxFutureWriteCap: speaker.metrics.maxFutureWriteCap,
      passChecks: speaker.metrics.passChecks,
      warningChecks: speaker.metrics.warningChecks ?? 0,
      failedChecks: speaker.metrics.failedChecks,
      score: ranking.entries.find((entry) => entry.firstTarget === speaker.target)?.score ?? null,
      nextStep: speaker.nextStep,
    },
    applyLatestDetailGate({
      category: ps5.category,
      target: ps5.target,
      source: "game-console-ps5-execution-readiness-checklist-latest.json",
      status: statusFromChecklist(ps5),
      allowedRows: ps5.metrics.allowedRows,
      maxFutureWriteCap: ps5.metrics.maxFutureWriteCap,
      passChecks: ps5.metrics.passChecks,
      warningChecks: ps5.metrics.warningChecks ?? 0,
      failedChecks: ps5.metrics.failedChecks,
      score: ranking.entries.find((entry) => entry.category === ps5.category)?.score ?? null,
      nextStep: ps5.nextStep,
    }, exactBoard),
    {
      category: tablet.category,
      target: tablet.target,
      source: "tablet-ipad-pro-m4-execution-readiness-checklist-latest.json",
      status: statusFromChecklist(tablet),
      allowedRows: tablet.metrics.allowedRows,
      maxFutureWriteCap: tablet.metrics.maxFutureWriteCap,
      passChecks: tablet.metrics.passChecks,
      warningChecks: tablet.metrics.warningChecks ?? 0,
      failedChecks: tablet.metrics.failedChecks,
      score: ranking.entries.find((entry) => entry.category === tablet.category)?.score ?? null,
      nextStep: tablet.nextStep,
    },
    {
      category: camera.category,
      target: camera.target,
      source: "camera-sony-a7m3-execution-readiness-checklist-latest.json",
      status: statusFromChecklist(camera),
      allowedRows: camera.metrics.allowedRows,
      maxFutureWriteCap: camera.metrics.maxFutureWriteCap,
      passChecks: camera.metrics.passChecks,
      warningChecks: camera.metrics.warningChecks ?? 0,
      failedChecks: camera.metrics.failedChecks,
      score: ranking.entries.find((entry) => entry.firstTarget === camera.target)?.score ?? null,
      nextStep: camera.nextStep,
    },
  ];
  const sortedEntries = [...entries].sort((left, right) => {
    const statusScore = (status: string) => {
      if (status === "owner_review_ready") return 4;
      if (status === "owner_review_with_warning") return 2;
      return 1;
    };
    return statusScore(right.status) - statusScore(left.status) || (right.score ?? 0) - (left.score ?? 0);
  });
  const readyEntries = sortedEntries.filter((entry) => entry.status === "owner_review_ready");
  const warningEntries = sortedEntries.filter((entry) => entry.status === "owner_review_with_warning");
  const blockedEntries = sortedEntries.filter((entry) => entry.status === "blocked");
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    sourceReports: [
      "next-acquisition-readiness-ranking-latest.json",
      "monitor-xl2540k-execution-readiness-checklist-latest.json",
      "headphone-sony-first-wave-execution-readiness-checklist-latest.json",
      "speaker-jbl-flip6-execution-readiness-checklist-latest.json",
      "game-console-ps5-execution-readiness-checklist-latest.json",
      "exact-acquisition-readiness-board-latest.json",
      "tablet-ipad-pro-m4-execution-readiness-checklist-latest.json",
      "camera-sony-a7m3-execution-readiness-checklist-latest.json",
    ],
    entries: sortedEntries,
    recommendation: [
      "Do not execute any packet while P0 Supabase/runtime work is active.",
      "If execution is later approved, start with monitor XL2540K because it has the cleanest checklist.",
      "Headphone Sony XM4/CH520 is now checklist-ready and can be compared with monitor after P0 stabilization.",
      readyEntries.length > 0
        ? `Ready targets: ${readyEntries.map((entry) => `${entry.category}/${entry.target}`).join("; ")}.`
        : "No ready targets remain after latest detail gates.",
      warningEntries.length > 0
        ? `Warning targets: ${warningEntries.map((entry) => `${entry.category}/${entry.target}`).join("; ")}.`
        : "No warning targets remain after the latest report-only checks.",
      "Keep camera A7M3 blocked because the second no-write live-read wave still has fewer than 4 clean rows.",
      "Latest detail gates override older source/spec checklists when they disagree.",
    ],
    conclusion: "acquisition_owner_readiness_board_prepared_report_only",
    nextStep:
      blockedEntries.length > 0
        ? "Keep ready targets dormant until P0 stabilization; next report-only cleanup is adjacent tech lane selection, not camera execution."
        : "Keep ready targets dormant until P0 stabilization; next cleanup is owner review packet ordering.",
  };

  const jsonPath = path.join(reportsDir, "acquisition-owner-readiness-board-latest.json");
  const mdPath = path.join(reportsDir, "acquisition-owner-readiness-board-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Acquisition Owner Readiness Board",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Entries",
    "",
    mdTable(
      ["status", "category", "target", "rows", "cap", "score", "pass", "warn", "fail", "next"],
      sortedEntries.map((entry) => [
        entry.status,
        entry.category,
        entry.target,
        entry.allowedRows,
        entry.maxFutureWriteCap,
        entry.score ?? "-",
        entry.passChecks ?? "-",
        entry.warningChecks ?? "-",
        entry.failedChecks ?? "-",
        entry.nextStep,
      ]),
    ),
    "",
    "## Recommendation",
    "",
    ...report.recommendation.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    entries: report.entries.length,
    topStatus: report.entries[0]?.status,
    topTarget: report.entries[0]?.target,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
