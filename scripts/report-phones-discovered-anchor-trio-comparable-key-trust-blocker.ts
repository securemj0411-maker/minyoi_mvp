import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANCHORS, readAllAnchorSummaries, type AnchorKey, type ParseSummary, sumRejectsByLabels } from "./lib/phones-anchor-trio-mining.js";

const reportsDir = path.join(process.cwd(), "reports");

function carrierRejectSum(s: ParseSummary): number {
  return sumRejectsByLabels(s, ["carrier_skt", "carrier_kt", "carrier_lg", "carrier_locked_generic"]);
}
function silentTrustFactor(s: ParseSummary): number {
  // ratio of carrier-related rejects relative to parse_ready_count — a proxy for how many "near-miss" carrier listings sit one wording away from being absorbed into the lane if self wording were silently inferred.
  return s.parse_ready_count > 0 ? Number((carrierRejectSum(s) / s.parse_ready_count).toFixed(3)) : 0;
}

async function main(): Promise<void> {
  const all = await readAllAnchorSummaries();

  type Row = {
    anchor: AnchorKey;
    totalFetched: number;
    parseReady: number;
    carrierRejectSum: number;
    silentCarrierTrustFactor: number;
    comparableKeyDimensions: number;
    missingAxes: string[];
    laneAcceptAllRegex: string[];
  };

  const rows: Row[] = ANCHORS.map((a) => ({
    anchor: a,
    totalFetched: all[a].total_fetched,
    parseReady: all[a].parse_ready_count,
    carrierRejectSum: carrierRejectSum(all[a]),
    silentCarrierTrustFactor: silentTrustFactor(all[a]),
    comparableKeyDimensions: 3, // family|model|storage
    missingAxes: ["self_unlocked", "carrier", "color", "dual_sim", "esim"],
    laneAcceptAllRegex: all[a].accept_rules.accept_all,
  }));

  const blockers = [
    {
      blocker: "comparable_key is family|model|storage only",
      severity: "high",
      effect: "self, carrier, color, dual_sim, esim variants collapse onto the same comparable_key. price normalization across these variants is incorrect, so the same comparable_key cannot be trusted as a market.",
      transferGuidance: "any future runtime fix is an owner-decision change to option-parser.ts; this packet does not propose it.",
    },
    {
      blocker: "narrow self lane discipline does not extend to comparable_key",
      severity: "high",
      effect: "a row passes narrow mining (self token present, carrier absent) but production parser writes the same comparable_key as a silent-carrier row. trust does not survive the production transfer.",
      transferGuidance: "report-only — must be acknowledged before any future deterministic widening attempt.",
    },
    {
      blocker: "silent state cannot be deterministically inferred",
      severity: "high",
      effect: "LAUNCH_PLAN §12b forbids inferring self/carrier/esim/dual_sim from absence. so comparable_key cannot be enriched deterministically — AI L2 is the only legitimate path.",
      transferGuidance: "phones_discovered narrow lanes route to AI L2 primary; report-only.",
    },
    {
      blocker: "high silentCarrierTrustFactor (carrier rejects ≫ parse_ready) for low-volume anchors",
      severity: "medium",
      effect: rows
        .map((r) => `${r.anchor}: trustFactor=${r.silentCarrierTrustFactor} (carrierRejects=${r.carrierRejectSum} vs parseReady=${r.parseReady})`)
        .join("; "),
      transferGuidance: "low parse_ready anchors (iPhone 13 Pro 128 self) are most exposed to silent-carrier pollution if rules were relaxed.",
    },
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
    decision: "phones_discovered_anchor_trio_comparable_key_trust_blocker_report_only",
    metrics: {
      anchors: rows.length,
      sumTotalFetched: rows.reduce((a, r) => a + r.totalFetched, 0),
      sumParseReady: rows.reduce((a, r) => a + r.parseReady, 0),
      sumCarrierRejects: rows.reduce((a, r) => a + r.carrierRejectSum, 0),
      meanSilentCarrierTrustFactor: Number((rows.reduce((a, r) => a + r.silentCarrierTrustFactor, 0) / rows.length).toFixed(3)),
      comparableKeyDimensionsConstant: 3,
      missingAxesConstant: 5,
      runtimeApprovedRows: 0,
    },
    perAnchor: rows,
    blockers,
    policyImplications: [
      "comparable_key trust is structurally limited to 3 dimensions (family|model|storage). 5 axes are missing.",
      "Even with disciplined narrow lane mining, production comparable_key absorbs silent-state listings that mining rejects — trust does not transfer.",
      "Deterministic widening (e.g. inferring self from carrier absence) is forbidden by LAUNCH_PLAN §12b.",
      "AI L2 is the only legitimate destination for silent-state rows; this is the structural reason phones cannot follow the earphone/smartwatch narrow-lane → tiny-cap-acquisition path without an additional axis-encoding layer.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "rerun this packet whenever option-parser comparable_key construction changes",
      "compare per-anchor silentCarrierTrustFactor over weekly mining refreshes; rising factor = pollution growing",
    ],
    doNotDo: [
      "Do not propose extending comparable_key from this packet — that is a runtime/owner-decision change",
      "Do not relax narrow lane mustContain to absorb silent-state listings",
      "Do not public-promote any anchor based on this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "phones-discovered-anchor-trio-comparable-key-trust-blocker-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Discovered — Anchor Trio Comparable_Key Trust Blocker",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only analysis of why comparable_key cannot be trusted for narrow phones anchors despite disciplined mining.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Per Anchor",
    "",
    "| anchor | totalFetched | parseReady | carrierRejects | silentCarrierTrustFactor |",
    "|---|---:|---:|---:|---:|",
    ...rows.map((r) => `| ${r.anchor} | ${r.totalFetched} | ${r.parseReady} | ${r.carrierRejectSum} | ${r.silentCarrierTrustFactor} |`),
    "",
    "## Blockers",
    "",
    ...blockers.flatMap((b) => [
      `### ${b.blocker}`,
      "",
      `- severity: ${b.severity}`,
      `- effect: ${b.effect}`,
      `- transferGuidance: ${b.transferGuidance}`,
      "",
    ]),
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
    `phones trust-blocker: meanTrustFactor=${report.metrics.meanSilentCarrierTrustFactor}, dims=${report.metrics.comparableKeyDimensionsConstant}, missingAxes=${report.metrics.missingAxesConstant}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
