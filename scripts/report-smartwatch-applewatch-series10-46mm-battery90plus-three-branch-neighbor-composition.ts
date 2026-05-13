import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = { metrics: ReportMetrics };

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const branches = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json",
  );
  const signals = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json",
  );
  const thick = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );

  const baseRows = branches.metrics.baseRows ?? 0;
  const plainClean = branches.metrics.plainCleanPersonalRows ?? 0;
  const careBackedGps = branches.metrics.careBackedGpsRows ?? 0;
  const cellularPremium = branches.metrics.cellularPremiumRows ?? 0;
  const titlePlain = signals.metrics.titlePlainBranchRows ?? 0;
  const descOnlyGps = signals.metrics.descriptionOnlyGpsRows ?? 0;
  const descOnlyCare = signals.metrics.descriptionOnlyCareBranchRows ?? 0;
  const titleCellularPremium = signals.metrics.titleCellularPremiumRows ?? 0;
  const descOnlyCellularPremium = signals.metrics.descriptionOnlyCellularPremiumRows ?? 0;
  const coherentCore = thick.metrics.coherentCoreRows ?? 0;
  const adjacentCare = thick.metrics.adjacentCareRows ?? 0;
  const adjacentCellular = thick.metrics.adjacentCellularRows ?? 0;
  const adjacentBundle = thick.metrics.adjacentBundleRows ?? 0;
  const adjacentTitanium = thick.metrics.adjacentTitaniumRows ?? 0;

  type Branch = {
    branch: string;
    baseRows: number;
    titleSignalRows: number;
    descriptionOnlySignalRows: number;
    neighborCareRows: number;
    neighborCellularRows: number;
    neighborBundleRows: number;
    neighborTitaniumRows: number;
    note: string;
  };

  const plain: Branch = {
    branch: "plain_clean_personal",
    baseRows: plainClean,
    titleSignalRows: titlePlain,
    descriptionOnlySignalRows: descOnlyGps,
    neighborCareRows: adjacentCare,
    neighborCellularRows: adjacentCellular,
    neighborBundleRows: adjacentBundle,
    neighborTitaniumRows: adjacentTitanium,
    note: "tightest branch. title-plain + GPS personal use. neighbors are siblings, not extensions.",
  };
  const care: Branch = {
    branch: "care_backed_gps",
    baseRows: careBackedGps,
    titleSignalRows: Math.max(careBackedGps - descOnlyCare, 0),
    descriptionOnlySignalRows: descOnlyCare,
    neighborCareRows: 0,
    neighborCellularRows: 0,
    neighborBundleRows: 0,
    neighborTitaniumRows: 0,
    note: "owner-care wording (AppleCare / 보증) on top of GPS. separate price normalization expected.",
  };
  const cellular: Branch = {
    branch: "cellular_premium",
    baseRows: cellularPremium,
    titleSignalRows: titleCellularPremium,
    descriptionOnlySignalRows: descOnlyCellularPremium,
    neighborCareRows: 0,
    neighborCellularRows: 0,
    neighborBundleRows: 0,
    neighborTitaniumRows: 0,
    note: "cellular / 티타늄 / premium framing. distinct price tier; never absorbed into plain.",
  };

  const sumBranches = plain.baseRows + care.baseRows + cellular.baseRows;
  const branchCoverageOverBase = baseRows > 0 ? Number((sumBranches / baseRows).toFixed(3)) : 0;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision:
      "applewatch_series10_46mm_battery90plus_three_branch_neighbor_composition_report_only",
    metrics: {
      baseRows,
      coherentCoreRows: coherentCore,
      plainCleanPersonalRows: plain.baseRows,
      careBackedGpsRows: care.baseRows,
      cellularPremiumRows: cellular.baseRows,
      sumBranchRows: sumBranches,
      branchCoverageOverBase,
      titlePlainBranchRows: titlePlain,
      titleCellularPremiumRows: titleCellularPremium,
      descriptionOnlyGpsRows: descOnlyGps,
      descriptionOnlyCareBranchRows: descOnlyCare,
      descriptionOnlyCellularPremiumRows: descOnlyCellularPremium,
      runtimeApprovedRows: 0,
    },
    branches: [plain, care, cellular],
    policyImplications: [
      "Three branches are sibling lanes, not extensions. Each owns its own price normalization.",
      "plain_clean_personal is the only branch with a chance of becoming the coherent runtime lane; the other two must stay report-only siblings.",
      "branch coverage over base = " + branchCoverageOverBase + ". gaps mean rows fell into none of the three branches (ambiguous-context, deferred).",
      "neighbor composition is owned by the plain branch only — care and cellular do not borrow neighbors from plain.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly snapshot: track per-branch baseRows + title vs description-only signal split",
      "if plain branch passes 5 rows without leaking into care/cellular wording, design a tiny owner-review packet (still report-only)",
      "watch for ambiguous rows that fall outside all three branches — those become AI L2 escrow candidates, never deterministic widening",
    ],
    doNotDo: [
      "Do not merge any two branches into a single deterministic lane",
      "Do not borrow neighbor evidence across branches",
      "Do not treat description-only signals as title-grade evidence",
      "Do not public-promote any branch from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Three-Branch Neighbor Composition",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only composition of the three sibling branches (plain_clean_personal / care_backed_gps / cellular_premium) and the neighbor evidence each owns.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Branches",
    "",
    ...report.branches.flatMap((b) => [
      `### ${b.branch}`,
      "",
      `- baseRows: ${b.baseRows}`,
      `- titleSignalRows: ${b.titleSignalRows}`,
      `- descriptionOnlySignalRows: ${b.descriptionOnlySignalRows}`,
      `- neighborCareRows: ${b.neighborCareRows}`,
      `- neighborCellularRows: ${b.neighborCellularRows}`,
      `- neighborBundleRows: ${b.neighborBundleRows}`,
      `- neighborTitaniumRows: ${b.neighborTitaniumRows}`,
      `- note: ${b.note}`,
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
    `series10 46mm 3-branch: plain=${plain.baseRows}, care=${care.baseRows}, cellular=${cellular.baseRows}, coverage=${branchCoverageOverBase}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
