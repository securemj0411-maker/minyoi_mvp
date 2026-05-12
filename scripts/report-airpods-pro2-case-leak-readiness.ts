import fs from "node:fs";
import path from "node:path";

import { classifyListing } from "@/lib/pipeline";
import { parseListingOptions } from "@/lib/option-parser";
import { ruleMatch } from "@/lib/catalog";

type Probe = {
  id: string;
  title: string;
  price: number;
  expectedListingType: string;
  expectedReason: string;
};

const probes: Probe[] = [
  {
    id: "AIRPODS-CASE-LEAK-OBSERVED-01",
    title: "만날로니안 에어팟 프로 2세대 케이스",
    price: 30_000,
    expectedListingType: "accessory",
    expectedReason: "decorative/protective case-only title with AirPods Pro 2 SKU tokens",
  },
  {
    id: "AIRPODS-CASE-LEAK-GENERIC-02",
    title: "에어팟 프로2 케이스",
    price: 20_000,
    expectedListingType: "accessory",
    expectedReason: "plain AirPods Pro 2 case-only title",
  },
  {
    id: "AIRPODS-CASE-LEAK-CHARGING-03",
    title: "에어팟 프로2 충전케이스만",
    price: 60_000,
    expectedListingType: "parts",
    expectedReason: "charging case-only title is not full AirPods product",
  },
  {
    id: "AIRPODS-CASE-CONTROL-FULLSET-04",
    title: "에어팟프로2세대 라이트닝 풀박스 케이스 포함",
    price: 180_000,
    expectedListingType: "normal",
    expectedReason: "full product context with included case accessory",
  },
];

const outputs = probes.map((probe) => {
  const classified = classifyListing(probe.title, "", probe.price);
  const matchedSku = ruleMatch(probe.title, "");
  const parserSku = classified.sku ?? matchedSku;
  const parsed = parseListingOptions({
    title: probe.title,
    description: "",
    category: "earphone",
    skuId: parserSku?.id ?? null,
    skuName: parserSku?.modelName ?? null,
  });
  return {
    ...probe,
    actualListingType: classified.listingType,
    actualSkuId: classified.sku?.id ?? null,
    ruleMatchSkuId: matchedSku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    pass: classified.listingType === probe.expectedListingType,
  };
});

const failed = outputs.filter((row) => !row.pass);

const report = {
  generatedAt: new Date().toISOString(),
  scope: "report_only_no_mutation_airpods_case_leak_readiness",
  observedTitle: "만날로니안 에어팟 프로 2세대 케이스",
  conclusion: failed.length > 0
    ? "runtime_gap_confirmed_report_only_fix_required_before_public_candidate_use"
    : "no_runtime_gap_detected_for_current_probe_set",
  boundary: {
    runtimeMutation: false,
    publicPromotion: false,
    candidatePoolWiring: false,
    dbWrite: false,
  },
  causeHypothesis: [
    "AirPods Pro 2 SKU tokens match before any final product-vs-accessory distinction is preserved.",
    "The current accessory title gate treats product-token followed by accessory-token at title end as included-accessory context.",
    "That broad inclusion pattern suppresses the plain '케이스' accessory hit for titles such as '에어팟 프로2 케이스'.",
    "Option parser then emits an AirPods Pro 2 comparable key with needsReview=false, so parser-only review cannot catch it later.",
  ],
  requiredRuntimeFixDraft: [
    "Separate protective/decorative case-only from included accessory context.",
    "For earphone/AirPods titles, plain title endings like '...케이스', '...case', '...커버' must be accessory unless full-set tokens or explicit 포함/같이/드립니다 context exists.",
    "Keep '케이스 포함', '풀박스 케이스 포함', and full product descriptions normal when SKU and full product signals are present.",
    "Add regression tests for the observed title before enabling any public candidate/runtime approval.",
  ],
  probes: outputs,
};

const outDir = path.join(process.cwd(), "reports");
fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, "airpods-pro2-case-leak-readiness-latest.json");
const mdPath = path.join(outDir, "airpods-pro2-case-leak-readiness-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# AirPods Pro 2 Case Leak Readiness (Report Only)",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- scope: ${report.scope}`,
  `- observedTitle: ${report.observedTitle}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- runtimeMutation: false",
  "- publicPromotion: false",
  "- candidatePoolWiring: false",
  "- dbWrite: false",
  "",
  "## Probe Results",
  "",
  "| id | expected | actual | sku | comparableKey | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...outputs.map((row) => (
    `| ${row.id} | ${row.expectedListingType} | ${row.actualListingType} | ${row.actualSkuId ?? row.ruleMatchSkuId ?? "null"} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`
  )),
  "",
  "## Cause Hypothesis",
  "",
  ...report.causeHypothesis.map((item) => `- ${item}`),
  "",
  "## Required Runtime Fix Draft",
  "",
  ...report.requiredRuntimeFixDraft.map((item) => `- ${item}`),
  "",
  "## Next Step",
  "",
  "- Owner-approved runtime fix should update the AirPods/earphone accessory gate and add regression tests for `AIRPODS-CASE-LEAK-OBSERVED-01` before candidate/public use.",
  "",
];

fs.writeFileSync(mdPath, `${lines.join("\n")}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  failed: failed.length,
  jsonPath,
  mdPath,
}, null, 2));
