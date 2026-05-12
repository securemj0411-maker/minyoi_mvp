import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Matrix = {
  rows: Array<{
    category: string;
    scope: string;
    manualReview: string[];
    mustHold: string[];
    requiredTests: string[];
    forbiddenWiring: string[];
  }>;
};

type ReadinessSummary = {
  rows: Array<{
    category: string;
    status: string;
    primaryMetric: string;
    caveat: string;
    nextAction: string;
  }>;
};

type ReviewCoverageSummary = {
  rows: Array<{
    category: string;
    status: string;
    reviewExampleCount: number;
    splitOnlyDocumented: boolean;
  }>;
};

const reportsDir = path.join(process.cwd(), "reports");

const globalBlockers = [
  "main agent DB/worker stabilization not completed in this subagent scope",
  "runtime catalog apply is forbidden",
  "public promotion is forbidden",
  "candidate pool policy wiring is forbidden",
  "Supabase schema / cron / lifecycle / source health / pack UI changes are forbidden",
  "parser_candidate is internal review only, not approval",
  "review coverage closure is evidence coverage only, not parser approval",
];

const holdOnlyCategories = [
  {
    category: "camera_discovered",
    blocker: "runtime category/parser and body/lens/kit/fixed-lens package split missing",
  },
  {
    category: "smartwatch_discovered",
    blocker: "strap/network/SE-generation ambiguity remains",
  },
  {
    category: "speaker_audio_discovered",
    blocker: "generic speaker/amp/receiver/PA families dominate",
  },
  {
    category: "home_appliance_tech_discovered",
    blocker: "generic appliance and logistics-risk rows dominate",
  },
  {
    category: "game_console_discovered",
    blocker: "broad category is contamination map only; body_narrow split required",
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const matrix = await readJson<Matrix>("parser-policy-conditions-matrix-latest.json");
  const summary = await readJson<ReadinessSummary>("parser-readiness-summary-latest.json");
  const reviewCoverage = await readJson<ReviewCoverageSummary>("parser-review-coverage-summary-latest.json");
  const statusByCategory = new Map(summary.rows.map((row) => [row.category, row]));
  const reviewCoverageByCategory = new Map(reviewCoverage.rows.map((row) => [row.category, row]));

  const candidateRows = matrix.rows.map((row) => {
    const status = statusByCategory.get(row.category);
    const coverage = reviewCoverageByCategory.get(row.category);
    return {
      category: row.category,
      scope: row.scope,
      currentStatus: status?.status ?? "unknown",
      primaryMetric: status?.primaryMetric ?? "n/a",
      caveat: status?.caveat ?? "",
      reviewCoverageStatus: coverage?.status ?? "unknown",
      reviewExampleCount: coverage?.reviewExampleCount ?? 0,
      externalBlockers: globalBlockers,
      categoryBlockers: [
        ...row.manualReview.map((item) => `manual_review: ${item}`),
        ...row.mustHold.map((item) => `must_hold: ${item}`),
      ],
      requiredBeforeMainReview: row.requiredTests,
      forbiddenWiring: row.forbiddenWiring,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    globalBlockers,
    candidateRows,
    holdOnlyCategories,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-wiring-blockers-latest.json"), JSON.stringify(report, null, 2));

  const candidateTable = [
    "| category | status | metric | review_coverage | examples | scope | required_before_main_review | category_blockers |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- |",
    ...candidateRows.map((row) =>
      [
        row.category,
        row.currentStatus,
        row.primaryMetric,
        row.reviewCoverageStatus,
        row.reviewExampleCount,
        row.scope,
        row.requiredBeforeMainReview.map((item) => `- ${item}`).join("<br>"),
        row.categoryBlockers.map((item) => `- ${item}`).join("<br>"),
      ].join(" | "),
    ).map((line) => `| ${line} |`),
  ].join("\n");

  const holdTable = [
    "| category | blocker |",
    "| --- | --- |",
    ...holdOnlyCategories.map((row) => `| ${row.category} | ${row.blocker} |`),
  ].join("\n");

  const md = [
    "# Parser Wiring Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only blocker list. This is not a wiring proposal and not public promotion.",
    "",
    "## Global Blockers",
    "",
    ...globalBlockers.map((line) => `- ${line}`),
    "",
    "## Candidate Draft Blockers",
    "",
    candidateTable,
    "",
    "## Hold-Only Categories",
    "",
    holdTable,
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-wiring-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-wiring-blockers-latest.json");
  console.log("wrote reports/parser-wiring-blockers-latest.md");
  console.log(`blocker rows=${candidateRows.length}; hold_only=${holdOnlyCategories.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
