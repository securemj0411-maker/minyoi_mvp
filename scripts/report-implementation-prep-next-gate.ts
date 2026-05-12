import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ImplementationCase = {
  caseId: string;
  phase: string;
  category: string;
  scope: string;
  inputTitle: string;
  expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
  blockerType: string;
  evidenceSource: string;
  confidence: "high" | "medium" | "low";
  notes: string;
};

type PrepReport = {
  scope: string;
  metrics: Record<string, number | string | boolean | null | undefined>;
  positiveTestCases?: ImplementationCase[];
  splitOnlyOrArchitectureCases?: ImplementationCase[];
  manualReviewTestCases?: ImplementationCase[];
  negativeHoldTestCases?: ImplementationCase[];
  deferred?: string[];
  stopCondition?: string;
  sourceReportsRead?: string[];
};

type PhaseInput = {
  phase: string;
  category: string;
  depth: "deep" | "lightweight";
  reportFile: string;
  scriptFile: string;
};

type CategoryGate = {
  phase: string;
  category: string;
  depth: "deep" | "lightweight";
  reportFile: string;
  scriptFile: string;
  reviewLane: "narrow_candidate_review" | "evidence_backfill_first" | "split_architecture_only";
  reviewScore: number;
  reason: string;
  metrics: Record<string, number | string | boolean | null | undefined>;
  counts: {
    totalCases: number;
    positive: number;
    splitOnly: number;
    hold: number;
    manualReview: number;
    runtimeApprovedRows: number;
  };
  selectedCases: ImplementationCase[];
  deferred: string[];
  nextAction: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const phaseInputs: PhaseInput[] = [
  {
    phase: "Phase 1",
    category: "earphone_airpods_discovered",
    depth: "deep",
    reportFile: "earphone-airpods-implementation-prep-latest.json",
    scriptFile: "scripts/report-earphone-airpods-implementation-prep.ts",
  },
  {
    phase: "Phase 2",
    category: "headphone_discovered",
    depth: "deep",
    reportFile: "headphone-matched-sku-implementation-prep-latest.json",
    scriptFile: "scripts/report-headphone-matched-sku-implementation-prep.ts",
  },
  {
    phase: "Phase 3",
    category: "game_console_body_narrow",
    depth: "deep",
    reportFile: "game-console-body-narrow-implementation-prep-latest.json",
    scriptFile: "scripts/report-game-console-body-narrow-implementation-prep.ts",
  },
  {
    phase: "Phase 4",
    category: "monitor_discovered",
    depth: "deep",
    reportFile: "monitor-model-code-implementation-prep-latest.json",
    scriptFile: "scripts/report-monitor-model-code-implementation-prep.ts",
  },
  {
    phase: "Phase 5",
    category: "desktop_discovered",
    depth: "deep",
    reportFile: "desktop-cpu-gpu-implementation-prep-latest.json",
    scriptFile: "scripts/report-desktop-cpu-gpu-implementation-prep.ts",
  },
  {
    phase: "Phase 6",
    category: "smartwatch_discovered",
    depth: "lightweight",
    reportFile: "smartwatch-ambiguity-split-prep-latest.json",
    scriptFile: "scripts/report-smartwatch-ambiguity-split-prep.ts",
  },
  {
    phase: "Phase 7",
    category: "camera_discovered",
    depth: "lightweight",
    reportFile: "camera-package-split-prep-latest.json",
    scriptFile: "scripts/report-camera-package-split-prep.ts",
  },
  {
    phase: "Phase 8",
    category: "speaker_audio_discovered",
    depth: "lightweight",
    reportFile: "speaker-audio-device-class-split-prep-latest.json",
    scriptFile: "scripts/report-speaker-audio-device-class-split-prep.ts",
  },
  {
    phase: "Phase 9",
    category: "home_appliance_tech_discovered",
    depth: "lightweight",
    reportFile: "home-appliance-vacuum-subtype-split-prep-latest.json",
    scriptFile: "scripts/report-home-appliance-vacuum-subtype-split-prep.ts",
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function numericMetric(report: PrepReport, key: string): number {
  const value = report.metrics[key];
  return typeof value === "number" ? value : 0;
}

function cases(report: PrepReport): ImplementationCase[] {
  return [
    ...(report.positiveTestCases ?? []),
    ...(report.splitOnlyOrArchitectureCases ?? []),
    ...(report.manualReviewTestCases ?? []),
    ...(report.negativeHoldTestCases ?? []),
  ];
}

function reviewLane(input: PhaseInput, report: PrepReport): CategoryGate["reviewLane"] {
  if (numericMetric(report, "positiveCount") > 0 && input.depth === "deep") return "narrow_candidate_review";
  if (numericMetric(report, "splitOnlyCount") > 0) return "split_architecture_only";
  return "evidence_backfill_first";
}

function reviewReason(input: PhaseInput, report: PrepReport, lane: CategoryGate["reviewLane"]): string {
  if (lane === "narrow_candidate_review") {
    return "Has positive deep-prep cases, but still requires main approval, official/spec evidence check, and no-mutation dry run.";
  }
  if (lane === "split_architecture_only") {
    return "Has useful split-only architecture cases, but no positive runtime candidate should be inferred.";
  }
  if (input.category === "desktop_discovered") {
    return "CPU/GPU title-token examples are useful, but current prep has only manual/hold cases and no positive runtime candidate.";
  }
  return "Evidence backfill is required before narrow implementation review.";
}

function score(input: PhaseInput, report: PrepReport, lane: CategoryGate["reviewLane"]): number {
  const positive = numericMetric(report, "positiveCount");
  const splitOnly = numericMetric(report, "splitOnlyCount");
  const hold = numericMetric(report, "holdCount");
  const manual = numericMetric(report, "manualReviewCount");
  const parserReadyRate = numericMetric(report, "parserReadyRate") || numericMetric(report, "strictParserReadyRate") || numericMetric(report, "modelMatchedRate");
  const depthBonus = input.depth === "deep" ? 10 : 0;
  const laneBonus = lane === "narrow_candidate_review" ? 30 : lane === "split_architecture_only" ? 8 : 0;
  return Number((laneBonus + depthBonus + positive * 6 + splitOnly * 2 + parserReadyRate / 10 - hold * 1.5 - manual).toFixed(1));
}

function nextAction(input: PhaseInput, lane: CategoryGate["reviewLane"]): string {
  if (lane === "narrow_candidate_review") {
    return `Main/owner review may choose ${input.category} for one narrow no-mutation parser dry run; do not wire runtime policy yet.`;
  }
  if (lane === "split_architecture_only") {
    return `Keep ${input.category} as split architecture evidence and backfill official/spec or broader sample evidence first.`;
  }
  return `Backfill evidence for ${input.category}; keep all current cases report-only.`;
}

function selectedCases(report: PrepReport, lane: CategoryGate["reviewLane"]): ImplementationCase[] {
  if (lane === "narrow_candidate_review") {
    return [...(report.positiveTestCases ?? []), ...(report.manualReviewTestCases ?? []).slice(0, 2), ...(report.negativeHoldTestCases ?? []).slice(0, 2)];
  }
  if (lane === "split_architecture_only") {
    return [...(report.splitOnlyOrArchitectureCases ?? []), ...(report.manualReviewTestCases ?? []).slice(0, 2), ...(report.negativeHoldTestCases ?? []).slice(0, 2)];
  }
  return [...(report.manualReviewTestCases ?? []), ...(report.negativeHoldTestCases ?? [])].slice(0, 5);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const gates: CategoryGate[] = [];

  for (const input of phaseInputs) {
    const report = await readJson<PrepReport>(path.join(reportsDir, input.reportFile));
    const lane = reviewLane(input, report);
    const allCases = cases(report);
    gates.push({
      phase: input.phase,
      category: input.category,
      depth: input.depth,
      reportFile: `reports/${input.reportFile}`,
      scriptFile: input.scriptFile,
      reviewLane: lane,
      reviewScore: score(input, report, lane),
      reason: reviewReason(input, report, lane),
      metrics: report.metrics,
      counts: {
        totalCases: allCases.length,
        positive: numericMetric(report, "positiveCount"),
        splitOnly: numericMetric(report, "splitOnlyCount"),
        hold: numericMetric(report, "holdCount"),
        manualReview: numericMetric(report, "manualReviewCount"),
        runtimeApprovedRows: numericMetric(report, "runtimeApprovedRows"),
      },
      selectedCases: selectedCases(report, lane),
      deferred: report.deferred ?? [],
      nextAction: nextAction(input, lane),
    });
  }

  gates.sort((a, b) => b.reviewScore - a.reviewScore || a.category.localeCompare(b.category));

  const deferredRegister = gates.flatMap((gate) =>
    gate.deferred.map((item, index) => ({
      id: `${gate.category}-deferred-${String(index + 1).padStart(2, "0")}`,
      category: gate.category,
      phase: gate.phase,
      lane: gate.reviewLane,
      item,
      carryForward: true,
    })),
  );

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Next-gate review queue and deferred register for implementation-prep reports",
    gates,
    deferredRegister,
    topNarrowReviewCandidates: gates.filter((gate) => gate.reviewLane === "narrow_candidate_review").slice(0, 3),
    splitArchitectureOnly: gates.filter((gate) => gate.reviewLane === "split_architecture_only"),
    evidenceBackfillFirst: gates.filter((gate) => gate.reviewLane === "evidence_backfill_first"),
    requiredBeforeAnyRuntimeWiring: [
      "main DB/worker stabilization",
      "explicit owner/main-agent approval for one narrow category",
      "official or reliable spec evidence for selected positive cases",
      "no-mutation parser/report dry run",
      "candidate-pool and public promotion remain off unless separately approved",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-next-gate-latest.json"), JSON.stringify(report, null, 2));

  const rows = gates.map((gate) => {
    const counts = `${gate.counts.positive}/${gate.counts.splitOnly}/${gate.counts.hold}/${gate.counts.manualReview}`;
    return `| ${gate.category} | ${gate.depth} | ${gate.reviewLane} | ${gate.reviewScore} | ${counts} | ${gate.counts.runtimeApprovedRows} | ${gate.reason} |`;
  });

  const caseRows = gates.flatMap((gate) =>
    gate.selectedCases.map((item) => `| ${gate.category} | ${item.caseId} | ${item.expectedClass} | ${item.confidence} | ${item.inputTitle.replace(/\|/g, "/")} |`),
  );

  const deferredRows = deferredRegister.map((item) => `| ${item.category} | ${item.lane} | ${item.item.replace(/\|/g, "/")} |`);

  const md = [
    "# Subagent Implementation Prep Next Gate",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only next-gate review queue. This does not approve runtime wiring, public promotion, candidate-pool policy wiring, or production DB mutation.",
    "",
    "## Category Review Queue",
    "",
    "| category | depth | lane | score | positive/split/hold/manual | runtime approved | reason |",
    "| --- | --- | --- | ---: | --- | ---: | --- |",
    ...rows,
    "",
    "## Selected Review Cases",
    "",
    "| category | case_id | expected | confidence | title |",
    "| --- | --- | --- | --- | --- |",
    ...caseRows,
    "",
    "## Deferred Register",
    "",
    "| category | lane | carry-forward item |",
    "| --- | --- | --- |",
    ...deferredRows,
    "",
    "## Required Before Any Runtime Wiring",
    "",
    ...report.requiredBeforeAnyRuntimeWiring.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-next-gate-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-next-gate-latest.json");
  console.log("wrote reports/subagent-implementation-prep-next-gate-latest.md");
  console.log(`next gate: categories=${gates.length}, narrow=${report.topNarrowReviewCandidates.length}, deferred=${deferredRegister.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
