import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = { metrics: ReportMetrics };

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const clean = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json",
  );
  const branches = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json",
  );
  const signals = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json",
  );

  const baseRows = clean.metrics.baseRows ?? 0;
  const cleanPersonalUsedRows = clean.metrics.cleanPersonalUsedRows ?? 0;
  const plainCleanPersonalRows = branches.metrics.plainCleanPersonalRows ?? 0;
  const careBackedGpsRows = branches.metrics.careBackedGpsRows ?? 0;
  const cellularPremiumRows = branches.metrics.cellularPremiumRows ?? 0;
  const bundleRows = clean.metrics.bundleRows ?? 0;
  const titanium = branches.metrics.titaniumRows ?? 0;

  // coherent-core = title plain branch (가장 보수적). adjacent = remainder of base.
  const coherentCoreRows = signals.metrics.titlePlainBranchRows ?? 0;
  const adjacentRows = Math.max(baseRows - coherentCoreRows, 0);
  // adjacent clean = plain-clean personal slice 안의 base 잔여
  const adjacentCleanCandidateRows = Math.max(plainCleanPersonalRows - coherentCoreRows, 0);
  const adjacentCareRows = careBackedGpsRows;
  const adjacentCellularRows = cellularPremiumRows;
  const adjacentBundleRows = bundleRows;
  const adjacentTitaniumRows = titanium;
  const descriptionOnlyGpsRows = signals.metrics.descriptionOnlyGpsRows ?? 0;
  const descriptionOnlyCareBranchRows = signals.metrics.descriptionOnlyCareBranchRows ?? 0;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision:
      "applewatch_series10_46mm_battery90plus_plain_clean_personal_adjacent_thickening_report_only",
    metrics: {
      baseRows,
      coherentCoreRows,
      adjacentRows,
      adjacentCleanCandidateRows,
      adjacentCareRows,
      adjacentCellularRows,
      adjacentBundleRows,
      adjacentTitaniumRows,
      descriptionOnlyGpsRows,
      descriptionOnlyCareBranchRows,
      cleanPersonalUsedRows,
      runtimeApprovedRows: 0,
    },
    coherentCore: {
      definition:
        "title-side plain (no care/cellular/premium/bundle) Series10 46mm battery90+ personal rows. tightest possible lane signal.",
      sourcePacket:
        "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json#titlePlainBranchRows",
    },
    adjacency: {
      definition:
        "base rows that fail the title-plain test but stay inside Series10 46mm battery90+ personal-used (description-only GPS, care wording, light bundle).",
      composition: {
        adjacentCareRows: "care-backed GPS branch — owner-care wording in title/desc, often AppleCare or 보증.",
        adjacentCellularRows: "cellular-premium branch — cellular/LTE/티타늄/Ti premium framing.",
        adjacentBundleRows: "light bundle adjacency — extra straps / accessory / 풀박 wording without price normalization risk.",
        descriptionOnlyGpsRows: "GPS only signaled in description, title plain.",
        descriptionOnlyCareBranchRows: "care signal only in description, title plain.",
      },
    },
    policyImplications: [
      "Series10 46mm battery90+ base is still singleton-tier (baseRows=" + baseRows + "). Thickening must come from adjacency exploration, not deterministic widening.",
      "coherent core (title plain) = " + coherentCoreRows + " row(s). this is the only slice we would consider runtime-eligible after density rises.",
      "adjacency slice (" + adjacentRows + " row(s)) = legitimate AI L2 escrow candidates only. do not absorb into the coherent core lane.",
      "care-backed and cellular branches are sibling lanes, not extensions of the plain clean lane.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "track plainCleanPersonalRows + coherentCoreRows over weekly snapshots; consider thickening only when both surpass 5 rows without bundle/cellular drift",
      "compare adjacent-clean-candidates against Series9 45mm GPS adjacency to see whether Series10 sustains cleaner adjacency density",
      "keep care-backed GPS and cellular-premium as separate report-only branches; do not merge",
    ],
    doNotDo: [
      "Do not widen the plain clean lane regex to absorb description-only GPS",
      "Do not treat adjacency rows as runtime-approved",
      "Do not collapse care-backed or cellular branches into the plain clean lane",
      "Do not public-promote any Series10 46mm slice from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Plain-Clean Personal Adjacent Thickening",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet defining the coherent-core plain-clean personal slice and the adjacency rows that would have to thicken before any runtime move.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Coherent Core",
    "",
    `- definition: ${report.coherentCore.definition}`,
    `- sourcePacket: ${report.coherentCore.sourcePacket}`,
    "",
    "## Adjacency Composition",
    "",
    `- definition: ${report.adjacency.definition}`,
    ...Object.entries(report.adjacency.composition).map(([k, v]) => `- ${k}: ${v}`),
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
    `series10 46mm thickening: base=${baseRows}, coherent_core=${coherentCoreRows}, adjacent=${adjacentRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
