import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = { metrics: ReportMetrics; generatedAt?: string; gaps?: Record<string, number>; gates?: Record<string, boolean> };

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const thick = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );
  const baggage = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition-latest.json",
  );
  const floor = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-density-floor-watch-latest.json",
  );
  const overlap = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-coherent-core-vs-adjacent-overlap-latest.json",
  );
  const cleanliness = await readJson<ReportFile>(
    "smartwatch-applewatch-series9-series10-battery90plus-direct-cleanliness-refresh-latest.json",
  );

  const series10Members = [
    "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split",
    "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches",
    "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers",
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening",
    "smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition",
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition",
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-density-floor-watch",
    "smartwatch-applewatch-series10-46mm-battery90plus-coherent-core-vs-adjacent-overlap",
  ];
  const series9Members = [
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-context",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening",
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition",
  ];

  const fixedConclusions = [
    "Series10 46mm plain-clean adjacent slice is a multi-baggage outlier (baggage multiplicity per adjacent = " +
      (baggage?.metrics.baggageMultiplicityPerAdjacent ?? "?") +
      "). Cannot be sorted into any single sibling branch by deterministic rule.",
    "Series10 46mm density floor is NOT met under plain_branch quantity (gap_plain=" +
      (floor?.gaps?.plainBranchRowsGap ?? "?") +
      ", gap_core=" +
      (floor?.gaps?.coherentCoreRowsGap ?? "?") +
      "). coherent_core ⊋ plain_branch (gap=" +
      (overlap?.metrics.coherentCoreOnlyMinusPlainBranch ?? "?") +
      ") — density gate must use plain_branch, not coherent_core.",
    "Series9 45mm GPS and Series10 46mm thicken in different directions (S9 = strap/box/풀박 bundle adjacency; S10 = care/cellular/titanium multi-baggage outlier). Thickening rules CANNOT be shared between generations.",
    "cleanliness refresh winner=" +
      (cleanliness?.metrics.series10CleanRatio ?? "?") +
      " vs " +
      (cleanliness?.metrics.series9CleanRatio ?? "?") +
      " is signal only — NOT a runtime approval.",
  ];

  const holdReasons = [
    "density_floor_not_met_plain_branch",
    "multi_baggage_adjacency_no_single_sibling",
    "coherent_core_vs_plain_branch_gap_present",
    "cross_generation_thickening_rules_incompatible",
    "all_lanes_singleton_tier_sample_size",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "smartwatch_applewatch_series9_series10_hold_family_closure_report_only",
    closure: {
      status: "report_only_hold_family_fixed",
      effectiveAt: new Date().toISOString().slice(0, 10),
      reopenCondition:
        "weekly mining snapshot shows plain_branch ≥ 5 for 2 consecutive weeks AND baggage multiplicity per adjacent ≤ 1.0 AND coherent_core_vs_plain_branch gap = 0. only then a new wave may design a tiny owner-review packet — still report-only.",
    },
    members: {
      series10_46mm_battery90plus: series10Members,
      series9_45mm_gps_battery90plus: series9Members,
      crossGen: [
        "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness",
        "smartwatch-applewatch-series9-series10-battery90plus-direct-cleanliness-refresh",
      ],
    },
    metrics: {
      series10BaseRows: thick?.metrics.baseRows ?? 0,
      series10CoherentCoreRows: thick?.metrics.coherentCoreRows ?? 0,
      series10PlainBranchRows: overlap?.metrics.plainBranchRows ?? 0,
      series10AdjacentRows: thick?.metrics.adjacentRows ?? 0,
      series10BaggageMultiplicity: baggage?.metrics.baggageMultiplicityPerAdjacent ?? 0,
      series10DensityFloorPlainGap: floor?.gaps?.plainBranchRowsGap ?? 0,
      series10DensityFloorCoreGap: floor?.gaps?.coherentCoreRowsGap ?? 0,
      series10CoherentCoreVsPlainBranchGap: overlap?.metrics.coherentCoreOnlyMinusPlainBranch ?? 0,
      series9CleanRatio: cleanliness?.metrics.series9CleanRatio ?? 0,
      series10CleanRatio: cleanliness?.metrics.series10CleanRatio ?? 0,
      memberPackets: series10Members.length + series9Members.length + 2,
      runtimeApprovedRows: 0,
    },
    fixedConclusions,
    holdReasons,
    policyImplications: [
      "Apple Watch Series9 45mm GPS battery90+ and Series10 46mm battery90+ thickening work is closed here. all member packets stay report-only.",
      "No future packet under this family should propose runtime/catalog/parser widening without first crossing the explicit reopen condition.",
      "Cross-generation merging is forbidden. each generation's thickening must be measured independently.",
      "AI L2 escrow remains the only legitimate destination for multi-baggage adjacent rows.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly mining snapshot refresh of S10 thickening / baggage / density-floor / overlap / cleanliness-refresh packets",
      "monitor reopen condition gates; do not preempt them",
      "rotate effort to phones_discovered parser bottleneck wave (Galaxy S23 / iPhone 13 / Galaxy S25)",
    ],
    doNotDo: [
      "Do not propose runtime/catalog/parser changes from any member packet without crossing the reopen condition",
      "Do not merge Series9 and Series10 thickening rules",
      "Do not absorb multi-baggage adjacent rows into coherent_core or plain_branch",
      "Do not public-promote any member packet outcome",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series9-series10-hold-family-closure-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 / Series10 Hold Family Closure",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only closure of the Apple Watch Series9 45mm GPS battery90+ and Series10 46mm battery90+ thickening family. All conclusions below are fixed; reopen requires the explicit gate condition.",
    "",
    "## Closure",
    "",
    `- status: ${report.closure.status}`,
    `- effectiveAt: ${report.closure.effectiveAt}`,
    `- reopenCondition: ${report.closure.reopenCondition}`,
    "",
    "## Members",
    "",
    "### Series10 46mm battery90+",
    ...series10Members.map((m) => `- ${m}`),
    "",
    "### Series9 45mm GPS battery90+",
    ...series9Members.map((m) => `- ${m}`),
    "",
    "### Cross-generation",
    ...report.members.crossGen.map((m) => `- ${m}`),
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Fixed Conclusions",
    "",
    ...fixedConclusions.map((l) => `- ${l}`),
    "",
    "## Hold Reasons",
    "",
    ...holdReasons.map((l) => `- ${l}`),
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
    `smartwatch S9/S10 hold family closure: members=${report.metrics.memberPackets}, plainGap=${report.metrics.series10DensityFloorPlainGap}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
