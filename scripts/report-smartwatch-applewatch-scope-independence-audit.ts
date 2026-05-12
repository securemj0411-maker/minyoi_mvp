import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  content_hash?: string;
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

type ScopeSummary = {
  scope: string;
  rowCount: number;
  merchantLikeRows: number;
  uniquePids: number;
  uniqueContentHashes: number;
  normalizedTitleClusters: number;
};

type PairAudit = {
  leftScope: string;
  rightScope: string;
  sharedPids: number;
  sharedPidShareOfSmaller: number;
  sharedContentHashes: number;
  sharedTitleClusters: number;
  merchantLikeSharedRows: number;
  overlapRisk: "low" | "medium" | "high";
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

function titleFor(sample: Sample): string {
  return (sample.title ?? sample.name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\b(40|41|42|44|45|46|49)mm\b/g, "<SIZE>")
    .replace(/(배터리.*?(?:100%|9[0-9]%|90퍼|100프로))/g, "<BATTERY>")
    .replace(/(스타라이트|미드나이트|실버|블랙|골드|내추럴|제트 블랙|슬레이트)/g, "<COLOR>")
    .replace(/\b(gps\s*\+?\s*cellular|gps|cellular|lte|와이파이\+셀룰러)\b/g, "<NET>")
    .replace(/\s+/g, " ")
    .trim();
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

function riskFor(sharedPidShareOfSmaller: number, merchantLikeSharedRows: number, sharedContentHashes: number): "low" | "medium" | "high" {
  if (sharedPidShareOfSmaller >= 0.5 || merchantLikeSharedRows >= 2 || sharedContentHashes >= 2) return "high";
  if (sharedPidShareOfSmaller >= 0.25 || merchantLikeSharedRows >= 1 || sharedContentHashes >= 1) return "medium";
  return "low";
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter(isAppleWatch).filter((sample) => !globalExclude.test(textFor(sample)));

  const matchedByScope = new Map<string, Sample[]>();
  const summaries: ScopeSummary[] = [];

  for (const spec of scopeSpecs) {
    const matched = rows.filter((sample) => matchesAll(textFor(sample), spec.patterns));
    matchedByScope.set(spec.scope, matched);
    summaries.push({
      scope: spec.scope,
      rowCount: matched.length,
      merchantLikeRows: matched.filter(merchantLike).length,
      uniquePids: new Set(matched.map((row) => String(row.pid ?? ""))).size,
      uniqueContentHashes: new Set(matched.map((row) => row.content_hash).filter(Boolean)).size,
      normalizedTitleClusters: new Set(matched.map((row) => normalizeTitle(titleFor(row)))).size,
    });
  }

  const pairs: PairAudit[] = [];
  for (let i = 0; i < scopeSpecs.length; i += 1) {
    for (let j = i + 1; j < scopeSpecs.length; j += 1) {
      const leftScope = scopeSpecs[i].scope;
      const rightScope = scopeSpecs[j].scope;
      const leftRows = matchedByScope.get(leftScope) ?? [];
      const rightRows = matchedByScope.get(rightScope) ?? [];
      const leftPidSet = new Set(leftRows.map((row) => String(row.pid ?? "")));
      const rightPidSet = new Set(rightRows.map((row) => String(row.pid ?? "")));
      const leftHashSet = new Set(leftRows.map((row) => row.content_hash).filter(Boolean));
      const rightHashSet = new Set(rightRows.map((row) => row.content_hash).filter(Boolean));
      const leftTitleSet = new Set(leftRows.map((row) => normalizeTitle(titleFor(row))));
      const rightTitleSet = new Set(rightRows.map((row) => normalizeTitle(titleFor(row))));

      const sharedPids = [...leftPidSet].filter((pid) => rightPidSet.has(pid));
      const sharedHashes = [...leftHashSet].filter((hash) => rightHashSet.has(hash));
      const sharedTitles = [...leftTitleSet].filter((title) => rightTitleSet.has(title));
      const sharedPidRows = leftRows.filter((row) => sharedPids.includes(String(row.pid ?? "")));
      const smaller = Math.min(leftRows.length || 1, rightRows.length || 1);
      const sharedPidShareOfSmaller = sharedPids.length / smaller;
      const merchantLikeSharedRows = sharedPidRows.filter(merchantLike).length;

      pairs.push({
        leftScope,
        rightScope,
        sharedPids: sharedPids.length,
        sharedPidShareOfSmaller,
        sharedContentHashes: sharedHashes.length,
        sharedTitleClusters: sharedTitles.length,
        merchantLikeSharedRows,
        overlapRisk: riskFor(sharedPidShareOfSmaller, merchantLikeSharedRows, sharedHashes.length),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_scope_independence_audit_report_only",
    metrics: {
      scopeCount: summaries.length,
      pairCount: pairs.length,
      highOverlapPairs: pairs.filter((row) => row.overlapRisk === "high").length,
      mediumOverlapPairs: pairs.filter((row) => row.overlapRisk === "medium").length,
      runtimeApprovedRows: 0,
    },
    summaries,
    pairs,
    policyImplications: [
      "A positive-looking Apple Watch scope can still be weak if the same rows reappear under sibling scopes.",
      "This audit checks whether risky scopes are genuinely independent or mostly re-labeled overlaps.",
      "High overlap or merchant-like shared rows means backlog visibility only, not stronger parser trust.",
      "This audit is report-only and must not change runtime parser, candidate pool, or public promotion behavior.",
    ],
    nextReportOnlyExperiments: [
      "thicken personal-used rows for risky scopes so overlap-heavy slices are not dominated by merchant-like carryover",
      "split overlapping SE3 battery and starlight rows into stricter non-overlapping follow-up buckets",
      "keep Series 7 stainless cellular under dependency watch until overlap and merchant pressure improve",
    ],
    doNotDo: [
      "Do not double-count overlapping scope rows as separate positive density",
      "Do not treat title-cluster overlap as independent supply",
      "Do not runtime-wire any scope from this audit",
      "Do not infer seller identity beyond merchant-like pressure heuristics already in the sample",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-scope-independence-audit-latest.json"), JSON.stringify(report, null, 2));

  const summaryTable = [
    "| scope | rows | merchant_like_rows | unique_pids | unique_content_hashes | normalized_title_clusters |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map(
      (row) =>
        `| ${row.scope} | ${row.rowCount} | ${row.merchantLikeRows} | ${row.uniquePids} | ${row.uniqueContentHashes} | ${row.normalizedTitleClusters} |`,
    ),
  ].join("\n");

  const pairTable = [
    "| left_scope | right_scope | shared_pids | shared_pid_share_of_smaller | shared_hashes | shared_title_clusters | merchant_like_shared_rows | overlap_risk |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...pairs.map(
      (row) =>
        `| ${row.leftScope} | ${row.rightScope} | ${row.sharedPids} | ${row.sharedPidShareOfSmaller.toFixed(2)} | ${row.sharedContentHashes} | ${row.sharedTitleClusters} | ${row.merchantLikeSharedRows} | ${row.overlapRisk} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Scope Independence Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only overlap/independence audit for the currently risky Apple Watch positive scopes.",
    "",
    "## Metrics",
    "",
    `- scope count: ${report.metrics.scopeCount}`,
    `- pair count: ${report.metrics.pairCount}`,
    `- high overlap pairs: ${report.metrics.highOverlapPairs}`,
    `- medium overlap pairs: ${report.metrics.mediumOverlapPairs}`,
    "",
    "## Scope Summaries",
    "",
    summaryTable,
    "",
    "## Pair Audits",
    "",
    pairTable,
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-scope-independence-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-scope-independence-audit-latest.json");
  console.log("wrote reports/smartwatch-applewatch-scope-independence-audit-latest.md");
  console.log(
    `applewatch scope independence: pairs=${report.metrics.pairCount}, high_overlap=${report.metrics.highOverlapPairs}, medium_overlap=${report.metrics.mediumOverlapPairs}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
