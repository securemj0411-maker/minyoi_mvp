import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReviewRow = {
  pid?: string;
  title?: string;
  price?: number;
  url?: string;
  listingType?: string;
  reviewClass: string;
  reasons?: string[];
};

type EditionReview = {
  category: string;
  reviewRows: ReviewRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function exclusionStatus(row: ReviewRow): string {
  if (row.reviewClass === "hold_bundle_or_game_title") return "exclusion_candidate_bundle_or_game_title";
  if (row.reviewClass === "hold_accessory_or_housing") return "exclusion_candidate_accessory_or_housing";
  if (row.reviewClass === "hold_buying_or_mixed_generation") return "exclusion_candidate_buying_or_mixed_generation";
  return "hold_review_only";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const edition = JSON.parse(
    await readFile(path.join(reportsDir, "game-console-edition-token-review-latest.json"), "utf8"),
  ) as EditionReview;

  const rows = edition.reviewRows.map((row) => ({
    ...row,
    exclusionStatus: exclusionStatus(row),
  }));
  const exclusionRows = rows.filter((row) => row.exclusionStatus.startsWith("exclusion_candidate_"));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: edition.category,
    decision: "exclusion_candidate_only_report_no_wiring",
    sourceReports: ["game-console-edition-token-review-latest.json", "game-console-strict-parser-deep-dive-latest.json"],
    metrics: {
      reviewRows: rows.length,
      exclusionCandidateOnlyRows: exclusionRows.length,
      bodyCandidateRows: 0,
      statusCounts: countBy(rows.map((row) => row.exclusionStatus)),
    },
    exclusionRows,
    policyImplications: [
      "These rows are exclusion-candidate-only for future tests and are not body_narrow positive candidates.",
      "Bundle/game-title, accessory/housing, and buying/mixed-generation rows must remain outside body candidate policy.",
      "Switch 2 and PS5 edition runtime handling remains blocked until main-approved rules exist.",
    ],
    nextReportOnlyExperiments: [
      "split body_narrow positive examples from exclusion examples in a separate readiness report",
      "dedupe accessory/housing examples that also contain full-box or bundle words",
      "keep edition-token runtime rules out of this subagent scope",
    ],
    doNotDo: [
      "Do not apply Switch 2 runtime rules",
      "Do not apply PS5 edition runtime rules",
      "Do not public-promote game_console_body_narrow",
      "Do not wire candidate pool policy from this report",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-exclusion-readiness-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | listing_type | exclusion_status | title |",
    "| --- | --- | --- | --- |",
    ...exclusionRows.map((row) => `| ${row.pid ?? "-"} | ${row.listingType ?? "-"} | ${row.exclusionStatus} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Game Console Exclusion Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only body_narrow exclusion-candidate readiness. This is not runtime wiring and not public promotion.",
    "",
    "## Exclusion-Candidate-Only Rows",
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "game-console-exclusion-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-exclusion-readiness-latest.json");
  console.log("wrote reports/game-console-exclusion-readiness-latest.md");
  console.log(`game console exclusion readiness: exclusion_candidate_only=${exclusionRows.length}, body_candidates=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
