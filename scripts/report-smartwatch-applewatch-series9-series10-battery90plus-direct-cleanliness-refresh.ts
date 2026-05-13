import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = { metrics: ReportMetrics };

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const baseCleanliness = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.json",
  );
  const s10Clean = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json",
  );
  const s10Branches = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json",
  );
  const s10Thickening = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );
  const s10ThreeBranch = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition-latest.json",
  );
  const s10Baggage = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition-latest.json",
  );
  const s10Floor = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-density-floor-watch-latest.json",
  );
  const s10Overlap = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-coherent-core-vs-adjacent-overlap-latest.json",
  );
  const s9Conditions = await readJson<ReportFile>(
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits-latest.json",
  );
  const s9AdjacentThickening = await readJson<ReportFile>(
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening-latest.json",
  );
  const s9AdjacentComposition = await readJson<ReportFile>(
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition-latest.json",
  );

  const ratio = (a: number, b: number) => (b > 0 ? Number((a / b).toFixed(3)) : 0);

  const s10Base = s10Clean.metrics.baseRows ?? 0;
  const s10Clean_ = s10Clean.metrics.cleanPersonalUsedRows ?? 0;
  const s10Bundle = s10Clean.metrics.bundleRows ?? 0;
  const s10Cellular = s10Clean.metrics.cellularRows ?? 0;
  const s10PlainBranch = s10Branches.metrics.plainCleanPersonalRows ?? 0;
  const s10CareBranch = s10Branches.metrics.careBackedGpsRows ?? 0;
  const s10CellularBranch = s10Branches.metrics.cellularPremiumRows ?? 0;
  const s10CoherentCore = s10Thickening.metrics.coherentCoreRows ?? 0;
  const s10AdjacentRows = s10Thickening.metrics.adjacentRows ?? 0;
  const s10AdjacentClean = s10Thickening.metrics.adjacentCleanCandidateRows ?? 0;
  const s10BranchCoverage = s10ThreeBranch.metrics.branchCoverageOverBase ?? 0;
  const s10BaggageMultiplicity = s10Baggage.metrics.baggageMultiplicityPerAdjacent ?? 0;
  const s10SumBaggageOccurrences = s10Baggage.metrics.sumBaggageOccurrences ?? 0;
  const s10CoherentCoreVsPlainBranchGap = s10Overlap.metrics.coherentCoreOnlyMinusPlainBranch ?? 0;
  const s10DensityFloorAllMet = (s10Floor as unknown as { gates?: { allFloorsMet?: boolean } }).gates?.allFloorsMet ?? false;

  const s9Base = s9Conditions.metrics.totalRows ?? 0;
  const s9Clean = s9Conditions.metrics.cleanPersonalUsedRows ?? 0;
  const s9LightBundle = s9Conditions.metrics.lightBundleRows ?? 0;
  const s9HeavyBundle = s9Conditions.metrics.heavyBundleRows ?? 0;
  const s9CellularConflict = s9Conditions.metrics.cellularConflictRows ?? 0;
  const s9AdjacentBase = s9AdjacentThickening.metrics.baseRows ?? 0;
  const s9CoherentCore = s9AdjacentThickening.metrics.coherentCoreRows ?? 0;
  const s9AdjacentRowsTotal = s9AdjacentThickening.metrics.adjacentRows ?? 0;
  const s9AdjacentBundleRows = s9AdjacentThickening.metrics.adjacentBundleRows ?? 0;
  const s9AdjacentCellularRows = s9AdjacentThickening.metrics.adjacentCellularRows ?? 0;
  const s9StrapOwnerCare = s9AdjacentComposition.metrics.strapOwnerCareRows ?? 0;
  const s9BoxOwnerCare = s9AdjacentComposition.metrics.boxOwnerCareRows ?? 0;

  const winner = (() => {
    const s10Ratio = ratio(s10Clean_, s10Base);
    const s9Ratio = ratio(s9Clean, s9Base);
    if (s10Ratio === s9Ratio) return "tied_at_singleton_scale";
    return s10Ratio > s9Ratio ? "series10_46mm_cleaner_density" : "series9_45mm_cleaner_density";
  })();

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision:
      "applewatch_series9_series10_battery90plus_direct_cleanliness_refresh_report_only",
    refresh: {
      basePacket:
        "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.json",
      basePacketGeneratedAt: (baseCleanliness as { generatedAt?: string }).generatedAt ?? null,
      addsCoherentCore: true,
      addsAdjacencyComposition: true,
      addsBranchCoverage: true,
    },
    metrics: {
      series10BaseRows: s10Base,
      series10CleanPersonalUsedRows: s10Clean_,
      series10CleanRatio: ratio(s10Clean_, s10Base),
      series10BundleRows: s10Bundle,
      series10CellularRows: s10Cellular,
      series10PlainBranchRows: s10PlainBranch,
      series10CareBackedGpsRows: s10CareBranch,
      series10CellularPremiumRows: s10CellularBranch,
      series10CoherentCoreRows: s10CoherentCore,
      series10AdjacentRows: s10AdjacentRows,
      series10AdjacentCleanCandidateRows: s10AdjacentClean,
      series10BranchCoverageOverBase: s10BranchCoverage,
      series10BaggageMultiplicityPerAdjacent: s10BaggageMultiplicity,
      series10SumBaggageOccurrences: s10SumBaggageOccurrences,
      series10CoherentCoreVsPlainBranchGap: s10CoherentCoreVsPlainBranchGap,
      series10DensityFloorAllMet: s10DensityFloorAllMet ? 1 : 0,
      series9BaseRows: s9Base,
      series9CleanPersonalUsedRows: s9Clean,
      series9CleanRatio: ratio(s9Clean, s9Base),
      series9LightBundleRows: s9LightBundle,
      series9HeavyBundleRows: s9HeavyBundle,
      series9CellularConflictRows: s9CellularConflict,
      series9AdjacentBaseRows: s9AdjacentBase,
      series9CoherentCoreRows: s9CoherentCore,
      series9AdjacentRowsTotal: s9AdjacentRowsTotal,
      series9AdjacentBundleRows: s9AdjacentBundleRows,
      series9AdjacentCellularRows: s9AdjacentCellularRows,
      series9StrapOwnerCareRows: s9StrapOwnerCare,
      series9BoxOwnerCareRows: s9BoxOwnerCare,
      runtimeApprovedRows: 0,
    },
    cleanlinessVerdict: {
      winner,
      reason:
        "ratio comparison at singleton-tier scale; both lanes need density before any deterministic move.",
      caveat:
        "verdict is purely report-only and based on tiny samples. do not interpret as a recommendation to widen either lane.",
    },
    policyImplications: [
      "Refresh adds coherent-core, adjacency, and branch coverage dimensions to the legacy cleanliness packet which only compared baseRows and clean ratio.",
      "Both Series9 and Series10 lanes are still singleton-tier. cleanliness verdict is signal, not decision.",
      "Series10 adjacency leans care/cellular; Series9 adjacency leans bundle (strap/box/풀박). they thicken in different directions, so they cannot share thickening rules.",
      "Series10 baggage multiplicity per adjacent = " + s10BaggageMultiplicity + " — multi-baggage adjacent rows cannot be absorbed into any single sibling branch by deterministic rule.",
      "Series10 coherent_core ↔ plain_branch gap = " + s10CoherentCoreVsPlainBranchGap + " — coherent_core is the looser set; plain_branch is the density gate quantity.",
      "Series10 density floors allMet = " + s10DensityFloorAllMet + ". gate remains report-only regardless.",
      "branch coverage over base for Series10 = " + s10BranchCoverage + ". gaps stay ambiguous, owned by AI L2 escrow, not deterministic widening.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly refresh: re-run this packet against latest mining snapshots to track per-generation cleanliness drift",
      "track per-generation coherent-core vs adjacent split — the moment coherent core hits 5+ rows without leakage, design a tiny owner-review packet (report-only)",
      "keep S9 and S10 thickening separate; never merge generation evidence",
    ],
    doNotDo: [
      "Do not treat cleanliness verdict as runtime approval",
      "Do not merge S9 and S10 lanes",
      "Do not public-promote either lane based on cleanliness ratio alone",
      "Do not widen deterministic rules with adjacency rows",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series9-series10-battery90plus-direct-cleanliness-refresh-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 ↔ Series10 Battery90+ Direct Cleanliness Refresh",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only refresh of the cross-generation cleanliness comparison. Adds coherent-core, adjacency, and three-branch coverage dimensions.",
    "",
    `- basePacket: ${report.refresh.basePacket}`,
    `- basePacketGeneratedAt: ${report.refresh.basePacketGeneratedAt}`,
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Cleanliness Verdict",
    "",
    `- winner: ${report.cleanlinessVerdict.winner}`,
    `- reason: ${report.cleanlinessVerdict.reason}`,
    `- caveat: ${report.cleanlinessVerdict.caveat}`,
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
    `cleanliness refresh: winner=${winner}, s10_ratio=${report.metrics.series10CleanRatio}, s9_ratio=${report.metrics.series9CleanRatio}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
