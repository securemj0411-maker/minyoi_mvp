import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANCHORS, readAllAnchorSummaries, type AnchorKey, type ParseSummary } from "./lib/phones-anchor-trio-mining.js";

const reportsDir = path.join(process.cwd(), "reports");

type AxisPresence = "comparable_key" | "catalog_filter_only" | "absent";

type AxisRow = {
  axis: string;
  parserPresence: AxisPresence;
  catalogPresence: AxisPresence;
  comparableKeyInclusion: boolean;
  miningCoverageNote: string;
  exampleRules: Record<AnchorKey, string[]>;
};

function rulesMatching(summary: ParseSummary, predicate: (label: string) => boolean): string[] {
  return summary.reject_rules.filter((r) => predicate(r.label)).map((r) => r.label);
}

async function main(): Promise<void> {
  const all = await readAllAnchorSummaries();

  const axes: AxisRow[] = [
    {
      axis: "storage_gb",
      parserPresence: "comparable_key",
      catalogPresence: "comparable_key",
      comparableKeyInclusion: true,
      miningCoverageNote:
        "option-parser extracts storage into comparable_key (family|model|storage). mining lanes also reject wrong_storage_*. only smartphone axis currently in comparable_key.",
      exampleRules: {
        iphone_13_pro_128gb_self: rulesMatching(all.iphone_13_pro_128gb_self, (l) => l.startsWith("wrong_storage_")),
        galaxy_s23_ultra_256_self: rulesMatching(all.galaxy_s23_ultra_256_self, (l) => l.startsWith("wrong_storage_")),
        galaxy_s25_ultra_256_self: rulesMatching(all.galaxy_s25_ultra_256_self, (l) => l.startsWith("wrong_storage_")),
      },
    },
    {
      axis: "color",
      parserPresence: "absent",
      catalogPresence: "absent",
      comparableKeyInclusion: false,
      miningCoverageNote:
        "no color axis in option-parser comparable_key. no color mustContain/mustNotContain in narrow self lanes. listings with different colors share comparable_key.",
      exampleRules: {
        iphone_13_pro_128gb_self: [],
        galaxy_s23_ultra_256_self: [],
        galaxy_s25_ultra_256_self: [],
      },
    },
    {
      axis: "self_unlocked",
      parserPresence: "absent",
      catalogPresence: "catalog_filter_only",
      comparableKeyInclusion: false,
      miningCoverageNote:
        "self/자급제 is enforced only via narrow lane mustContain queries (e.g. '아이폰 13 프로 128 자급제'). option-parser does not encode an unlocked/locked boolean into comparable_key. silent-carrier listings share comparable_key with explicit self listings.",
      exampleRules: {
        iphone_13_pro_128gb_self: ["accept_all_requires_explicit_self_token"],
        galaxy_s23_ultra_256_self: ["accept_all_requires_explicit_self_token"],
        galaxy_s25_ultra_256_self: ["accept_all_requires_explicit_self_token"],
      },
    },
    {
      axis: "carrier_skt_kt_lg_generic",
      parserPresence: "absent",
      catalogPresence: "catalog_filter_only",
      comparableKeyInclusion: false,
      miningCoverageNote:
        "carrier wording is rejected via mustNotContain (carrier_skt / carrier_kt / carrier_lg / carrier_locked_generic). carrier itself is not a comparable_key dimension; a row that fails to mention carrier becomes ambiguous and shares comparable_key with self listings.",
      exampleRules: {
        iphone_13_pro_128gb_self: rulesMatching(all.iphone_13_pro_128gb_self, (l) => l.startsWith("carrier_")),
        galaxy_s23_ultra_256_self: rulesMatching(all.galaxy_s23_ultra_256_self, (l) => l.startsWith("carrier_")),
        galaxy_s25_ultra_256_self: rulesMatching(all.galaxy_s25_ultra_256_self, (l) => l.startsWith("carrier_")),
      },
    },
    {
      axis: "dual_sim_physical",
      parserPresence: "absent",
      catalogPresence: "absent",
      comparableKeyInclusion: false,
      miningCoverageNote:
        "physical dual-SIM (Korean iPhone) is not encoded anywhere. comparable_key collapses single-SIM and dual-SIM variants together.",
      exampleRules: {
        iphone_13_pro_128gb_self: [],
        galaxy_s23_ultra_256_self: [],
        galaxy_s25_ultra_256_self: [],
      },
    },
    {
      axis: "esim_capable",
      parserPresence: "absent",
      catalogPresence: "absent",
      comparableKeyInclusion: false,
      miningCoverageNote:
        "eSIM capability is not encoded anywhere. matters for international/parallel-import iPhones especially. comparable_key collapses eSIM and non-eSIM variants together.",
      exampleRules: {
        iphone_13_pro_128gb_self: [],
        galaxy_s23_ultra_256_self: [],
        galaxy_s25_ultra_256_self: [],
      },
    },
    {
      axis: "generation_token",
      parserPresence: "catalog_filter_only",
      catalogPresence: "catalog_filter_only",
      comparableKeyInclusion: false,
      miningCoverageNote:
        "generation discrimination (e.g. S22/S23/S24/S25/S26 or iPhone 12/13/14/15/16) is handled by accept_all + wrong_model_* mustNotContain in narrow lanes. it is part of the model token in catalog but not a separate axis in comparable_key, so similar-generation false positives pollute the same comparable_key.",
      exampleRules: {
        iphone_13_pro_128gb_self: rulesMatching(all.iphone_13_pro_128gb_self, (l) => l.startsWith("wrong_model_")),
        galaxy_s23_ultra_256_self: rulesMatching(all.galaxy_s23_ultra_256_self, (l) => l.startsWith("wrong_model_")),
        galaxy_s25_ultra_256_self: rulesMatching(all.galaxy_s25_ultra_256_self, (l) => l.startsWith("wrong_model_")),
      },
    },
  ];

  const axesInComparableKey = axes.filter((a) => a.comparableKeyInclusion).length;
  const axesInCatalogOnly = axes.filter((a) => !a.comparableKeyInclusion && (a.parserPresence === "catalog_filter_only" || a.catalogPresence === "catalog_filter_only")).length;
  const axesAbsent = axes.filter((a) => a.parserPresence === "absent" && a.catalogPresence === "absent").length;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "phones_discovered",
    family: "smartphone_anchor_trio",
    anchors: ANCHORS,
    decision: "phones_discovered_anchor_trio_option_axis_inventory_report_only",
    metrics: {
      anchors: ANCHORS.length,
      axes: axes.length,
      axesInComparableKey,
      axesInCatalogOnly,
      axesAbsent,
      runtimeApprovedRows: 0,
    },
    axes,
    policyImplications: [
      "Only 1 out of 7 axes (storage_gb) is encoded into comparable_key. 6 axes are either catalog-filter-only or absent.",
      "self_unlocked, carrier, dual_sim, esim, color are NOT comparable_key dimensions — listings differing on these axes collapse to the same comparable_key.",
      "Narrow self lanes (3 anchors) enforce self / generation / storage via mining accept_all + mustNotContain, but do NOT extend comparable_key.",
      "This is the structural reason a row can pass narrow-lane mining and still be untrustworthy at production comparable_key level.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "treat option-axis inventory as the canonical map for follow-up parser-bottleneck packets",
      "rerun this packet whenever mining lane_config or option-parser comparable_key construction changes",
    ],
    doNotDo: [
      "Do not propose adding axes to comparable_key from this packet — that is a future owner-decision runtime change",
      "Do not infer silent carrier / silent self / silent eSIM state and add it to comparable_key deterministically",
      "Do not public-promote anything from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "phones-discovered-anchor-trio-option-axis-inventory-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Discovered — Anchor Trio Option Axis Inventory",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only inventory of which smartphone option axes are encoded into comparable_key vs catalog-filter-only vs absent. Anchors: Galaxy S23 Ultra 256 self, iPhone 13 Pro 128 self, Galaxy S25 Ultra 256 self.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Axes",
    "",
    ...axes.flatMap((a) => [
      `### ${a.axis}`,
      "",
      `- parserPresence: ${a.parserPresence}`,
      `- catalogPresence: ${a.catalogPresence}`,
      `- comparableKeyInclusion: ${a.comparableKeyInclusion}`,
      `- miningCoverageNote: ${a.miningCoverageNote}`,
      "- exampleRules:",
      ...ANCHORS.map((anchor) => `  - ${anchor}: ${a.exampleRules[anchor].join(", ") || "(none)"}`),
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
    `phones option-axis: axes=${axes.length}, comparableKey=${axesInComparableKey}, catalogOnly=${axesInCatalogOnly}, absent=${axesAbsent}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
