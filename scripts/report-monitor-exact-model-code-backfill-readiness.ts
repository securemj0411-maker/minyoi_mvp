import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const categoryDir = path.join(appDir, "category-intelligence", "monitor_discovered");

type SelectedRow = {
  caseId: string;
  sourcePid: string;
  title: string;
  observedHint: string;
  brand: string;
  model: string;
  bucket: string;
  evidenceStatus: string;
  sourceType: string;
  sourceUrl: string | null;
  resolved: {
    size: string;
    resolution: string;
    refresh: string;
    panel: string;
    shape: string;
  };
  hybridRisks: string[];
  reviewNote: string;
};

type HoldRow = {
  caseId: string;
  sourcePid: string;
  title: string;
  observedHint: string;
  brand: string;
  model: string;
  bucket: string;
  evidenceStatus: string;
  sourceType: string;
  sourceUrl: string | null;
  resolved: {
    size: string;
    resolution: string;
    refresh: string;
    panel: string;
    shape: string;
  };
  hybridRisks: string[];
  reviewNote: string;
};

type SelectedBackfillReport = {
  generatedAt: string;
  metrics: {
    selectedModelRows: number;
    totalRows: number;
    runtimeCandidateAfterMainReview: number;
    manualReviewNeeded: number;
    holdOrExclusion: number;
    officialBackfilledRows: number;
  };
  selectedRows: SelectedRow[];
  holdRows: HoldRow[];
};

type PendingRow = {
  hint: string;
  count: number;
  reviewClass: string;
  action: string;
  testCandidateStatus: string;
};

type ExcludedRow = {
  hint: string;
  count: number;
  reviewClass: string;
  action: string;
  testCandidateStatus: string;
};

type PendingEvidenceReport = {
  metrics: {
    pendingRows: number;
    confirmedTestCandidates: number;
    excludedBeforeTestCandidate: number;
    criticalUnknownRows: number;
  };
  pendingRows: PendingRow[];
  excludedRows: ExcludedRow[];
};

type RuntimeDryRunReport = {
  conclusion: string;
  metrics: {
    rows: number;
    splitOnlyRows: number;
    selectedExactModelRuntimeRows: number;
    manualReviewRows: number;
    holdRows: number;
    parserReadyButRuntimeUnwiredRows: number;
    runtimeApprovedRows: number;
  };
};

type MonitorParserReport = {
  total: number;
  hasModelCode: number;
  hasModelCodeRate: number;
  genericKey: number;
  genericKeyRate: number;
  parserReady: number;
  parserReadyRate: number;
  needsReview: number;
  needsReviewRate: number;
  criticalUnknown: number;
  criticalUnknownRate: number;
  topComparableKeys: Array<{ key: string; count: number }>;
};

type CategoryRuntimeReadinessBoard = {
  rows: Array<{
    category: string;
    conclusion?: string;
    status: string;
  }>;
};

type PassCategoryRollup = {
  rows: Array<{
    category: string;
    packetFile: string;
    auditConclusion: string;
  }>;
};

type NormalizedSample = {
  pid: string;
  title?: string;
  name?: string;
  price: number;
  url: string;
};

type ModelCodeFrequency = {
  code: string;
  count: number;
  sampleTitle: string;
  route: "exact_backfill_priority" | "manual_or_ai_l2" | "hold_or_exclude";
  note: string;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(text: string, limit = 88) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function extractModelCodes(samples: NormalizedSample[]) {
  const regex = /\b(?:[a-z]{1,4}[0-9]{2,}[a-z0-9-]{0,8}|[0-9]{2}[a-z]{1,4}[0-9]{2,}[a-z0-9-]{0,8})\b/gi;
  const counts = new Map<string, { count: number; sampleTitle: string }>();
  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const tokens = title.match(regex) ?? [];
    for (const token of tokens) {
      const code = token.toLowerCase();
      const current = counts.get(code);
      counts.set(code, {
        count: (current?.count ?? 0) + 1,
        sampleTitle: current?.sampleTitle ?? title,
      });
    }
  }
  return [...counts.entries()]
    .map(([code, value]) => ({ code, ...value }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();

  const selectedBackfill = await readJson<SelectedBackfillReport>(path.join(reportsDir, "monitor-selected-model-backfill-latest.json"));
  const pendingEvidence = await readJson<PendingEvidenceReport>(path.join(reportsDir, "monitor-pending-model-code-evidence-latest.json"));
  const runtimeDryRun = await readJson<RuntimeDryRunReport>(path.join(reportsDir, "monitor-no-mutation-runtime-dry-run-latest.json"));
  const monitorParser = await readJson<MonitorParserReport>(path.join(reportsDir, "monitor-parser-latest.json"));
  const runtimeBoard = await readJson<CategoryRuntimeReadinessBoard>(path.join(reportsDir, "category-runtime-readiness-board-latest.json"));
  const passRollup = await readJson<PassCategoryRollup>(path.join(reportsDir, "pass-category-expansion-rollup-latest.json"));
  const normalizedSamples = await readJson<NormalizedSample[]>(path.join(categoryDir, "normalized_samples.json"));

  const exactBackfillRows = selectedBackfill.selectedRows.filter((row) => row.bucket === "runtime_candidate_after_main_review");
  const manualRows = selectedBackfill.selectedRows.filter((row) => row.bucket === "manual_review_needed");
  const holdRows = selectedBackfill.holdRows;

  const routeByCode = new Map<string, ModelCodeFrequency["route"]>();
  const noteByCode = new Map<string, string>();
  for (const row of exactBackfillRows) {
    routeByCode.set(row.observedHint.toLowerCase(), "exact_backfill_priority");
    noteByCode.set(row.observedHint.toLowerCase(), "official_backfilled_exact_model");
  }
  for (const row of manualRows) {
    routeByCode.set(row.observedHint.toLowerCase(), "manual_or_ai_l2");
    noteByCode.set(row.observedHint.toLowerCase(), row.hybridRisks.join(",") || "manual_review_needed");
  }
  for (const row of holdRows) {
    routeByCode.set(row.observedHint.toLowerCase(), "hold_or_exclude");
    noteByCode.set(row.observedHint.toLowerCase(), row.hybridRisks.join(",") || "hold_or_exclusion");
  }

  const frequentCodes = extractModelCodes(normalizedSamples)
    .slice(0, 24)
    .map((row) => ({
      code: row.code,
      count: row.count,
      sampleTitle: row.sampleTitle,
      route: routeByCode.get(row.code) ?? "hold_or_exclude",
      note: noteByCode.get(row.code) ?? "unconfirmed_repeating_model_code",
    }))
    .filter((row) => row.count >= 2 || routeByCode.has(row.code));

  const routeCounts = countBy(frequentCodes, (row) => row.route);
  const cleanOfficialCodes = exactBackfillRows.map((row) => ({
    code: row.observedHint.toLowerCase(),
    brand: row.brand,
    model: row.model,
    countInSamples: frequentCodes.find((item) => item.code === row.observedHint.toLowerCase())?.count ?? 1,
    sourcePid: row.sourcePid,
    sourceType: row.sourceType,
    official: row.evidenceStatus === "official_backfilled",
    shape: row.resolved.shape,
    note: row.hybridRisks.length ? row.hybridRisks.join(", ") : "clean_exact_model_code",
  }));

  const nextStepDecision =
    cleanOfficialCodes.length >= 5 && pendingEvidence.metrics.confirmedTestCandidates === 0
      ? "exact_lane_backfill_first"
      : pendingEvidence.metrics.pendingRows > 0
        ? "ai_l2_or_manual_confirmation_first"
        : "deterministic_patch_review";

  const report = {
    generatedAt,
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    category: "monitor_discovered",
    scope: "exact model-code lane backfill readiness only",
    sourceArtifacts: [
      "reports/monitor-selected-model-backfill-latest.json",
      "reports/monitor-pending-model-code-evidence-latest.json",
      "reports/monitor-no-mutation-runtime-dry-run-latest.json",
      "reports/monitor-parser-latest.json",
      "reports/category-runtime-readiness-board-latest.json",
      "reports/pass-category-expansion-rollup-latest.json",
      "category-intelligence/monitor_discovered/normalized_samples.json",
    ],
    currentState: {
      parserTotal: monitorParser.total,
      hasModelCodeRate: monitorParser.hasModelCodeRate,
      genericKeyRate: monitorParser.genericKeyRate,
      parserReadyRate: monitorParser.parserReadyRate,
      criticalUnknownRate: monitorParser.criticalUnknownRate,
      selectedModelRows: selectedBackfill.metrics.selectedModelRows,
      exactBackfillRows: exactBackfillRows.length,
      manualRows: manualRows.length,
      holdRows: holdRows.length,
      officialBackfilledRows: selectedBackfill.metrics.officialBackfilledRows,
      pendingRows: pendingEvidence.metrics.pendingRows,
      confirmedTestCandidates: pendingEvidence.metrics.confirmedTestCandidates,
      runtimeDryRunRows: runtimeDryRun.metrics.rows,
      runtimeDryRunExactRows: runtimeDryRun.metrics.selectedExactModelRuntimeRows,
    },
    evidence: {
      passCategoryAudit: passRollup.rows.find((row) => row.category === "monitor_discovered") ?? null,
      runtimeReadiness: runtimeBoard.rows.find((row) => row.category === "monitor_discovered") ?? null,
      runtimeDryRunConclusion: runtimeDryRun.conclusion,
    },
    exactLaneCandidates: cleanOfficialCodes,
    pendingManualOrAiL2: manualRows.map((row) => ({
      code: row.observedHint.toLowerCase(),
      brand: row.brand,
      model: row.model,
      sourcePid: row.sourcePid,
      note: row.hybridRisks.join(", ") || "manual_review_needed",
      sourceType: row.sourceType,
    })),
    deterministicHolds: holdRows.map((row) => ({
      code: row.observedHint.toLowerCase(),
      sourcePid: row.sourcePid,
      title: row.title,
      note: row.hybridRisks.join(", ") || "hold_or_exclusion",
      sourceType: row.sourceType,
    })),
    frequentCodes,
    routeCounts,
    nextStepDecision,
    decisionReason: [
      "Clean official model-code rows already exist and dry-run cleanly, but confirmed test candidates remain zero.",
      "Pending rows are touch/signage or critical-unknown cases, better routed to AI L2 or manual confirmation than deterministic patching.",
      "Broad monitor_discovered still has high generic and critical-unknown rates, so the next safe move is exact-lane mining/backfill, not broad deterministic runtime work.",
    ],
    nextActions: {
      exact_lane_backfill_first: [
        "Start report-only exact-lane backfill packets for official model-code rows first.",
        "Use xl2540k, 27us550, ls27f354fhk, 39gx900a, aw2525hm, 27gl650f as the first exact lanes.",
        "Keep recurring but unbackfilled codes such as xl2720, xl2411k, 27gr93u, 34uc79g as second-wave exact lane candidates.",
      ],
      ai_l2_or_manual_confirmation_first: [
        "Route ct2210ips and u2412mb to AI L2 or manual confirmation because critical unknowns remain.",
        "Do not treat touch/android/signage rows as ordinary monitor exact-lane wins.",
      ],
      deterministic_patch_review: [
        "Only consider deterministic patch review after exact lanes have enough confirmed rows and pending/manual rows are reduced.",
      ],
    }[nextStepDecision],
  };

  const scriptJsonPath = path.join(reportsDir, "monitor-exact-model-code-backfill-readiness-latest.json");
  const scriptMdPath = path.join(reportsDir, "monitor-exact-model-code-backfill-readiness-latest.md");

  await writeFile(scriptJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const md = [
    "# Monitor Exact Model-Code Backfill Readiness",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- runtimeMutation: false",
    "- supabaseMutation: false",
    `- nextStepDecision: ${nextStepDecision}`,
    "",
    "## Key Counts",
    "",
    `- parserTotal: ${report.currentState.parserTotal}`,
    `- hasModelCodeRate: ${report.currentState.hasModelCodeRate}`,
    `- genericKeyRate: ${report.currentState.genericKeyRate}`,
    `- parserReadyRate: ${report.currentState.parserReadyRate}`,
    `- criticalUnknownRate: ${report.currentState.criticalUnknownRate}`,
    `- exactBackfillRows: ${report.currentState.exactBackfillRows}`,
    `- manualRows: ${report.currentState.manualRows}`,
    `- holdRows: ${report.currentState.holdRows}`,
    `- pendingRows: ${report.currentState.pendingRows}`,
    `- confirmedTestCandidates: ${report.currentState.confirmedTestCandidates}`,
    "",
    "## Exact Lane Candidates",
    "",
    mdTable(
      ["code", "brand", "model", "countInSamples", "official", "shape", "note"],
      cleanOfficialCodes.map((row) => [
        row.code,
        row.brand,
        row.model,
        row.countInSamples,
        row.official ? "yes" : "no",
        row.shape,
        row.note,
      ]),
    ),
    "",
    "## Manual / AI L2",
    "",
    mdTable(
      ["code", "brand", "model", "sourcePid", "note"],
      report.pendingManualOrAiL2.map((row) => [row.code, row.brand, row.model, row.sourcePid, row.note]),
    ),
    "",
    "## Deterministic Holds",
    "",
    mdTable(
      ["code", "sourcePid", "title", "note"],
      report.deterministicHolds.map((row) => [row.code, row.sourcePid, compact(row.title), row.note]),
    ),
    "",
    "## Frequent Model Codes In Broad Lane",
    "",
    mdTable(
      ["code", "count", "route", "note", "sampleTitle"],
      frequentCodes.map((row) => [row.code, row.count, row.route, row.note, compact(row.sampleTitle)]),
    ),
    "",
    "## Route Counts",
    "",
    mdTable(["route", "count"], routeCounts),
    "",
    "## Decision Reason",
    "",
    ...report.decisionReason.map((item) => `- ${item}`),
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await writeFile(scriptMdPath, `${md}\n`, "utf8");

  console.log(JSON.stringify({
    nextStepDecision,
    exactBackfillRows: exactBackfillRows.length,
    manualRows: manualRows.length,
    holdRows: holdRows.length,
    pendingRows: pendingEvidence.metrics.pendingRows,
    scriptJsonPath,
    scriptMdPath,
  }, null, 2));
}

void main();
