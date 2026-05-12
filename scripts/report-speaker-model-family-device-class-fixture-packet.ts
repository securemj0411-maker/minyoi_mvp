import fs from "node:fs";
import path from "node:path";

type DryRun = {
  metrics: Record<string, number>;
  rows: Array<Record<string, unknown>>;
};

const dryRun = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "reports", "speaker-no-mutation-runtime-dry-run-latest.json"), "utf8"),
) as DryRun;

const fixtureGroups = [
  {
    group: "portable_speaker_reference_families",
    families: ["jbl-go", "jbl-boombox", "jbl-authentics", "marshall-acton", "marshall-stanmore", "britz-bz"],
    currentDecision: "reference_only_not_runtime_candidate",
    requiredBeforeCandidate: [
      "exact model token confirmed",
      "portable speaker device class confirmed",
      "single-unit versus bundle/set condition confirmed",
      "accessory-only wording absent",
      "official or durable product-family source attached for selected model subset",
    ],
  },
  {
    group: "amp_receiver_exclusions",
    families: ["marantz-model", "marantz-sr"],
    currentDecision: "negative_hold_only",
    requiredBeforeCandidate: [
      "separate amp/receiver category policy",
      "do not include in portable speaker denominator",
      "exclude receiver/model-number rows from speaker comparable keys",
    ],
  },
  {
    group: "pa_speaker_boundary",
    families: ["jbl-eon"],
    currentDecision: "negative_hold_only",
    requiredBeforeCandidate: [
      "separate PA speaker policy",
      "venue/pro audio device class split",
      "do not compare with consumer portable speakers",
    ],
  },
  {
    group: "generic_or_unknown_variant_holds",
    families: ["speaker-generic", "soundbar-generic", "marshall-emberton-unknown", "jbl-xtreme-unknown"],
    currentDecision: "negative_hold_only",
    requiredBeforeCandidate: [
      "model variant disambiguated",
      "soundbar versus portable speaker separated",
      "generic novelty/Bluetooth speaker titles kept out of comparable keys",
    ],
  },
];

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "speaker_audio_discovered",
  scope: "speaker model-family and device-class fixture expansion packet",
  metrics: {
    dryRunRows: dryRun.metrics.rows,
    dryRunFailedRows: dryRun.metrics.failedRows,
    referenceOnlyRows: dryRun.metrics.referenceOnlyRows,
    holdRows: dryRun.metrics.holdRows,
    candidatePositiveOnlyRows: dryRun.metrics.candidatePositiveOnlyRows,
    fixtureGroups: fixtureGroups.length,
    runtimeApprovedRows: 0,
  },
  fixtureGroups,
  dryRunRows: dryRun.rows,
  policyImplications: [
    "Speaker/audio must not advance as one broad category because portable speakers, amps, receivers, PA gear, and soundbars have different comparability rules.",
    "Model-coded portable speaker rows can become future reference fixtures, not runtime candidates yet.",
    "Marantz receiver/amplifier rows and JBL EON PA rows should be excluded from portable speaker candidate policy.",
    "Unknown variant rows remain hold until exact model variant is resolved.",
  ],
  proposedNextEvidence: [
    "Attach official model pages/manuals for selected JBL/Marshall/Britz portable speaker subset.",
    "Create soundbar-generic versus portable-speaker boundary examples.",
    "Keep amp/receiver examples in separate exclusion fixture set.",
  ],
  nextAction:
    "Create speaker artifact consistency audit, then continue to camera body/lens/package false-merge regression packet.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "speaker-model-family-device-class-fixture-packet-latest.json");
const mdPath = path.join(reportsDir, "speaker-model-family-device-class-fixture-packet-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Speaker Model-Family Device-Class Fixture Packet",
  "",
  `- generatedAt: ${report.generatedAt}`,
  "- category: speaker_audio_discovered",
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- dryRunRows: ${report.metrics.dryRunRows}`,
  `- dryRunFailedRows: ${report.metrics.dryRunFailedRows}`,
  `- referenceOnlyRows: ${report.metrics.referenceOnlyRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  "",
  "## Fixture Groups",
  "",
  ...fixtureGroups.flatMap((group) => [
    `### ${group.group}`,
    "",
    `- currentDecision: ${group.currentDecision}`,
    `- families: ${group.families.join(", ")}`,
    "",
    "Required before candidate:",
    ...group.requiredBeforeCandidate.map((line) => `- ${line}`),
    "",
  ]),
  "## Policy Implications",
  "",
  ...report.policyImplications.map((line) => `- ${line}`),
  "",
  "## Proposed Next Evidence",
  "",
  ...report.proposedNextEvidence.map((line) => `- ${line}`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      category: report.category,
      dryRunRows: report.metrics.dryRunRows,
      dryRunFailedRows: report.metrics.dryRunFailedRows,
      fixtureGroups: report.metrics.fixtureGroups,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
