import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANCHORS } from "./lib/phones-anchor-trio-mining.js";

const reportsDir = path.join(process.cwd(), "reports");

type ReportFile = { metrics: Record<string, number>; perAnchor?: unknown };

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const inventory = await readJson<ReportFile>("phones-discovered-anchor-trio-option-axis-inventory-latest.json");
  const trustBlocker = await readJson<ReportFile>("phones-discovered-anchor-trio-comparable-key-trust-blocker-latest.json");
  const signalCarrier = await readJson<ReportFile>("phones-discovered-anchor-trio-title-vs-description-signal-carrier-latest.json");
  const density = await readJson<ReportFile>(
    "phones-discovered-anchor-trio-positive-density-semantic-pollution-ambiguity-latest.json",
  );
  const comparison = await readJson<ReportFile>(
    "phones-discovered-anchor-trio-shared-vs-per-model-bottleneck-comparison-latest.json",
  );

  const claim =
    "phones_discovered narrow anchor trio (Galaxy S23 Ultra 256 self / iPhone 13 Pro 128 self / Galaxy S25 Ultra 256 self) is NOT ready for the earphone/smartwatch-style narrow-lane → tiny-cap-acquisition path. the core blocker is trusted comparable_key insufficiency (only 1 of 7 option axes encoded), not data volume or query mining discipline.";

  const evidenceChain = [
    {
      step: 1,
      claim:
        "comparable_key is structurally thin: family|model|storage only — 5 of 7 inventoried axes are absent.",
      source: "phones-discovered-anchor-trio-option-axis-inventory",
      metric: `axesInComparableKey=${inventory?.metrics.axesInComparableKey ?? "?"}, axesAbsent=${inventory?.metrics.axesAbsent ?? "?"}, axesCatalogOnly=${inventory?.metrics.axesInCatalogOnly ?? "?"}`,
    },
    {
      step: 2,
      claim:
        "narrow self lane mining cannot extend comparable_key — silent-state listings collapse onto explicit-self comparable_key in production.",
      source: "phones-discovered-anchor-trio-comparable-key-trust-blocker",
      metric: `meanSilentCarrierTrustFactor=${trustBlocker?.metrics.meanSilentCarrierTrustFactor ?? "?"}, comparableKeyDimensionsConstant=${trustBlocker?.metrics.comparableKeyDimensionsConstant ?? "?"}`,
    },
    {
      step: 3,
      claim:
        "title-side parse_ready is the L1 ceiling. description-only signals are UNMEASURED at L1 and must be owned by AI L2.",
      source: "phones-discovered-anchor-trio-title-vs-description-signal-carrier",
      metric: `titleAcceptShareOverall=${signalCarrier?.metrics.titleAcceptShareOverall ?? "?"}, descriptionOnlySignalMeasured=${signalCarrier?.metrics.descriptionOnlySignalMeasured ?? "?"}`,
    },
    {
      step: 4,
      claim:
        "positive density is bounded; semantic pollution and ambiguity slices are permanent (cannot be widened away).",
      source: "phones-discovered-anchor-trio-positive-density-semantic-pollution-ambiguity",
      metric: `overallPositiveDensity=${density?.metrics.overallPositiveDensity ?? "?"}, overallPollutionShare=${density?.metrics.overallPollutionShare ?? "?"}, overallAmbiguityShare=${density?.metrics.overallAmbiguityShare ?? "?"}`,
    },
    {
      step: 5,
      claim:
        "shared structural bottlenecks dominate the trio; model-specific bottlenecks are real but secondary. fixing per-model alone does not unblock readiness.",
      source: "phones-discovered-anchor-trio-shared-vs-per-model-bottleneck-comparison",
      metric: `sharedHigh=${comparison?.metrics.sharedHigh ?? "?"}, sharedMedium=${comparison?.metrics.sharedMedium ?? "?"}, perModelOnly=${comparison?.metrics.perModelOnly ?? "?"}`,
    },
  ];

  const conclusion = {
    headline:
      "phones_discovered anchor trio = report-only AI L2 candidate family; deterministic ready promotion is blocked structurally, not by data volume.",
    rootCauseRanking: [
      "(1) comparable_key thin axis encoding (storage only) — primary, structural",
      "(2) silent-state rows (carrier/self/eSIM/dual_sim) cannot be deterministically inferred per LAUNCH_PLAN §12b — primary, policy",
      "(3) description-only signal coverage unmeasured at L1 — secondary, observability gap",
      "(4) per-model edges (S25 missing_accept, iPhone 13 thin parse_ready) — secondary, lane-local",
      "(5) permanent pollution + ambiguity slices — baseline floor, not a blocker per se",
    ],
    laneClassification: {
      iphone_13_pro_128gb_self: "C/D — open-vocabulary + low parse_ready; AI L2 primary",
      galaxy_s23_ultra_256_self: "C — open-vocabulary structured; AI L2 primary",
      galaxy_s25_ultra_256_self: "C — open-vocabulary structured; AI L2 primary",
    },
    forbiddenMoves: [
      "Do not infer silent self / silent carrier / silent eSIM / silent dual_sim and absorb deterministically.",
      "Do not lower narrow-lane mining accept_all to absorb description-only or silent-state listings.",
      "Do not propose comparable_key axis extensions from this packet — that is a future runtime/owner-decision change.",
      "Do not public-promote any of the three anchors as a deterministic lane.",
    ],
    ownerDecisionsNeededLater: [
      "(A) extend option-parser comparable_key with carrier/self_unlocked/esim/dual_sim/color axes (runtime change — out of scope this wave)",
      "(B) define AI L2 phones routing policy and cost envelope",
      "(C) instrument production parser to measure title vs description token positions for future packet measurability",
      "(D) decide whether per-model catalog edges are worth incremental tightening despite shared bottleneck dominance",
    ],
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "phones_discovered",
    family: "smartphone_anchor_trio",
    anchors: ANCHORS,
    decision: "phones_discovered_anchor_trio_parser_bottleneck_summary_report_only",
    claim,
    metrics: {
      evidenceSteps: evidenceChain.length,
      memberPackets: 5,
      sumTotalFetched: trustBlocker?.metrics.sumTotalFetched ?? null,
      sumParseReady: trustBlocker?.metrics.sumParseReady ?? null,
      overallPositiveDensity: density?.metrics.overallPositiveDensity ?? null,
      meanSilentCarrierTrustFactor: trustBlocker?.metrics.meanSilentCarrierTrustFactor ?? null,
      runtimeApprovedRows: 0,
    },
    evidenceChain,
    conclusion,
    policyImplications: [
      "This summary fixes the phones_discovered anchor trio conclusion at report-only AI L2 candidate. it is the parser_bottleneck verdict for this wave.",
      "Future waves may propose runtime / catalog / parser changes — they need explicit owner approval and a fresh wave entry; this summary does NOT authorize them.",
      "Earphone/smartwatch-style narrow-lane → tiny-cap-acquisition pipeline does NOT apply here without comparable_key axis extension.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly refresh of all 5 member packets to track structural drift",
      "future wave: AI L2 phones routing design (report-only first)",
      "future wave: production parser instrumentation design (report-only first)",
    ],
    doNotDo: [
      "Do not promote any phones anchor to ready from this packet",
      "Do not propose runtime / catalog / parser changes from this packet",
      "Do not collapse silent-state rows into deterministic comparable_key",
      "Do not public-promote anything from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "phones-discovered-anchor-trio-parser-bottleneck-summary-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Discovered — Anchor Trio Parser Bottleneck Summary",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only summary of the phones_discovered anchor trio parser bottleneck wave. Fixes the verdict for this wave.",
    "",
    "## Claim",
    "",
    `- ${claim}`,
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Evidence Chain",
    "",
    ...evidenceChain.flatMap((e) => [
      `### Step ${e.step}: ${e.claim}`,
      "",
      `- source: ${e.source}`,
      `- metric: ${e.metric}`,
      "",
    ]),
    "## Conclusion",
    "",
    `- headline: ${conclusion.headline}`,
    "",
    "### Root Cause Ranking",
    "",
    ...conclusion.rootCauseRanking.map((l) => `- ${l}`),
    "",
    "### Lane Classification",
    "",
    ...Object.entries(conclusion.laneClassification).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "### Forbidden Moves",
    "",
    ...conclusion.forbiddenMoves.map((l) => `- ${l}`),
    "",
    "### Owner Decisions Needed Later",
    "",
    ...conclusion.ownerDecisionsNeededLater.map((l) => `- ${l}`),
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
  console.log(`phones parser-bottleneck-summary: evidenceSteps=${evidenceChain.length}, memberPackets=5`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
