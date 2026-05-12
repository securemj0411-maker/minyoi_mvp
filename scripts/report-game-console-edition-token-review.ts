import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };
type Example = {
  pid?: string;
  title?: string;
  price?: number;
  url?: string;
  listingType?: string;
  comparableKey?: string | null;
  needsReview?: boolean;
  reasons?: string[];
};

type GameConsoleReport = {
  category: string;
  topComparableKeys: CountRow[];
  examples: Record<string, Example[]>;
};

const reportsDir = path.join(process.cwd(), "reports");

function reviewClass(example: Example): string {
  const title = example.title ?? "";
  const key = example.comparableKey ?? "";
  if (/매입|삽니다|구매/i.test(title)) return "hold_buying_or_mixed_generation";
  if (/케이스|하우징|파우치|필름/i.test(title)) return "hold_accessory_or_housing";
  if (/게임칩|타이틀|프로콘|주변기기|\+|등/i.test(title)) return "hold_bundle_or_game_title";
  if (/switch_2|스위치2/i.test(key) || /스위치\s?2|switch\s?2/i.test(title)) return "review_switch_2_token";
  if (/playstation_5|ps5|플스5/i.test(key) || /ps5|플스5|플레이스테이션5/i.test(title)) return "review_ps5_edition_token";
  if (/unknown_edition|unknown_body/.test(key) || example.reasons?.some((reason) => reason.includes("unknown"))) return "hold_unknown_edition_or_body";
  return "review_known_body_token";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const parser = JSON.parse(await readFile(path.join(reportsDir, "game-console-parser-latest.json"), "utf8")) as GameConsoleReport;
  const examples = Object.values(parser.examples).flat();
  const tokenKeyRows = parser.topComparableKeys.filter((row) => /switch_2|playstation_5|unknown_edition|unknown_body/.test(row.key));
  const reviewRows = examples
    .filter((example) => /스위치\s?2|switch\s?2|ps5|플스5|unknown_edition|unknown_body|매입|케이스|하우징|\+|타이틀/i.test(`${example.title ?? ""} ${example.comparableKey ?? ""}`))
    .map((example) => ({
      ...example,
      reviewClass: reviewClass(example),
      action: reviewClass(example).startsWith("review_") ? "manual_review_before_test_candidate" : "keep_hold_or_exclude",
    }));
  const classCounts = countBy(reviewRows.map((row) => row.reviewClass));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: parser.category,
    decision: "hold_report_only_review_list",
    sourceReports: ["game-console-parser-latest.json", "game-console-strict-parser-deep-dive-latest.json"],
    metrics: {
      tokenKeyRows: tokenKeyRows.length,
      reviewRows: reviewRows.length,
      classCounts,
    },
    tokenKeyRows,
    reviewRows: reviewRows.slice(0, 30),
    policyImplications: [
      "Switch 2 and PS5 edition tokens are review signals only in this report.",
      "Bundle, buying, accessory, and game-title rows remain excluded from body candidate review.",
      "unknown_edition and unknown_body rows must stay hold-only until main-approved runtime rules exist.",
    ],
    nextReportOnlyExperiments: [
      "separate Switch 2 body-only/full-set review rows from buying and bundle rows",
      "separate PS5 slim/disc/digital unknown_body rows for manual review",
      "produce bundle/game-title exclusion examples for body_narrow tests only",
    ],
    doNotDo: [
      "Do not apply Switch 2 runtime rules",
      "Do not apply PS5 edition runtime rules",
      "Do not public-promote game_console_body_narrow",
      "Do not wire candidate pool policy from this report",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-edition-token-review-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | listing_type | review_class | action | title |",
    "| --- | --- | --- | --- | --- |",
    ...report.reviewRows.map((row) => `| ${row.pid ?? "-"} | ${row.listingType ?? "-"} | ${row.reviewClass} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Game Console Edition Token Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Switch 2 / PS5 / unknown edition token review. This is not runtime wiring and not public promotion.",
    "",
    "## Review Rows",
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

  await writeFile(path.join(reportsDir, "game-console-edition-token-review-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-edition-token-review-latest.json");
  console.log("wrote reports/game-console-edition-token-review-latest.md");
  console.log(`game console edition token review: rows=${reviewRows.length}, classes=${classCounts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
