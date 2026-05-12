import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  seller?: {
    review_count?: number | null;
    sales_count?: number | null;
    proshop?: boolean | null;
    is_official?: boolean | null;
  };
};

type ScopeSpec = {
  scope: string;
  patterns: RegExp[];
};

type ScopeAudit = {
  scope: string;
  totalRows: number;
  merchantLikeRows: number;
  personalLikeRows: number;
  overlapRows: number;
  overlapScopes: string[];
  bundlePayloadRows: number;
  batterySignalRows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  reportOnlyAction: string;
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스|보호필름|스트랩만|충전독|호환)/;

const scopeSpecs: ScopeSpec[] = [
  { scope: "series7_45mm_stainless_cellular", patterns: [/(series\s?7|시리즈\s?7|애플워치\s?7)/, /\b45mm\b/, /(스테인리스|stainless)/, /(셀룰러|cellular|lte|와이파이\+셀룰러)/] },
  { scope: "se3_40mm_gps_starlight", patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b40mm\b/, /\bgps\b/, /(스타라이트|starlight)/] },
  { scope: "se3_40mm_gps_battery100", patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b40mm\b/, /\bgps\b/, /(배터리.*100%|100프로)/] },
];

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function matchesAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

function isAppleWatch(sample: Sample): boolean {
  return /(애플워치|apple\s*watch)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter(isAppleWatch).filter((sample) => !globalExclude.test(textFor(sample)));

  const matchedByScope = new Map<string, Sample[]>();
  for (const spec of scopeSpecs) {
    matchedByScope.set(spec.scope, rows.filter((sample) => matchesAll(textFor(sample), spec.patterns)));
  }

  const audits: ScopeAudit[] = scopeSpecs.map((spec) => {
    const matched = matchedByScope.get(spec.scope) ?? [];
    const matchedPids = new Set(matched.map((row) => String(row.pid ?? "")));
    const overlapScopes = scopeSpecs
      .filter((other) => other.scope !== spec.scope)
      .filter((other) => {
        const otherRows = matchedByScope.get(other.scope) ?? [];
        return otherRows.some((row) => matchedPids.has(String(row.pid ?? "")));
      })
      .map((other) => other.scope);
    const overlapRows = matched.filter((row) =>
      scopeSpecs.some(
        (other) =>
          other.scope !== spec.scope &&
          (matchedByScope.get(other.scope) ?? []).some((otherRow) => String(otherRow.pid ?? "") === String(row.pid ?? "")),
      ),
    ).length;
    const bundlePayloadRows = matched.filter((row) => /(밀레니즈|루프|정품\s*스트랩|스포츠밴드|풀박스|박스|충전기)/.test(textFor(row))).length;
    const batterySignalRows = matched.filter((row) => /(배터리.*(8[5-9]|9[0-9]|100)%|85퍼|90퍼|100프로)/.test(textFor(row))).length;
    const merchantLikeRows = matched.filter(merchantLike).length;
    const personalLikeRows = matched.length - merchantLikeRows;
    return {
      scope: spec.scope,
      totalRows: matched.length,
      merchantLikeRows,
      personalLikeRows,
      overlapRows,
      overlapScopes,
      bundlePayloadRows,
      batterySignalRows,
      samplePids: matched.slice(0, 5).map((row) => row.pid ?? "-"),
      sampleTitles: matched.slice(0, 5).map(cleanTitle),
      reportOnlyAction:
        spec.scope === "series7_45mm_stainless_cellular"
          ? "keep as merchant/personal split risk scope; require personal-used thickening before trusting density"
          : "keep as overlap-aware risk scope; do not over-count if sibling scope reuse is high",
      runtimeApproved: false as const,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_risk_scope_dependency_report_only",
    metrics: {
      scopeCount: audits.length,
      merchantHeavyScopes: audits.filter((row) => row.totalRows > 0 && row.merchantLikeRows / row.totalRows >= 0.5).length,
      overlapHeavyScopes: audits.filter((row) => row.totalRows > 0 && row.overlapRows / row.totalRows >= 0.5).length,
      runtimeApprovedRows: 0,
    },
    audits,
    policyImplications: [
      "Some Apple Watch positive scopes look risky not because they are duplicates, but because they are structurally narrow and merchant-heavy.",
      "SE3 battery and starlight scopes should be read with PID overlap in mind so the same rows are not double-counted as separate density evidence.",
      "Series 7 stainless cellular should be split into merchant-like vs personal-used lanes before we trust it as a strong positive slice.",
      "This dependency audit is report-only and must not change parser/runtime behavior.",
    ],
    nextReportOnlyExperiments: [
      "thicken personal-used Series 7 stainless cellular rows so merchant-heavy pressure drops",
      "separate SE3 starlight unopened and battery100 slices from their shared PID core",
      "add box/warranty/accessory facets before treating battery-positive rows as independent density evidence",
    ],
    doNotDo: [
      "Do not sum overlapping SE3 slices as if they were independent supply pools",
      "Do not trust merchant-heavy slices as broad organic density",
      "Do not runtime-wire any scope from this dependency report",
      "Do not infer seller identity; this only measures merchant-like pressure from available metadata",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-risk-scope-dependency-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | total_rows | merchant_like | personal_like | overlap_rows | overlap_scopes | bundle_payload_rows | battery_signal_rows | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |",
    ...audits.map(
      (row) =>
        `| ${row.scope} | ${row.totalRows} | ${row.merchantLikeRows} | ${row.personalLikeRows} | ${row.overlapRows} | ${row.overlapScopes.join(", ") || "-"} | ${row.bundlePayloadRows} | ${row.batterySignalRows} | ${row.samplePids.join(", ")} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Risk Scope Dependency",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only dependency audit for the risky Apple Watch positive scopes.",
    "",
    "## Metrics",
    "",
    `- scope count: ${report.metrics.scopeCount}`,
    `- merchant-heavy scopes: ${report.metrics.merchantHeavyScopes}`,
    `- overlap-heavy scopes: ${report.metrics.overlapHeavyScopes}`,
    "",
    "## Scope Audits",
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-risk-scope-dependency-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-risk-scope-dependency-latest.json");
  console.log("wrote reports/smartwatch-applewatch-risk-scope-dependency-latest.md");
  console.log(
    `applewatch risk scope dependency: merchant_heavy=${report.metrics.merchantHeavyScopes}, overlap_heavy=${report.metrics.overlapHeavyScopes}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
