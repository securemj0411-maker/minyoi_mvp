import fs from "node:fs";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing, type ListingType } from "@/lib/pipeline";

type ExpectedShape = ListingType | "hold_non_normal";

type Probe = {
  id: string;
  category: "earphone_discovered" | "smartwatch_discovered" | "headphone_discovered";
  title: string;
  description?: string;
  price: number;
  expected: ExpectedShape;
  reportOnlyBasis: string;
  suggestedPatchOwner: "main-agent";
  regressionFixtureProposal: string;
};

const probes: Probe[] = [
  {
    id: "EXP-AIRPODS-CASE-01",
    category: "earphone_discovered",
    title: "만날로니안 에어팟 프로 2세대 케이스",
    price: 30_000,
    expected: "accessory",
    reportOnlyBasis: "AirPods case/accessory-only rows must stay outside candidates.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Keep observed AirPods Pro 2 decorative case title as accessory regression.",
  },
  {
    id: "EXP-AIRPODS-SIDE-02",
    category: "earphone_discovered",
    title: "에어팟 프로2 왼쪽 유닛",
    price: 55_000,
    expected: "parts",
    reportOnlyBasis: "AirPods side-only unit rows are negative/hold rows.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Assert left/right AirPods unit titles classify as parts.",
  },
  {
    id: "EXP-AIRPODS-FULLSET-03",
    category: "earphone_discovered",
    title: "에어팟프로2세대 라이트닝 풀박스 판매합니다",
    price: 170_000,
    expected: "normal",
    reportOnlyBasis: "Full product context with clear connector should remain normal.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Control fixture to ensure accessory patch does not block real full-set AirPods.",
  },
  {
    id: "EXP-SMARTWATCH-STRAP-04",
    category: "smartwatch_discovered",
    title: "애플워치 울트라2 스트랩 케이스 풀커버",
    price: 30_000,
    expected: "accessory",
    reportOnlyBasis: "Smartwatch strap/case rows remain accessory contamination.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Assert Apple Watch strap/case bundle stays accessory.",
  },
  {
    id: "EXP-SMARTWATCH-CHARGER-05",
    category: "smartwatch_discovered",
    title: "갤럭시워치6 충전기 거치대",
    price: 15_000,
    expected: "accessory",
    reportOnlyBasis: "Smartwatch charger/stand rows are accessory-only.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Assert Galaxy Watch charger/stand title stays accessory.",
  },
  {
    id: "EXP-SMARTWATCH-POSITIVE-06",
    category: "smartwatch_discovered",
    title: "애플워치 울트라2 49mm GPS 셀룰러",
    price: 650_000,
    expected: "normal",
    reportOnlyBasis: "Clear watch body listing with size/connectivity should remain normal.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Control fixture to protect valid smartwatch body candidate.",
  },
  {
    id: "EXP-HEADPHONE-POUCH-LEAK-07",
    category: "headphone_discovered",
    title: "보스 qc45 파우치",
    price: 30_000,
    expected: "accessory",
    reportOnlyBasis: "Headphone case/pouch accessory-only rows must not become matched-SKU candidates.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Add Bose/QC model-code plus pouch-only title as accessory regression.",
  },
  {
    id: "EXP-HEADPHONE-CASE-08",
    category: "headphone_discovered",
    title: "소니 xm5 케이스",
    price: 30_000,
    expected: "accessory",
    reportOnlyBasis: "Headphone case-only rows are negative/hold rows.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Assert Sony XM5 case title stays accessory.",
  },
  {
    id: "EXP-HEADPHONE-POSITIVE-09",
    category: "headphone_discovered",
    title: "보스 QC 울트라 헤드폰 화이트",
    price: 300_000,
    expected: "normal",
    reportOnlyBasis: "Known matched-SKU headphone positive should remain normal.",
    suggestedPatchOwner: "main-agent",
    regressionFixtureProposal: "Control fixture to protect valid Bose QC Ultra headphone title.",
  },
];

function expectedPass(actual: ListingType, expected: ExpectedShape): boolean {
  if (expected === "hold_non_normal") return actual !== "normal";
  return actual === expected;
}

const results = probes.map((probe) => {
  const classified = classifyListing(probe.title, probe.description ?? "", probe.price);
  const matchedSku = ruleMatch(probe.title, probe.description ?? "");
  const parserSku = classified.sku ?? matchedSku;
  const parsed = parseListingOptions({
    title: probe.title,
    description: probe.description ?? "",
    category: parserSku?.category ?? "earphone",
    skuId: parserSku?.id ?? null,
    skuName: parserSku?.modelName ?? null,
  });
  const pass = expectedPass(classified.listingType, probe.expected);
  return {
    ...probe,
    actual: classified.listingType,
    actualSkuId: classified.sku?.id ?? null,
    ruleMatchSkuId: matchedSku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    leak: !pass,
    pass,
  };
});

const leaks = results.filter((row) => row.leak);
const categorySummary = [...new Set(results.map((row) => row.category))].map((category) => {
  const rows = results.filter((row) => row.category === category);
  return {
    category,
    probes: rows.length,
    pass: rows.filter((row) => row.pass).length,
    leak: rows.filter((row) => row.leak).length,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  scope: "runtime_gap_expanded_audit_report_only",
  conclusion: leaks.length > 0
    ? "expanded_runtime_gap_found_headphone_accessory_leak"
    : "expanded_runtime_gap_no_leak_detected",
  boundary: {
    runtimeMutation: false,
    publicPromotion: false,
    candidatePoolWiring: false,
    dbWrite: false,
  },
  metrics: {
    probes: results.length,
    pass: results.filter((row) => row.pass).length,
    leaks: leaks.length,
    categories: categorySummary.length,
  },
  categorySummary,
  results,
  suggestedPatchQueue: leaks.map((row) => ({
    id: row.id,
    category: row.category,
    owner: row.suggestedPatchOwner,
    expected: row.expected,
    actual: row.actual,
    title: row.title,
    proposal: row.regressionFixtureProposal,
  })),
  nextAction: leaks.length > 0
    ? "Prepare headphone runtime patch proposal around case/pouch accessory-only model-code titles."
    : "Proceed to headphone no-mutation runtime dry-run and proposal.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "runtime-gap-expanded-audit-latest.json");
const mdPath = path.join(reportsDir, "runtime-gap-expanded-audit-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Runtime Gap Expanded Audit",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- scope: ${report.scope}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- runtimeMutation: false",
  "- publicPromotion: false",
  "- candidatePoolWiring: false",
  "- dbWrite: false",
  "",
  "## Metrics",
  "",
  `- probes: ${report.metrics.probes}`,
  `- pass: ${report.metrics.pass}`,
  `- leaks: ${report.metrics.leaks}`,
  `- categories: ${report.metrics.categories}`,
  "",
  "## Category Summary",
  "",
  "| category | probes | pass | leak |",
  "| --- | ---: | ---: | ---: |",
  ...categorySummary.map((row) => `| ${row.category} | ${row.probes} | ${row.pass} | ${row.leak} |`),
  "",
  "## Probe Results",
  "",
  "| id | category | expected | actual | sku | comparableKey | needsReview | leak |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...results.map((row) => `| ${row.id} | ${row.category} | ${row.expected} | ${row.actual} | ${row.actualSkuId ?? row.ruleMatchSkuId ?? "null"} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.leak ? "yes" : "no"} |`),
  "",
  "## Suggested Patch Queue",
  "",
  ...(report.suggestedPatchQueue.length > 0
    ? report.suggestedPatchQueue.map((row) => `- ${row.id}: ${row.category}, owner=${row.owner}, expected=${row.expected}, actual=${row.actual}, title=${row.title}`)
    : ["- none"]),
  "",
  "## Regression Fixture Proposal",
  "",
  ...results.map((row) => `- ${row.id}: ${row.regressionFixtureProposal}`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  probes: report.metrics.probes,
  leaks: report.metrics.leaks,
  jsonPath,
  mdPath,
}, null, 2));
