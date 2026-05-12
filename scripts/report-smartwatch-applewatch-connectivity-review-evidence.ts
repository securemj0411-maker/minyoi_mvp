import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

type EvidenceBucket = {
  scope: string;
  count: number;
  signalSummary: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "smartwatch_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function isAppleWatch(sample: Sample): boolean {
  return /(애플워치|apple\s*watch)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function scopeFor(text: string): string | null {
  if (/(셀룰러(lte)?\s*가입가능|자급제\s*셀룰러모델|gps\s*\+?\s*cellular|셀룰러입니다|셀룰러모델)/.test(text)) {
    return "cellular_ready_or_joinable";
  }
  if (/(셀룰러\s*사용\s*불가|gps용으로\s*사용하셔야|블루투스로만\s*이용|통신사\s*개통\s*제품)/.test(text)) {
    return "cellular_disabled_gps_only_warning";
  }
  if (/(연결\s*해제|계정에서\s*삭제|공장\s*초기화|페어링\s*초기화\s*완료|초기화\s*후\s*바로\s*사용\s*가능|바로\s*페어링해서\s*쓰시면|페어링\s*정상|페어링해제|나의찾기)/.test(text)) {
    return "pairing_reset_ready";
  }
  if (/(gps\s*모델|gps\s*\(와이파이\)\s*모델|블루투스전용|블루투스용|와이파이\s*모델)/.test(text)) {
    return "gps_bluetooth_only_explicit";
  }
  if (/(너무\s*작아서|손작은.*여자분용|small\s*사이즈|밀레니즈\s*루프\s*s사이즈|밴드사이즈\s*m|m\/l사이즈|s사이즈)/.test(text)) {
    return "band_fit_size_context";
  }
  if (/(40\s*41\s*42\s*공용|45\s*44\s*45\s*46\s*49\s*공용|44\s*45\s*46\s*49\s*공용|40-42\s*mm\s*호환|호환은\s*42,44,45\.49)/.test(text)) {
    return "cross_size_compatibility_group";
  }
  return null;
}

function signalSummary(scope: string, rows: Sample[]): string {
  const texts = rows.map(textFor);
  const explicitCellular = texts.filter((text) => /(cellular|셀룰러|lte)/.test(text)).length;
  const gpsOnly = texts.filter((text) => /(gps\s*모델|gps용|블루투스전용|와이파이\s*모델)/.test(text)).length;
  const pairing = texts.filter((text) => /(연결\s*해제|계정에서\s*삭제|공장\s*초기화|페어링|나의찾기)/.test(text)).length;
  return `scope ${scope}, cellular ${explicitCellular}/${rows.length}, gps_only ${gpsOnly}/${rows.length}, pairing_reset ${pairing}/${rows.length}`;
}

function reportOnlyAction(scope: string): string {
  switch (scope) {
    case "cellular_ready_or_joinable":
      return "use as explicit cellular-ready reference only; keep runtime inference deferred";
    case "cellular_disabled_gps_only_warning":
      return "use as counter-signal reference; keep non-cellular review pressure visible";
    case "pairing_reset_ready":
      return "use as pairing-readiness reference only; do not auto-promote body candidates";
    case "gps_bluetooth_only_explicit":
      return "use as gps/bluetooth-only wording reference; keep connectivity parser review-gated";
    case "band_fit_size_context":
      return "use as fit/band-size context reference only; do not merge with case-size certainty";
    default:
      return "use as compatibility-family wording reference only; never infer body candidate from compatibility language alone";
  }
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const appleWatchRows = samples.filter(isAppleWatch);

  const buckets = new Map<string, Sample[]>();
  for (const sample of appleWatchRows) {
    const text = textFor(sample);
    const scope = scopeFor(text);
    if (!scope) continue;
    const rows = buckets.get(scope) ?? [];
    rows.push(sample);
    buckets.set(scope, rows);
  }

  const evidenceRows: EvidenceBucket[] = [...buckets.entries()]
    .map(([scope, rows]) => ({
      scope,
      count: rows.length,
      signalSummary: signalSummary(scope, rows),
      reportOnlyAction: reportOnlyAction(scope),
      samplePids: rows.slice(0, 5).map((sample) => sample.pid ?? "-"),
      sampleTitles: rows.slice(0, 5).map(cleanTitle),
      runtimeApproved: false as const,
    }))
    .sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));

  const metricFor = (scope: string) => evidenceRows.find((row) => row.scope === scope)?.count ?? 0;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_connectivity_review_evidence_report_only",
    metrics: {
      appleWatchRows: appleWatchRows.length,
      cellularReadyRows: metricFor("cellular_ready_or_joinable"),
      cellularWarningRows: metricFor("cellular_disabled_gps_only_warning"),
      pairingResetRows: metricFor("pairing_reset_ready"),
      gpsOnlyRows: metricFor("gps_bluetooth_only_explicit"),
      bandFitRows: metricFor("band_fit_size_context"),
      crossSizeCompatibilityRows: metricFor("cross_size_compatibility_group"),
      scopeCount: evidenceRows.length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Apple Watch connectivity intent is often expressed as activation-readiness, GPS-only warning, or pairing-reset language rather than clean structured fields.",
      "Explicit cellular-ready rows and explicit GPS-only warning rows should be kept together so positive opportunity and review pressure are visible at the same time.",
      "Band-fit and cross-size compatibility wording are fit-context references only; they do not prove body completeness or exact case size.",
      "This report thickens Apple Watch connectivity/fit review evidence only; it does not approve runtime connectivity inference.",
    ],
    nextReportOnlyExperiments: [
      "pair cellular-ready and pairing-reset rows with explicit generation full-set positives for SE3 / Series 10 / Series 7 / Series 9",
      "collect more GPS-only warning rows so cellular-vs-non-cellular contrast is thicker than isolated examples",
      "separate Apple Watch fit-context language from accessory-only strap compatibility posts before any runtime split discussion",
    ],
    doNotDo: [
      "Do not infer cellular availability from Apple Watch family alone",
      "Do not treat pairing-reset language as candidate-pool approval",
      "Do not use band-fit wording as exact case-size certainty",
      "Do not runtime-wire connectivity rules from this report alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-connectivity-review-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | count | signal_summary | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.scope} | ${row.count} | ${row.signalSummary} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Connectivity Review Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Apple Watch connectivity/fit wording evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- apple watch rows scanned: ${report.metrics.appleWatchRows}`,
    `- cellular-ready rows: ${report.metrics.cellularReadyRows}`,
    `- cellular warning rows: ${report.metrics.cellularWarningRows}`,
    `- pairing-reset rows: ${report.metrics.pairingResetRows}`,
    `- gps-only rows: ${report.metrics.gpsOnlyRows}`,
    `- band-fit rows: ${report.metrics.bandFitRows}`,
    `- cross-size compatibility rows: ${report.metrics.crossSizeCompatibilityRows}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-connectivity-review-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-connectivity-review-evidence-latest.json");
  console.log("wrote reports/smartwatch-applewatch-connectivity-review-evidence-latest.md");
  console.log(
    `applewatch connectivity review evidence: cellular_ready=${report.metrics.cellularReadyRows}, pairing_reset=${report.metrics.pairingResetRows}, gps_only=${report.metrics.gpsOnlyRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
