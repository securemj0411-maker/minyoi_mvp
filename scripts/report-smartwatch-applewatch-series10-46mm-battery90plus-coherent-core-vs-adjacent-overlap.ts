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
  const baggage = await readJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition-latest.json",
  );

  const coherentCore = thick.metrics.coherentCoreRows ?? 0;
  const adjacent = thick.metrics.adjacentRows ?? 0;
  const plainBranch = branches.metrics.plainCleanPersonalRows ?? 0;

  const titlePlain = signals.metrics.titlePlainBranchRows ?? 0;
  const descOnlyGps = signals.metrics.descriptionOnlyGpsRows ?? 0;
  const titleCellular = signals.metrics.titleCellularPremiumRows ?? 0;
  const descOnlyCare = signals.metrics.descriptionOnlyCareBranchRows ?? 0;

  // coherentCore = titlePlain (definition). adjacent = base - coherentCore.
  // Overlap dimensions to investigate:
  //   - Is the plain branch identical to coherent core? plainBranch (=1) vs coherentCore (=2) => NOT identical.
  //     plain branch only counts rows that are *also* plain-clean personal (no care/cellular). coherent core = title-plain regardless of branch classification.
  //     Therefore: coherent core ⊋ plain branch in this snapshot.
  const coherentCoreOnlyMinusPlainBranch = Math.max(coherentCore - plainBranch, 0);
  const plainBranchOnlyMinusCoherentCore = Math.max(plainBranch - coherentCore, 0);
  const coherentCorePlainBranchIntersect = Math.min(coherentCore, plainBranch);

  // adjacent overlap with coherent-like signals
  //   - adjacent rows might still carry description-only GPS (plain-like description), but their title carries cellular/care.
  //   - if adjacent rows had ALL plain signals we would have a 'false-coherent' risk. they don't, by construction.
  const adjacentDescriptionOnlyGpsRows = Math.max(descOnlyGps - coherentCore, 0);
  const adjacentTitleCellularRows = titleCellular; // adjacent contributes cellular title
  const adjacentDescOnlyCareRows = descOnlyCare; // adjacent care wording in description

  const multiBaggage = baggage.metrics.baggageMultiplicityPerAdjacent ?? 0;

  const overlapVerdict = (() => {
    if (adjacent === 0) return "no_adjacent_to_overlap";
    if (multiBaggage > 1.0) return "adjacent_is_multi_baggage_no_safe_absorption";
    if (adjacentDescriptionOnlyGpsRows > 0) return "adjacent_carries_plain_like_description_but_baggage_in_title";
    return "adjacent_cleanly_outside_coherent_core";
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
      "applewatch_series10_46mm_battery90plus_coherent_core_vs_adjacent_overlap_report_only",
    metrics: {
      coherentCoreRows: coherentCore,
      adjacentRows: adjacent,
      plainBranchRows: plainBranch,
      coherentCorePlainBranchIntersect,
      coherentCoreOnlyMinusPlainBranch,
      plainBranchOnlyMinusCoherentCore,
      titlePlainRows: titlePlain,
      descOnlyGpsRows: descOnlyGps,
      adjacentDescriptionOnlyGpsRows,
      adjacentTitleCellularRows,
      adjacentDescOnlyCareRows,
      baggageMultiplicityPerAdjacent: multiBaggage,
      runtimeApprovedRows: 0,
    },
    setRelations: {
      coherentCoreDefinition: "title-plain rows under Series10 46mm battery90+ personal-used base.",
      plainBranchDefinition:
        "title-plain rows that ALSO clear care_backed_gps and cellular_premium classifications.",
      relation:
        coherentCoreOnlyMinusPlainBranch > 0
          ? "coherent_core ⊋ plain_branch — title-plain rows exist that still carry care/cellular description signals. coherent_core is the looser set."
          : plainBranchOnlyMinusCoherentCore > 0
            ? "plain_branch ⊋ coherent_core — plain branch claims rows whose title is not plain. inspect signal carriers."
            : "coherent_core = plain_branch at this snapshot.",
    },
    overlapVerdict,
    policyImplications: [
      "coherent_core and plain_branch are different sets. do not treat them as identical in any downstream rule.",
      coherentCoreOnlyMinusPlainBranch > 0
        ? `coherent_core has ${coherentCoreOnlyMinusPlainBranch} row(s) that the plain_branch classifier rejected. these are title-plain BUT carry baggage descriptions — confirm they stay report-only.`
        : "coherent_core does not currently exceed plain_branch — no false-coherent rows.",
      `Adjacent slice is in state '${overlapVerdict}'. multi-baggage multiplicity = ${multiBaggage}. cannot be absorbed.`,
      "Density floor crossing must use plain_branch (the stricter set), not coherent_core, as the gate quantity.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly: track |coherent_core - plain_branch| ; if the gap rises, more rows are slipping into title-plain with baggage descriptions",
      "compare against Series9 coherent_core vs plain_branch gap to see whether the gap is a generational phenomenon",
      "when the gap is 0 for two consecutive weeks AND plain_branch ≥ 5, that is the design-gate signal for a tiny owner-review packet",
    ],
    doNotDo: [
      "Do not use coherent_core as the density gate (it is too loose)",
      "Do not merge adjacent rows into coherent_core, ever",
      "Do not redefine plain_branch to match coherent_core for convenience",
      "Do not public-promote based on this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "smartwatch-applewatch-series10-46mm-battery90plus-coherent-core-vs-adjacent-overlap-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Coherent-Core vs Adjacent Overlap",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only set-relation analysis of coherent_core ↔ plain_branch ↔ adjacent slices. Confirms that coherent_core and plain_branch are different sets and that adjacent rows cannot be absorbed.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Set Relations",
    "",
    `- coherentCoreDefinition: ${report.setRelations.coherentCoreDefinition}`,
    `- plainBranchDefinition: ${report.setRelations.plainBranchDefinition}`,
    `- relation: ${report.setRelations.relation}`,
    "",
    `## Overlap Verdict: ${overlapVerdict}`,
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
    `s10 46mm overlap: core=${coherentCore}, plain_branch=${plainBranch}, gap=${coherentCoreOnlyMinusPlainBranch}, verdict=${overlapVerdict}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
