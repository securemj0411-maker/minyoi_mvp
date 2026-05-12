import fs from "node:fs";
import path from "node:path";

import { classifyListing } from "@/lib/pipeline";
import { parseListingOptions } from "@/lib/option-parser";
import { ruleMatch } from "@/lib/catalog";

type Probe = {
  id: string;
  category: string;
  title: string;
  price: number;
  expectedRuntimeShape: "normal" | "accessory" | "parts" | "unknown_or_hold";
  why: string;
};

type ReportSummary = {
  file: string;
  category: string;
  runtimeApprovedRows: number | null;
  publicPromotion: boolean | null;
  runtimeCatalogApply: boolean | null;
  conclusion: string | null;
};

const reportsDir = path.join(process.cwd(), "reports");

const reportFiles = [
  "earphone-airpods-implementation-prep-latest.json",
  "headphone-matched-sku-implementation-prep-latest.json",
  "headphone-report-only-final-readiness-audit-latest.json",
  "monitor-model-code-implementation-prep-latest.json",
  "desktop-cpu-gpu-implementation-prep-latest.json",
  "game-console-body-narrow-implementation-prep-latest.json",
  "camera-package-signal-boundary-evidence-latest.json",
  "smartwatch-ambiguity-evidence-matrix-latest.json",
  "speaker-portable-model-subset-boundary-evidence-latest.json",
  "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json",
];

function readJson(file: string): Record<string, unknown> | null {
  const fullPath = path.join(reportsDir, file);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as Record<string, unknown>;
}

function boolAt(obj: Record<string, unknown>, key: string): boolean | null {
  const direct = obj[key];
  if (typeof direct === "boolean") return direct;
  const boundary = obj.boundary;
  if (boundary && typeof boundary === "object" && key in boundary) {
    const value = (boundary as Record<string, unknown>)[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function runtimeApprovedRowsOf(obj: Record<string, unknown>): number | null {
  const metrics = obj.metrics;
  if (metrics && typeof metrics === "object") {
    const value = (metrics as Record<string, unknown>).runtimeApprovedRows;
    if (typeof value === "number") return value;
  }
  return null;
}

function categoryOf(file: string, obj: Record<string, unknown>): string {
  const category = obj.category;
  if (typeof category === "string") return category;
  return file.replace(/-(implementation-prep|evidence-matrix|final-readiness-audit|boundary-evidence).*$/, "");
}

const reportSummaries: ReportSummary[] = reportFiles
  .map((file) => {
    const json = readJson(file);
    if (!json) return null;
    return {
      file,
      category: categoryOf(file, json),
      runtimeApprovedRows: runtimeApprovedRowsOf(json),
      publicPromotion: boolAt(json, "publicPromotion"),
      runtimeCatalogApply: boolAt(json, "runtimeCatalogApply"),
      conclusion: typeof json.conclusion === "string" ? json.conclusion : null,
    };
  })
  .filter((row): row is ReportSummary => row !== null);

const probes: Probe[] = [
  {
    id: "RUNTIME-GAP-AIRPODS-CASE-01",
    category: "earphone_airpods",
    title: "만날로니안 에어팟 프로 2세대 케이스",
    price: 30_000,
    expectedRuntimeShape: "accessory",
    why: "report-only AirPods policy says case/accessory-only rows must not become candidates",
  },
  {
    id: "RUNTIME-GAP-AIRPODS-POSITIVE-02",
    category: "earphone_airpods",
    title: "에어팟프로2세대 라이트닝 풀박스 판매합니다",
    price: 170_000,
    expectedRuntimeShape: "normal",
    why: "full product context should remain normal",
  },
  {
    id: "RUNTIME-GAP-HEADPHONE-CASE-03",
    category: "headphone_discovered",
    title: "에어팟 맥스1 소닉스 산리오 쿠로미 케이스 Airpods Max case",
    price: 35_000,
    expectedRuntimeShape: "accessory",
    why: "headphone report-only guardrails say AirPods Max case rows are negative-hold",
  },
  {
    id: "RUNTIME-GAP-HEADPHONE-POSITIVE-04",
    category: "headphone_discovered",
    title: "소니 xm5 헤드셋 판매합니다",
    price: 250_000,
    expectedRuntimeShape: "normal",
    why: "known matched-SKU positive row from headphone report-only packet",
  },
];

const probeResults = probes.map((probe) => {
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
  const expectedMatches =
    probe.expectedRuntimeShape === "unknown_or_hold"
      ? classified.listingType !== "normal"
      : classified.listingType === probe.expectedRuntimeShape;
  return {
    ...probe,
    actualListingType: classified.listingType,
    actualSkuId: classified.sku?.id ?? null,
    ruleMatchSkuId: matchedSku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    pass: expectedMatches,
  };
});

const runtimeApprovedTotal = reportSummaries.reduce((sum, row) => sum + (row.runtimeApprovedRows ?? 0), 0);
const publicPromotionTrue = reportSummaries.filter((row) => row.publicPromotion === true).length;
const runtimeApplyTrue = reportSummaries.filter((row) => row.runtimeCatalogApply === true).length;
const failedProbes = probeResults.filter((row) => !row.pass);

const report = {
  generatedAt: new Date().toISOString(),
  scope: "report_only_runtime_application_gap_audit",
  conclusion: failedProbes.length > 0
    ? "report_only_policies_not_runtime_applied_runtime_leak_risk_confirmed"
    : "report_only_boundaries_confirmed_no_probe_leak_detected",
  boundary: {
    runtimeMutation: false,
    publicPromotion: false,
    candidatePoolWiring: false,
    dbWrite: false,
  },
  summary: {
    auditedReportFiles: reportSummaries.length,
    runtimeApprovedTotal,
    publicPromotionTrue,
    runtimeApplyTrue,
    failedRuntimeProbes: failedProbes.length,
  },
  answer: [
    "Report-only/parser-candidate work does not update production runtime by itself.",
    "The observed AirPods case leak is consistent with that gap: report policy says exclude, but current runtime still classifies it as normal.",
    "This can happen in other categories wherever report-only guardrails are not wired into pipeline/catalog/option parser/candidate pool.",
    "Runtime fixes require explicit approval because they touch src runtime behavior and can change candidate visibility.",
  ],
  reportSummaries,
  probeResults,
  nextAction: "owner-approved runtime patch queue should start with AirPods/earphone accessory case gate regression, then repeat category probes before public/candidate wiring",
};

const jsonPath = path.join(reportsDir, "runtime-application-gap-audit-latest.json");
const mdPath = path.join(reportsDir, "runtime-application-gap-audit-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Runtime Application Gap Audit",
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
  "## Direct Answer",
  "",
  ...report.answer.map((line) => `- ${line}`),
  "",
  "## Summary",
  "",
  `- auditedReportFiles: ${report.summary.auditedReportFiles}`,
  `- runtimeApprovedTotal: ${report.summary.runtimeApprovedTotal}`,
  `- publicPromotionTrue: ${report.summary.publicPromotionTrue}`,
  `- runtimeApplyTrue: ${report.summary.runtimeApplyTrue}`,
  `- failedRuntimeProbes: ${report.summary.failedRuntimeProbes}`,
  "",
  "## Runtime Probes",
  "",
  "| id | expected | actual | sku | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- |",
  ...probeResults.map((row) => `| ${row.id} | ${row.expectedRuntimeShape} | ${row.actualListingType} | ${row.actualSkuId ?? row.ruleMatchSkuId ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`),
  "",
  "## Report-Only Inputs",
  "",
  "| file | runtimeApprovedRows | publicPromotion | runtimeCatalogApply |",
  "| --- | --- | --- | --- |",
  ...reportSummaries.map((row) => `| ${row.file} | ${row.runtimeApprovedRows ?? "n/a"} | ${row.publicPromotion ?? "n/a"} | ${row.runtimeCatalogApply ?? "n/a"} |`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  failedRuntimeProbes: failedProbes.length,
  runtimeApprovedTotal,
  jsonPath,
  mdPath,
}, null, 2));
