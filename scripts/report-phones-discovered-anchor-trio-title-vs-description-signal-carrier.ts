import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANCHORS, readAllAnchorSummaries, type AnchorKey } from "./lib/phones-anchor-trio-mining.js";

const reportsDir = path.join(process.cwd(), "reports");

// Mining accept/reject runs against the title-side normalized text (mine-narrow-lane-v1).
// Description-only signal coverage is therefore UNMEASURED by mining alone.
// This packet quantifies the title-side ceiling and explicitly marks description-only as an unmeasured gap that AI L2 must own.

async function main(): Promise<void> {
  const all = await readAllAnchorSummaries();

  type Row = {
    anchor: AnchorKey;
    totalFetched: number;
    titlePassedAcceptAll: number;
    titleRejected: number;
    titleAcceptRate: number;
    descriptionOnlySignalMeasured: boolean;
    descriptionOnlySignalProxy: string;
    titleSelfTokenRequired: boolean;
  };

  const rows: Row[] = ANCHORS.map((a) => {
    const s = all[a];
    const titlePassed = s.parse_ready_count + 0; // parse_ready means title passed accept_all and survived all reject_rules
    return {
      anchor: a,
      totalFetched: s.total_fetched,
      titlePassedAcceptAll: titlePassed,
      titleRejected: s.rejected_count,
      titleAcceptRate: s.total_fetched > 0 ? Number((titlePassed / s.total_fetched).toFixed(3)) : 0,
      descriptionOnlySignalMeasured: false,
      descriptionOnlySignalProxy:
        "mining (mine-narrow-lane-v1) does not read description text. description-only self/carrier/storage/color/eSIM signals are UNMEASURED here and must be treated as AI L2 territory.",
      titleSelfTokenRequired: s.accept_rules.accept_all.some((r) => /자급제|self/i.test(r)) || s.lane_key.endsWith("_self"),
    };
  });

  const totalTitleAccept = rows.reduce((a, r) => a + r.titlePassedAcceptAll, 0);
  const totalRows = rows.reduce((a, r) => a + r.totalFetched, 0);
  const titleAcceptShareOverall = totalRows > 0 ? Number((totalTitleAccept / totalRows).toFixed(3)) : 0;

  const findings = [
    {
      finding: "title-side parse_ready ceiling per anchor",
      detail: rows
        .map((r) => `${r.anchor}: ${r.titlePassedAcceptAll}/${r.totalFetched} (${(r.titleAcceptRate * 100).toFixed(1)}%)`)
        .join("; "),
      meaning:
        "this is the upper bound of deterministic title-side coverage under current mining rules. it is NOT the production ruleMatch + parseListingOptions yield (which is unmeasured here).",
    },
    {
      finding: "description-only signal coverage is unmeasured",
      detail:
        "mining accept_all + reject_rules operate on title text. listings that carry self/carrier/storage/color/eSIM only in description are either silently mis-routed (if title is clean enough to pass accept_all) or silently rejected (if title is too thin).",
      meaning:
        "any deterministic widening to absorb description-only signals would violate LAUNCH_PLAN §12b (no fallback inference). description-only routing is owned by AI L2.",
    },
    {
      finding: "self/자급제 token requirement is title-only",
      detail: rows
        .map((r) => `${r.anchor}: titleSelfTokenRequired=${r.titleSelfTokenRequired}`)
        .join("; "),
      meaning:
        "the 'self' lane discipline lives entirely in the title. a listing without title-side self token but with description-side self token cannot be deterministically promoted.",
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
    decision: "phones_discovered_anchor_trio_title_vs_description_signal_carrier_report_only",
    metrics: {
      anchors: rows.length,
      totalRows,
      totalTitleAccept,
      titleAcceptShareOverall,
      descriptionOnlySignalMeasured: 0,
      runtimeApprovedRows: 0,
    },
    perAnchor: rows,
    findings,
    policyImplications: [
      "Mining is a title-side discipline. description-only signals are unmeasured and unowned at L1.",
      "Any attempt to absorb description-only signals into deterministic comparable_key violates LAUNCH_PLAN §12b.",
      "AI L2 is the only legitimate destination for description-only self/carrier/eSIM/dual_sim signals.",
      "Title-accept share overall = " + titleAcceptShareOverall + ". this is the L1 ceiling for the anchor trio under current rules.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "future packet (separate wave): instrument production parser to log title vs description token positions, so the gap becomes measurable rather than inferred",
      "rerun this packet on weekly mining refresh to track title-accept share drift",
    ],
    doNotDo: [
      "Do not infer description-only self/carrier/eSIM signals into comparable_key deterministically",
      "Do not lower mining accept_all to absorb description-side signals",
      "Do not public-promote anything from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "phones-discovered-anchor-trio-title-vs-description-signal-carrier-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Discovered — Anchor Trio Title vs Description Signal Carrier",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet bounding the title-side parse_ready ceiling and marking description-only signals as unmeasured AI L2 territory.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Per Anchor",
    "",
    "| anchor | totalFetched | titlePassedAcceptAll | titleAcceptRate | titleSelfTokenRequired |",
    "|---|---:|---:|---:|---|",
    ...rows.map(
      (r) =>
        `| ${r.anchor} | ${r.totalFetched} | ${r.titlePassedAcceptAll} | ${r.titleAcceptRate} | ${r.titleSelfTokenRequired} |`,
    ),
    "",
    "## Findings",
    "",
    ...findings.flatMap((f) => [`### ${f.finding}`, "", `- detail: ${f.detail}`, `- meaning: ${f.meaning}`, ""]),
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
    `phones title-vs-description: titleAcceptShare=${titleAcceptShareOverall}, descriptionMeasured=false`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
