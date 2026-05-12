import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExampleRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  url?: string;
  comparableKey?: string;
  connector?: string;
  generation?: string;
};

type HeadphoneBlockers = {
  category: string;
  currentMetrics: {
    total: number;
    airpodsMax: number;
    airpodsMaxReadyRate: number;
    airpodsMaxUnknownGenerationRate: number;
    airpodsMaxUnknownConnectorRate: number;
  };
  unknownGenerationExamples: ExampleRow[];
  unknownConnectorExamples: ExampleRow[];
};

type EvidenceRow = ExampleRow & {
  reviewClass: string;
  evidenceClass: string;
  reportOnlyAction: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function titleText(row: ExampleRow): string {
  return (row.title ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

function reviewClassFor(row: ExampleRow): string {
  const text = titleText(row);
  const compact = text.replace(/\s+/g, "");
  const hasUsbc = /(usb[-\s]?c|c[-\s]?type|c타입|ctype|c단자|c 타입)/i.test(text);
  const hasLightning = /(라이트닝|lightning|8핀|8 pin|8pin)/i.test(text);
  const hasLegacyColorOnly = /(스페이스\s*그레이|space\s*gray|space\s*grey|실버|silver|스카이\s*블루|sky\s*blue|그린|green|핑크|pink)/i.test(text) && !hasUsbc && !hasLightning;
  const hasOpenBoxOnly = /(미개봉|새상품|새제품|풀박스|풀박|정품)/.test(compact) && !hasUsbc && !hasLightning;

  if (row.connector === "unknown_connector") return "unknown_connector_no_title_token";
  if (hasUsbc) return "explicit_usbc_but_generation_review";
  if (hasLightning) return "explicit_lightning_but_generation_review";
  if (hasLegacyColorOnly) return "legacy_color_only_generation_hold";
  if (hasOpenBoxOnly) return "condition_only_generation_hold";
  return "short_or_ambiguous_generation_hold";
}

function evidenceClassFor(reviewClass: string): string {
  if (reviewClass === "unknown_connector_no_title_token") return "airpods_max_unknown_connector_hold";
  if (reviewClass === "explicit_usbc_but_generation_review") return "airpods_max_usbc_generation_review_gate";
  if (reviewClass === "explicit_lightning_but_generation_review") return "airpods_max_lightning_generation_review_gate";
  if (reviewClass === "legacy_color_only_generation_hold") return "airpods_max_color_only_generation_hold";
  if (reviewClass === "condition_only_generation_hold") return "airpods_max_condition_only_generation_hold";
  return "airpods_max_ambiguous_generation_hold";
}

function actionFor(reviewClass: string): string {
  if (reviewClass === "unknown_connector_no_title_token") return "hold until connector token or external evidence exists";
  if (reviewClass === "explicit_usbc_but_generation_review") return "keep USB-C key separate but do not infer broader generation policy";
  if (reviewClass === "explicit_lightning_but_generation_review") return "keep Lightning key separate but do not infer broader generation policy";
  if (reviewClass === "legacy_color_only_generation_hold") return "do not infer connector/generation from color alone";
  if (reviewClass === "condition_only_generation_hold") return "do not infer connector/generation from sealed/new/fullbox wording";
  return "manual review hold";
}

function dedupe(rows: ExampleRow[]): ExampleRow[] {
  const seen = new Set<string>();
  const result: ExampleRow[] = [];
  for (const row of rows) {
    const key = String(row.pid ?? `${row.title}-${row.connector}-${row.generation}`);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "headphone-matched-sku-blockers-latest.json"), "utf8"),
  ) as HeadphoneBlockers;

  const evidenceRows: EvidenceRow[] = dedupe([
    ...blockers.unknownGenerationExamples,
    ...blockers.unknownConnectorExamples,
  ]).map((row) => {
    const reviewClass = reviewClassFor(row);
    return {
      ...row,
      reviewClass,
      evidenceClass: evidenceClassFor(reviewClass),
      reportOnlyAction: actionFor(reviewClass),
      runtimeApproved: false,
    };
  });

  const unknownConnectorRows = evidenceRows.filter((row) => row.connector === "unknown_connector").length;
  const unknownGenerationRows = evidenceRows.filter((row) => row.generation === "unknown_generation").length;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: blockers.category,
    decision: "airpods_max_review_evidence_report_only",
    sourceReports: ["headphone-matched-sku-blockers-latest.json", "headphone-matched-sku-evidence-matrix-latest.json"],
    metrics: {
      total: blockers.currentMetrics.total,
      airpodsMax: blockers.currentMetrics.airpodsMax,
      airpodsMaxReadyRate: blockers.currentMetrics.airpodsMaxReadyRate,
      airpodsMaxUnknownGenerationRate: blockers.currentMetrics.airpodsMaxUnknownGenerationRate,
      airpodsMaxUnknownConnectorRate: blockers.currentMetrics.airpodsMaxUnknownConnectorRate,
      reviewRows: evidenceRows.length,
      unknownGenerationRows,
      unknownConnectorRows,
      explicitUsbcRows: evidenceRows.filter((row) => row.reviewClass === "explicit_usbc_but_generation_review").length,
      explicitLightningRows: evidenceRows.filter((row) => row.reviewClass === "explicit_lightning_but_generation_review").length,
      colorOnlyRows: evidenceRows.filter((row) => row.reviewClass === "legacy_color_only_generation_hold").length,
      runtimeApprovedRows: evidenceRows.filter((row) => row.runtimeApproved).length,
      reviewClassCounts: countBy(evidenceRows.map((row) => row.reviewClass)),
      connectorCounts: countBy(evidenceRows.map((row) => row.connector ?? "none")),
    },
    evidenceRows,
    policyImplications: [
      "AirPods Max USB-C and Lightning remain separate evidence keys.",
      "Unknown connector rows stay blocked even when title looks like a clean AirPods Max listing.",
      "Color, fullbox, sealed, or purchase wording must not imply generation by itself.",
      "No generation rule or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "keep explicit USB-C and explicit Lightning rows as separate review evidence",
      "use color-only and condition-only rows as negative tests for generation inference",
      "do not infer generation from purchase year alone",
    ],
    doNotDo: [
      "Do not merge AirPods Max Lightning and USB-C",
      "Do not infer generation from color or condition wording",
      "Do not public-promote headphone_discovered",
      "Do not wire candidate pool policy from this evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-airpods-max-review-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | review_class | connector | generation | action | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...evidenceRows.map((row) => (
      `| ${row.pid ?? "-"} | ${row.reviewClass} | ${row.connector ?? "-"} | ${row.generation ?? "-"} | ${row.reportOnlyAction} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`
    )),
  ].join("\n");

  const md = [
    "# Headphone AirPods Max Review Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only AirPods Max review evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- review rows: ${report.metrics.reviewRows}`,
    `- unknown generation rows: ${report.metrics.unknownGenerationRows}`,
    `- unknown connector rows: ${report.metrics.unknownConnectorRows}`,
    `- explicit USB-C rows: ${report.metrics.explicitUsbcRows}`,
    `- explicit Lightning rows: ${report.metrics.explicitLightningRows}`,
    `- color-only rows: ${report.metrics.colorOnlyRows}`,
    "",
    "## Evidence Rows",
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

  await writeFile(path.join(reportsDir, "headphone-airpods-max-review-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-airpods-max-review-evidence-latest.json");
  console.log("wrote reports/headphone-airpods-max-review-evidence-latest.md");
  console.log(`headphone AirPods Max review evidence: review_rows=${evidenceRows.length}, unknown_connector=${unknownConnectorRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
