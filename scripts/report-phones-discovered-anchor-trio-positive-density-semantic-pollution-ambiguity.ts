import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANCHORS, readAllAnchorSummaries, sumRejectsByLabels, type AnchorKey, type ParseSummary } from "./lib/phones-anchor-trio-mining.js";

const reportsDir = path.join(process.cwd(), "reports");

const POLLUTION_LABELS = ["buying_post", "accessory_only", "broken_or_parts", "refurbished_only", "lost_or_locked"];
const AMBIGUITY_REJECT_PREFIXES = ["price_too_low", "price_too_high"];

function pollutionCount(s: ParseSummary): number {
  return sumRejectsByLabels(s, POLLUTION_LABELS);
}
function missingAcceptCount(s: ParseSummary): number {
  return s.reject_breakdown.filter((r) => r.reason.startsWith("missing_")).reduce((a, r) => a + r.count, 0);
}
function priceAmbiguityCount(s: ParseSummary): number {
  return s.reject_breakdown
    .filter((r) => AMBIGUITY_REJECT_PREFIXES.includes(r.reason))
    .reduce((a, r) => a + r.count, 0);
}

async function main(): Promise<void> {
  const all = await readAllAnchorSummaries();

  type Row = {
    anchor: AnchorKey;
    totalFetched: number;
    parseReady: number;
    positiveDensity: number;
    semanticPollutionCount: number;
    semanticPollutionShare: number;
    ambiguityMissingAcceptCount: number;
    ambiguityMissingAcceptShare: number;
    ambiguityPriceCount: number;
    ambiguityPriceShare: number;
    ambiguityTotalShare: number;
  };

  const rows: Row[] = ANCHORS.map((a) => {
    const s = all[a];
    const t = s.total_fetched;
    const pollution = pollutionCount(s);
    const missingAccept = missingAcceptCount(s);
    const priceAmb = priceAmbiguityCount(s);
    return {
      anchor: a,
      totalFetched: t,
      parseReady: s.parse_ready_count,
      positiveDensity: t > 0 ? Number((s.parse_ready_count / t).toFixed(3)) : 0,
      semanticPollutionCount: pollution,
      semanticPollutionShare: t > 0 ? Number((pollution / t).toFixed(3)) : 0,
      ambiguityMissingAcceptCount: missingAccept,
      ambiguityMissingAcceptShare: t > 0 ? Number((missingAccept / t).toFixed(3)) : 0,
      ambiguityPriceCount: priceAmb,
      ambiguityPriceShare: t > 0 ? Number((priceAmb / t).toFixed(3)) : 0,
      ambiguityTotalShare: t > 0 ? Number(((missingAccept + priceAmb) / t).toFixed(3)) : 0,
    };
  });

  const totals = {
    rows: rows.length,
    sumTotalFetched: rows.reduce((a, r) => a + r.totalFetched, 0),
    sumParseReady: rows.reduce((a, r) => a + r.parseReady, 0),
    sumSemanticPollution: rows.reduce((a, r) => a + r.semanticPollutionCount, 0),
    sumAmbiguityMissingAccept: rows.reduce((a, r) => a + r.ambiguityMissingAcceptCount, 0),
    sumAmbiguityPrice: rows.reduce((a, r) => a + r.ambiguityPriceCount, 0),
  };
  const overallPositiveDensity = totals.sumTotalFetched > 0
    ? Number((totals.sumParseReady / totals.sumTotalFetched).toFixed(3))
    : 0;
  const overallPollutionShare = totals.sumTotalFetched > 0
    ? Number((totals.sumSemanticPollution / totals.sumTotalFetched).toFixed(3))
    : 0;
  const overallAmbiguityShare = totals.sumTotalFetched > 0
    ? Number(((totals.sumAmbiguityMissingAccept + totals.sumAmbiguityPrice) / totals.sumTotalFetched).toFixed(3))
    : 0;

  const interpretations = [
    "positiveDensity is the L1 parse_ready share. low density = either query mining is leaking too many off-target listings (high missing_accept) or the market is genuinely thin.",
    "semanticPollutionShare (buying_post / accessory_only / broken_or_parts / refurbished_only / lost_or_locked) measures how much of fetched volume is fundamentally non-lane noise. these MUST stay rejected even after any future widening.",
    "ambiguityShare combines missing_accept and price_too_low/high. these rows might be on-target but mined-out by accept_all + price band — owner-decision territory for whether to lower bands.",
    "high pollution + high ambiguity + thin parseReady = phones anchor; thickening narrow lanes alone will NOT cross density floors. requires comparable_key axis extension (owner-decision runtime change, not done here).",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "phones_discovered",
    family: "smartphone_anchor_trio",
    anchors: ANCHORS,
    decision: "phones_discovered_anchor_trio_positive_density_semantic_pollution_ambiguity_report_only",
    metrics: {
      ...totals,
      overallPositiveDensity,
      overallPollutionShare,
      overallAmbiguityShare,
      runtimeApprovedRows: 0,
    },
    perAnchor: rows,
    interpretations,
    policyImplications: [
      "semantic pollution is a permanent reject category. it cannot be widened away.",
      "ambiguity (missing_accept + price_too_low/high) is owner-decision territory — do not silently lower mining bands.",
      "positive density gaps are NOT fixable by mining tweaks. they reflect comparable_key being too thin (option-axis inventory).",
      "AI L2 routing remains the only legitimate path for the ambiguity slice.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly refresh: track per-anchor positiveDensity, semanticPollutionShare, ambiguityShare drift",
      "if positiveDensity rises on weekly refresh without a query-band change, that is genuine market thickening — still does NOT authorize runtime widening",
    ],
    doNotDo: [
      "Do not lower price_too_low/high bands to inflate positiveDensity",
      "Do not relax semantic pollution reject_rules to inflate positiveDensity",
      "Do not treat density as a public-promotion gate",
      "Do not public-promote any anchor from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "phones-discovered-anchor-trio-positive-density-semantic-pollution-ambiguity-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Discovered — Anchor Trio Positive Density / Semantic Pollution / Ambiguity",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only decomposition of mining yield into positive density, semantic pollution, and ambiguity for the three anchor lanes.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Per Anchor",
    "",
    "| anchor | total | parseReady | positiveDensity | pollutionShare | ambMissingAcceptShare | ambPriceShare | ambTotalShare |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map(
      (r) =>
        `| ${r.anchor} | ${r.totalFetched} | ${r.parseReady} | ${r.positiveDensity} | ${r.semanticPollutionShare} | ${r.ambiguityMissingAcceptShare} | ${r.ambiguityPriceShare} | ${r.ambiguityTotalShare} |`,
    ),
    "",
    "## Interpretations",
    "",
    ...interpretations.map((l) => `- ${l}`),
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((l) => `- ${l}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((l) => `- ${l}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(
    `phones density/pollution/ambiguity: overallDensity=${overallPositiveDensity}, pollutionShare=${overallPollutionShare}, ambiguityShare=${overallAmbiguityShare}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
