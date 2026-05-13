import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = { metrics: ReportMetrics; generatedAt?: string };

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

const DENSITY_FLOOR_COHERENT_CORE = 5;
const DENSITY_FLOOR_PLAIN_BRANCH = 5;
const LEAKAGE_TOLERANCE_BAGGAGE_MULTIPLICITY_MAX = 1.0;
const COVERAGE_FLOOR = 1.0;

async function main(): Promise<void> {
  const thick = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );
  const threeBranch = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition-latest.json",
  );
  const baggage = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition-latest.json",
  );

  const coherentCore = thick.metrics.coherentCoreRows ?? 0;
  const plainBranch = threeBranch.metrics.plainCleanPersonalRows ?? 0;
  const coverage = threeBranch.metrics.branchCoverageOverBase ?? 0;
  const multiplicity = baggage.metrics.baggageMultiplicityPerAdjacent ?? 0;
  const baseRows = thick.metrics.baseRows ?? 0;
  const adjacent = thick.metrics.adjacentRows ?? 0;

  const gapCoherentCore = Math.max(DENSITY_FLOOR_COHERENT_CORE - coherentCore, 0);
  const gapPlainBranch = Math.max(DENSITY_FLOOR_PLAIN_BRANCH - plainBranch, 0);
  const coherentCoreFloorMet = coherentCore >= DENSITY_FLOOR_COHERENT_CORE;
  const plainBranchFloorMet = plainBranch >= DENSITY_FLOOR_PLAIN_BRANCH;
  const coverageMet = coverage >= COVERAGE_FLOOR;
  const baggageMultiplicityClean = multiplicity <= LEAKAGE_TOLERANCE_BAGGAGE_MULTIPLICITY_MAX;
  const allFloorsMet =
    coherentCoreFloorMet && plainBranchFloorMet && coverageMet && baggageMultiplicityClean;

  const reasonsNotMet: string[] = [];
  if (!coherentCoreFloorMet)
    reasonsNotMet.push(
      `coherent_core gap=${gapCoherentCore} (need ${DENSITY_FLOOR_COHERENT_CORE}, have ${coherentCore})`,
    );
  if (!plainBranchFloorMet)
    reasonsNotMet.push(
      `plain_branch gap=${gapPlainBranch} (need ${DENSITY_FLOOR_PLAIN_BRANCH}, have ${plainBranch})`,
    );
  if (!coverageMet)
    reasonsNotMet.push(`branch coverage=${coverage} (need ${COVERAGE_FLOOR})`);
  if (!baggageMultiplicityClean)
    reasonsNotMet.push(
      `baggage multiplicity=${multiplicity} (need ≤ ${LEAKAGE_TOLERANCE_BAGGAGE_MULTIPLICITY_MAX})`,
    );

  const verdict = allFloorsMet
    ? "density_floors_met_design_tiny_owner_review_packet_next"
    : "density_floors_not_met_hold_report_only";

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision:
      "applewatch_series10_46mm_battery90plus_plain_clean_density_floor_watch_report_only",
    floors: {
      coherentCoreRowsRequired: DENSITY_FLOOR_COHERENT_CORE,
      plainBranchRowsRequired: DENSITY_FLOOR_PLAIN_BRANCH,
      branchCoverageRequired: COVERAGE_FLOOR,
      baggageMultiplicityMax: LEAKAGE_TOLERANCE_BAGGAGE_MULTIPLICITY_MAX,
    },
    currentSnapshot: {
      baseRows,
      coherentCoreRows: coherentCore,
      plainBranchRows: plainBranch,
      adjacentRows: adjacent,
      branchCoverageOverBase: coverage,
      baggageMultiplicityPerAdjacent: multiplicity,
    },
    gates: {
      coherentCoreFloorMet,
      plainBranchFloorMet,
      coverageMet,
      baggageMultiplicityClean,
      allFloorsMet,
    },
    gaps: {
      coherentCoreRowsGap: gapCoherentCore,
      plainBranchRowsGap: gapPlainBranch,
    },
    verdict,
    reasonsNotMet,
    upstreamSnapshotAt: {
      thickening: thick.generatedAt ?? null,
      threeBranch: threeBranch.generatedAt ?? null,
      baggage: baggage.generatedAt ?? null,
    },
    policyImplications: [
      "Density floors are explicit gates for designing a tiny owner-review packet. They are NOT gates for runtime widening — runtime stays untouched regardless.",
      `coherent_core gap=${gapCoherentCore}, plain_branch gap=${gapPlainBranch}. while gaps > 0 the lane stays report-only.`,
      "Coverage floor (1.0) means every base row must fall into exactly one of the three sibling branches. ambiguous-context rows reset the gate.",
      "Baggage multiplicity ≤ 1.0 means adjacent rows must carry at most one baggage type each. multi-baggage rows (current state: " +
        multiplicity +
        ") prove the lane is not yet clean.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "rerun this watch weekly against the latest mining snapshot",
      "do not lower the floors to fit a passing reading; raise the row count instead",
      "if a floor is crossed for two consecutive weeks without leakage, design a tiny owner-review packet (still report-only)",
    ],
    doNotDo: [
      "Do not lower the density floors to make the gate pass",
      "Do not treat a single weekly crossing as runtime approval",
      "Do not collapse care/cellular branches to inflate plain branch counts",
      "Do not absorb adjacent rows into coherent_core",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-density-floor-watch-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Plain-Clean Density Floor Watch",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only density floor watch. Tracks coherent_core, plain_branch, coverage, and baggage multiplicity against explicit gates.",
    "",
    "## Floors (explicit, do not lower)",
    "",
    ...Object.entries(report.floors).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Current Snapshot",
    "",
    ...Object.entries(report.currentSnapshot).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Gates",
    "",
    ...Object.entries(report.gates).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Gaps",
    "",
    ...Object.entries(report.gaps).map(([k, v]) => `- ${k}: ${v}`),
    "",
    `## Verdict: ${verdict}`,
    "",
    reasonsNotMet.length === 0
      ? "- all floors met (single reading; still need a second consecutive crossing)"
      : reasonsNotMet.map((l) => `- ${l}`).join("\n"),
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
    `s10 46mm density floor watch: verdict=${verdict}, gaps_core=${gapCoherentCore}, gaps_plain=${gapPlainBranch}, multiplicity=${multiplicity}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
