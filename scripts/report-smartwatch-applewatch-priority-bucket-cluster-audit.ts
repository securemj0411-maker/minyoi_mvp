import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  content_hash?: string;
  seller?: {
    review_rating?: number | null;
    review_count?: number | null;
    sales_count?: number | null;
    proshop?: boolean | null;
    is_official?: boolean | null;
  };
};

type BucketSpec = {
  scope: string;
  patterns: RegExp[];
};

type ScopeAudit = {
  scope: string;
  count: number;
  uniqueContentHashes: number;
  normalizedTitleClusters: number;
  largestTitleClusterSize: number;
  merchantLikeRows: number;
  proshopRows: number;
  templateRisk: "low" | "medium" | "high";
  samplePids: Array<string | number>;
  sampleTitles: string[];
  dominantNormalizedTitles: string[];
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스|보호필름|스트랩만|충전독|호환)/;

const bucketSpecs: BucketSpec[] = [
  { scope: "se3_unopened_40_44mm", patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b(40|44)mm\b/, /(미개봉|새제품|새상품|미사용|시착만)/] },
  { scope: "se3_40mm_gps_starlight", patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b40mm\b/, /\bgps\b/, /(스타라이트|starlight)/] },
  { scope: "se3_40mm_gps_battery100", patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b40mm\b/, /\bgps\b/, /(배터리.*100%|100프로)/] },
  { scope: "series10_46mm_titanium", patterns: [/(series\s?10|시리즈\s?10|애플워치\s?10)/, /\b46mm\b/, /(티타늄|titanium)/] },
  { scope: "series10_46mm_battery90plus", patterns: [/(series\s?10|시리즈\s?10|애플워치\s?10)/, /\b46mm\b/, /(배터리.*(9[0-9]|100)%|90퍼|100프로)/] },
  { scope: "series7_45mm_stainless_cellular", patterns: [/(series\s?7|시리즈\s?7|애플워치\s?7)/, /\b45mm\b/, /(스테인리스|stainless)/, /(셀룰러|cellular|lte|와이파이\+셀룰러)/] },
  { scope: "series7_45mm_nike", patterns: [/(series\s?7|시리즈\s?7|애플워치\s?7)/, /\b45mm\b/, /(나이키|nike)/] },
  { scope: "series9_45mm_gps_battery90plus", patterns: [/(series\s?9|시리즈\s?9|애플워치\s?9)/, /\b45mm\b/, /\bgps\b/, /(배터리.*(9[0-9]|100)%|90퍼|100프로)/] },
  { scope: "series9_45mm_gps_unopened_like_new", patterns: [/(series\s?9|시리즈\s?9|애플워치\s?9)/, /\b45mm\b/, /\bgps\b/, /(미개봉|거의\s*새제품|3번도\s*착용\s*안|실착7번)/] },
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
  const seller = sample.seller ?? {};
  const reviewCount = Number(seller.review_count ?? 0);
  const salesCount = Number(seller.sales_count ?? 0);
  return Boolean(seller.proshop || seller.is_official || reviewCount >= 30 || salesCount >= 30);
}

function templateRiskFor(count: number, largestClusterSize: number, merchantLikeRows: number): "low" | "medium" | "high" {
  if (count === 0) return "low";
  const clusterShare = largestClusterSize / count;
  const merchantShare = merchantLikeRows / count;
  if (clusterShare >= 0.6 || merchantShare >= 0.6) return "high";
  if (clusterShare >= 0.4 || merchantShare >= 0.4) return "medium";
  return "low";
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const appleWatchRows = samples.filter(isAppleWatch);

  const audits: ScopeAudit[] = bucketSpecs
    .map((spec) => {
      const rows = appleWatchRows.filter((sample) => {
        const text = textFor(sample);
        return !globalExclude.test(text) && matchesAll(text, spec.patterns);
      });
      const normalizedCounts = new Map<string, number>();
      for (const row of rows) {
        const key = normalizeTitle(titleFor(row));
        normalizedCounts.set(key, (normalizedCounts.get(key) ?? 0) + 1);
      }
      const dominantNormalizedTitles = [...normalizedCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([title, count]) => `${count}x ${title}`);
      const uniqueContentHashes = new Set(rows.map((row) => row.content_hash).filter(Boolean)).size;
      const merchantLikeRows = rows.filter(merchantLike).length;
      const proshopRows = rows.filter((row) => Boolean(row.seller?.proshop || row.seller?.is_official)).length;
      const largestTitleClusterSize = normalizedCounts.size === 0 ? 0 : Math.max(...normalizedCounts.values());
      return {
        scope: spec.scope,
        count: rows.length,
        uniqueContentHashes,
        normalizedTitleClusters: normalizedCounts.size,
        largestTitleClusterSize,
        merchantLikeRows,
        proshopRows,
        templateRisk: templateRiskFor(rows.length, largestTitleClusterSize, merchantLikeRows),
        samplePids: rows.slice(0, 5).map((row) => row.pid ?? "-"),
        sampleTitles: rows.slice(0, 5).map(cleanTitle),
        dominantNormalizedTitles,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));

  const highRiskScopes = audits.filter((row) => row.templateRisk === "high").length;
  const mediumRiskScopes = audits.filter((row) => row.templateRisk === "medium").length;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_priority_bucket_cluster_audit_report_only",
    metrics: {
      scopeCount: audits.length,
      highRiskScopes,
      mediumRiskScopes,
      lowRiskScopes: audits.length - highRiskScopes - mediumRiskScopes,
      runtimeApprovedRows: 0,
    },
    audits,
    policyImplications: [
      "Narrow positive buckets can still look stronger than they are if they depend on repeated normalized titles or merchant-like seller patterns.",
      "This audit checks content-hash variety, normalized title cluster concentration, and merchant-like seller pressure before we trust a positive slice too much.",
      "High template-risk scopes should stay backlog hints only until more diverse evidence appears.",
      "This audit is report-only and must not mutate parser or candidate-pool behavior.",
    ],
    nextReportOnlyExperiments: [
      "thicken high-risk scopes with more diverse seller/title evidence before treating them as strong positive density packets",
      "separate merchant-like template clusters from one-off used listings when extending Apple Watch positive buckets",
      "apply the same cluster audit to Galaxy Watch once its positive slices are thicker than one or two rows",
    ],
    doNotDo: [
      "Do not treat merchant-like repetition as supply strength",
      "Do not runtime-wire any scope based on this cluster audit",
      "Do not collapse content-hash diversity into structured parser confidence",
      "Do not ignore small-sample risk just because a bucket sounds plausible",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-priority-bucket-cluster-audit-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | count | unique_content_hashes | normalized_title_clusters | largest_cluster | merchant_like_rows | template_risk | sample_pids | dominant_normalized_titles |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
    ...audits.map(
      (row) =>
        `| ${row.scope} | ${row.count} | ${row.uniqueContentHashes} | ${row.normalizedTitleClusters} | ${row.largestTitleClusterSize} | ${row.merchantLikeRows} | ${row.templateRisk} | ${row.samplePids.join(", ")} | ${row.dominantNormalizedTitles.join("<br>")} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Priority Bucket Cluster Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only audit for seller/template concentration inside Apple Watch narrow positive buckets.",
    "",
    "## Metrics",
    "",
    `- scope count: ${report.metrics.scopeCount}`,
    `- high template-risk scopes: ${report.metrics.highRiskScopes}`,
    `- medium template-risk scopes: ${report.metrics.mediumRiskScopes}`,
    `- low template-risk scopes: ${report.metrics.lowRiskScopes}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-priority-bucket-cluster-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-priority-bucket-cluster-audit-latest.json");
  console.log("wrote reports/smartwatch-applewatch-priority-bucket-cluster-audit-latest.md");
  console.log(`applewatch priority bucket cluster audit: scopes=${report.metrics.scopeCount}, high_risk=${report.metrics.highRiskScopes}, medium_risk=${report.metrics.mediumRiskScopes}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
