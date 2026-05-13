import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SampleReport = {
  rows?: Array<{
    pid: string;
    title: string;
    price: number;
    decision: "clean_candidate" | "hold" | "ai_l2_or_manual";
    reasons: string[];
    skuId: string | null;
    comparableKey: string | null;
  }>;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-ipad_pro_13_m2_exact_wifi_wave1-latest.json");

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text.toLowerCase());
}

const source = readJson<SampleReport>(sourcePath);
const rows = source?.rows ?? [];

const enriched = rows.map((row) => {
  const text = row.title.toLowerCase();
  const signals = {
    explicitM2: has(text, /\bm2\b|m2칩|m2\s*칩/i),
    explicit6th: has(text, /6세대|6\s*th/i),
    explicit129: has(text, /12\.9|12\s*9/i),
    explicit13: has(text, /13\s*인치|13\s*형|\b13\b/i),
    explicitWifi: has(text, /wifi|wi-fi|와이파이|와파|wlan/i),
    explicit256: has(text, /256/i),
    wrongGeneration: has(text, /4세대|5세대|m1|a2378|a2379|a2461|a2462/i),
    cellular: has(text, /셀룰러|cellular|\blte\b|\b5g\b|wi-?fi\s*\+\s*cell|\bcell\b/i),
    ipadAir: has(text, /아이패드\s*에어|ipad\s*air|에어\s*13/i),
    buying: has(text, /매입|삽니다|구합니다|구매합니다/i),
  };
  return {
    ...row,
    signals,
    queryClass:
      row.decision === "clean_candidate"
        ? "usable_clean_seed"
        : signals.wrongGeneration || signals.cellular || signals.ipadAir || signals.buying
          ? "query_exclusion_needed"
          : "needs_detail_or_ai_l2",
  };
});

const cleanRows = enriched.filter((row) => row.queryClass === "usable_clean_seed");
const exclusionRows = enriched.filter((row) => row.queryClass === "query_exclusion_needed");
const aiRows = enriched.filter((row) => row.queryClass === "needs_detail_or_ai_l2");

const output = {
  generatedAt: new Date().toISOString(),
  scope: "ipad_pro_13_m2_exact_wifi_query_guard_refinement",
  source: "reports/exact-acquisition-no-write-sample-ipad_pro_13_m2_exact_wifi_wave1-latest.json",
  runtimeMutation: false,
  supabaseMutation: false,
  publicPromotion: false,
  totalRows: enriched.length,
  usableCleanSeeds: cleanRows.length,
  queryExclusionNeeded: exclusionRows.length,
  needsDetailOrAiL2: aiRows.length,
  recommendedNextQueries: [
    "아이패드 프로 12.9 6세대 m2 256 wifi",
    "아이패드 프로 12.9 6세대 256 와이파이",
    "아이패드 프로6세대 m2 12.9 256기가 와이파이",
  ],
  recommendedRejectTerms: [
    "4세대",
    "5세대",
    "M1",
    "A2378",
    "A2379",
    "A2461",
    "A2462",
    "셀룰러",
    "cellular",
    "LTE",
    "5G",
    "iPad Air",
    "아이패드 에어",
    "매입",
    "삽니다",
  ],
  rows: enriched,
  decision:
    "Do not broaden iPad Pro 13 M2 acquisition. Use 12.9/6th/M2/256/Wi-Fi anchored queries and reject 4th/5th/M1/cellular/iPad Air pollution before another no-write sample.",
};

const md = [
  "# iPad Pro 13 M2 Query Guard Refinement",
  "",
  `- generatedAt: ${output.generatedAt}`,
  `- source: ${output.source}`,
  "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
  `- totalRows: ${output.totalRows}`,
  `- usableCleanSeeds: ${output.usableCleanSeeds}`,
  `- queryExclusionNeeded: ${output.queryExclusionNeeded}`,
  `- needsDetailOrAiL2: ${output.needsDetailOrAiL2}`,
  "",
  "## Recommended Next Queries",
  "",
  ...output.recommendedNextQueries.map((item) => `- ${item}`),
  "",
  "## Reject Terms",
  "",
  ...output.recommendedRejectTerms.map((item) => `- ${item}`),
  "",
  "## Rows",
  "",
  "| class | decision | pid | title | reasons |",
  "| --- | --- | --- | --- | --- |",
  ...enriched.map((row) =>
    `| ${row.queryClass} | ${row.decision} | ${row.pid} | ${row.title.replace(/\|/g, "/")} | ${row.reasons.join(", ") || "-"} |`,
  ),
  "",
  "## Decision",
  "",
  `- ${output.decision}`,
  "",
].join("\n");

writeFileSync(path.join(reportDir, "ipad-pro-13-m2-query-guard-refinement-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(path.join(reportDir, "ipad-pro-13-m2-query-guard-refinement-latest.md"), md);

console.log("wrote reports/ipad-pro-13-m2-query-guard-refinement-latest.json");
console.log("wrote reports/ipad-pro-13-m2-query-guard-refinement-latest.md");
console.log(JSON.stringify({ totalRows: output.totalRows, usableCleanSeeds: output.usableCleanSeeds, queryExclusionNeeded: output.queryExclusionNeeded }));
