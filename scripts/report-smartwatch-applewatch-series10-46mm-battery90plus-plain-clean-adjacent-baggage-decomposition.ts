import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = { metrics: ReportMetrics };

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const thick = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );
  const branches = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json",
  );
  const signals = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json",
  );
  const clean = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json",
  );

  const baseRows = thick.metrics.baseRows ?? 0;
  const coherentCore = thick.metrics.coherentCoreRows ?? 0;
  const adjacent = thick.metrics.adjacentRows ?? 0;

  // baggage counts (each may overlap on the same adjacent row)
  const careBaggageRows = branches.metrics.careBackedGpsRows ?? 0;
  const cellularBaggageRows = branches.metrics.cellularPremiumRows ?? 0;
  const bundleBaggageRows = clean.metrics.bundleRows ?? 0;
  const titaniumBaggageRows = branches.metrics.titaniumRows ?? 0;
  const premiumPitchRows = clean.metrics.premiumPitchRows ?? 0;
  const unopenedRows = clean.metrics.unopenedRows ?? 0;
  const sumBaggageOccurrences =
    careBaggageRows + cellularBaggageRows + bundleBaggageRows + titaniumBaggageRows + premiumPitchRows + unopenedRows;
  const baggageMultiplicityPerAdjacent =
    adjacent > 0 ? Number((sumBaggageOccurrences / adjacent).toFixed(3)) : 0;

  // signal split: where the baggage is signaled (title vs description-only)
  const titleCellularPremium = signals.metrics.titleCellularPremiumRows ?? 0;
  const descOnlyCellularPremium = signals.metrics.descriptionOnlyCellularPremiumRows ?? 0;
  const descOnlyCare = signals.metrics.descriptionOnlyCareBranchRows ?? 0;
  const careTitleRows = Math.max(careBaggageRows - descOnlyCare, 0);

  type BaggageEntry = {
    type: string;
    occurrences: number;
    titleSignaled: number | null;
    descriptionOnly: number | null;
    siblingBranch: string;
    note: string;
  };

  const baggage: BaggageEntry[] = [
    {
      type: "care_owner_warranty",
      occurrences: careBaggageRows,
      titleSignaled: careTitleRows,
      descriptionOnly: descOnlyCare,
      siblingBranch: "care_backed_gps",
      note: "AppleCare/보증 wording. owns its own price normalization; cannot fold into plain-clean lane.",
    },
    {
      type: "cellular_premium_framing",
      occurrences: cellularBaggageRows,
      titleSignaled: titleCellularPremium,
      descriptionOnly: descOnlyCellularPremium,
      siblingBranch: "cellular_premium",
      note: "cellular / LTE / GPS+Cellular wording. distinct connectivity tier; never folded into plain-clean.",
    },
    {
      type: "bundle_extras",
      occurrences: bundleBaggageRows,
      titleSignaled: null,
      descriptionOnly: null,
      siblingBranch: "bundle_adjacent (report-only escrow)",
      note: "extra straps / accessory / 풀박 wording. price normalization risk; AI L2 escrow only.",
    },
    {
      type: "titanium_material_premium",
      occurrences: titaniumBaggageRows,
      titleSignaled: null,
      descriptionOnly: null,
      siblingBranch: "cellular_premium (titanium subtype)",
      note: "Ti / 티타늄 wording. material-tier premium; overlaps with cellular branch in evidence.",
    },
    {
      type: "premium_pitch",
      occurrences: premiumPitchRows,
      titleSignaled: null,
      descriptionOnly: null,
      siblingBranch: "(none — pricing pitch, not lane)",
      note: "premium/new-like/A급 pricing pitch. wording-only signal; do not absorb.",
    },
    {
      type: "unopened_like",
      occurrences: unopenedRows,
      titleSignaled: null,
      descriptionOnly: null,
      siblingBranch: "(none — condition pitch)",
      note: "미개봉/박스개봉 wording. condition pitch; price tier differs from used personal lane.",
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision:
      "applewatch_series10_46mm_battery90plus_plain_clean_adjacent_baggage_decomposition_report_only",
    metrics: {
      baseRows,
      coherentCoreRows: coherentCore,
      adjacentRows: adjacent,
      sumBaggageOccurrences,
      baggageMultiplicityPerAdjacent,
      careBaggageRows,
      cellularBaggageRows,
      bundleBaggageRows,
      titaniumBaggageRows,
      premiumPitchRows,
      unopenedRows,
      runtimeApprovedRows: 0,
    },
    baggage,
    interpretation: {
      headline:
        adjacent > 0
          ? `${adjacent} adjacent row(s) carry ${sumBaggageOccurrences} baggage occurrence(s) (multiplicity=${baggageMultiplicityPerAdjacent}). single-row, multi-baggage profile.`
          : "no adjacent rows to decompose.",
      meaning:
        "multiplicity > 1.0 means the same adjacent row carries multiple baggage types. it cannot be sorted into a single sibling branch by deterministic rule.",
      verdict:
        "the adjacent row is a multi-baggage outlier, not a candidate for any single deterministic lane. AI L2 escrow target.",
    },
    policyImplications: [
      "Adjacent baggage decomposition shows the lone adjacent row is multi-baggage, not single-branch.",
      "Multi-baggage rows are explicitly AI L2 escrow material per LAUNCH_PLAN §12c (mining → production transfer, ambiguous-context lane).",
      "Do not write a deterministic rule that picks one baggage type as primary to absorb the row.",
      "Future adjacency rows must be re-decomposed under this same packet on each weekly refresh.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly snapshot: rerun decomposition on the latest adjacency slice and watch whether multiplicity drops (= more single-baggage adjacent rows = cleaner sibling structure)",
      "track whether new adjacent rows fall into the 'no sibling branch' baggage types (premium_pitch / unopened_like) — those need their own packets if density rises",
      "compare against Series9 adjacent composition (strap/box-dominated) to confirm S9 vs S10 thicken in different directions",
    ],
    doNotDo: [
      "Do not pick one baggage type as the dominant one and absorb the row into that sibling branch",
      "Do not collapse premium_pitch or unopened_like into a sibling lane",
      "Do not treat any baggage decomposition row as deterministic evidence for runtime",
      "Do not public-promote anything from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Plain-Clean Adjacent Baggage Decomposition",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only decomposition of the adjacent slice into baggage types. Multi-baggage rows are AI L2 escrow material, not deterministic widening evidence.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Baggage Types",
    "",
    ...baggage.flatMap((b) => [
      `### ${b.type}`,
      "",
      `- occurrences: ${b.occurrences}`,
      `- titleSignaled: ${b.titleSignaled ?? "-"}`,
      `- descriptionOnly: ${b.descriptionOnly ?? "-"}`,
      `- siblingBranch: ${b.siblingBranch}`,
      `- note: ${b.note}`,
      "",
    ]),
    "## Interpretation",
    "",
    `- headline: ${report.interpretation.headline}`,
    `- meaning: ${report.interpretation.meaning}`,
    `- verdict: ${report.interpretation.verdict}`,
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
    `s10 46mm adjacent baggage: adjacent=${adjacent}, occurrences=${sumBaggageOccurrences}, multiplicity=${baggageMultiplicityPerAdjacent}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
