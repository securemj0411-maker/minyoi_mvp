import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

type FixturePacket = {
  metrics: {
    dryRunRows: number;
    dryRunFailedRows: number;
    referenceOnlyRows: number;
    holdRows: number;
    candidatePositiveOnlyRows: number;
    runtimeApprovedRows: number;
  };
  fixtureGroups: Array<{
    group: string;
    families: string[];
    currentDecision: string;
    requiredBeforeCandidate: string[];
  }>;
};

type SplitPrep = {
  metrics: {
    total: number;
    normal: number;
    modelMatchedRate: number;
    genericFamilyRate: number;
    portableExactModelRows: number;
    portableExactModelUnits: number;
    unknownVariantRows: number;
    ampReceiverUnits: number;
    paSpeakerUnits: number;
    genericExampleRows: number;
    runtimeApprovedRows: number;
  };
};

type BoundaryEvidence = {
  rows: Array<{
    family: string;
    brand: string;
    deviceClass: string;
    familyCount: number;
    exactModelCount: number;
    unknownVariantCount: number;
    modelExamples: Array<{ key: string; count: number }>;
    action: string;
    evidenceClass: string;
    runtimeApproved: boolean;
  }>;
};

type PortableMatrix = {
  rows: Array<{
    family: string;
    brand: string;
    deviceClass: string;
    familyCount: number;
    exactModelCount: number;
    unknownVariantCount: number;
    modelExamples: Array<{ key: string; count: number }>;
    runtimeApproved: boolean;
  }>;
};

type GenericOverlap = {
  rows: Array<{
    pid: string;
    title: string;
    price: number;
    family: string;
    exclusionClass: string;
    overlapClass: string;
    brandHits: string[];
    modelTokenHits: string[];
    runtimeApproved: boolean;
  }>;
};

type Sample = {
  pid: string;
  name: string;
  price: number;
  condition: string;
  isProshop: boolean;
};

type DeviceClassRow = {
  deviceClass: string;
  decision: "reference_only" | "manual_review" | "hold";
  comparableKeyPolicy: "future_narrow_key_only" | "separate_lane_required" | "no_comparable_key";
  examples: string[];
  observedEvidence: string[];
  inclusionRule: string;
  holdRule: string;
  nextPrep: string[];
};

const reportsDir = path.join(process.cwd(), "reports");
const speakerDir = path.join(process.cwd(), "category-intelligence", "speaker_audio_discovered");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function sampleTitles(samples: Sample[], pattern: RegExp, limit: number): string[] {
  return samples
    .filter((sample) => pattern.test(sample.name))
    .slice(0, limit)
    .map((sample) => `${sample.name} (${sample.price.toLocaleString("ko-KR")}원)`);
}

function modelExamples(row: { modelExamples: Array<{ key: string; count: number }> }): string[] {
  return row.modelExamples.map((example) => `${example.key}(${example.count})`);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [fixturePacket, splitPrep, boundaryEvidence, portableMatrix, genericOverlap, samples] = await Promise.all([
    readJson<FixturePacket>(path.join(reportsDir, "speaker-model-family-device-class-fixture-packet-latest.json")),
    readJson<SplitPrep>(path.join(reportsDir, "speaker-audio-device-class-split-prep-latest.json")),
    readJson<BoundaryEvidence>(path.join(reportsDir, "speaker-device-class-boundary-evidence-latest.json")),
    readJson<PortableMatrix>(path.join(reportsDir, "speaker-portable-conditions-matrix-latest.json")),
    readJson<GenericOverlap>(path.join(reportsDir, "speaker-portable-generic-overlap-evidence-latest.json")),
    readJson<Sample[]>(path.join(speakerDir, "samples.json")),
  ]);

  const portableRows = portableMatrix.rows;
  const boundaryRows = boundaryEvidence.rows;
  const ampRows = boundaryRows.filter((row) => row.deviceClass === "amp_receiver");
  const paRows = boundaryRows.filter((row) => row.deviceClass === "pa_speaker");
  const unknownVariantRows = boundaryRows.filter((row) => row.evidenceClass === "unknown_variant_family_hold");
  const genericRows = genericOverlap.rows;
  const desktopExamples = sampleTitles(
    samples,
    /북쉘프|데스크파이|오디오엔진|Audioengine|액티브 스피커|모니터링 스피커|ROKIT|HS4|CP-200a|br-1100/i,
    6,
  );
  const soundbarExamples = sampleTitles(samples, /사운드바|Soundbar|셋탑사운드바|사운드스틱/i, 4);
  const paExamples = sampleTitles(samples, /EON|PA|파티박스|노래방|듀얼마이크|대음량|공연|궤짝/i, 6);

  const deviceClassRows: DeviceClassRow[] = [
    {
      deviceClass: "portable_bluetooth_speaker",
      decision: "reference_only",
      comparableKeyPolicy: "future_narrow_key_only",
      examples: portableRows.flatMap(modelExamples).slice(0, 14),
      observedEvidence: [
        `${portableRows.length} exact-model family rows are parser-candidate review inputs only.`,
        `${splitPrep.metrics.portableExactModelRows}/${splitPrep.metrics.portableExactModelUnits} portable exact-model rows/units were observed.`,
        "Marshall Acton/Stanmore, JBL GO/Authenics/Boombox, and Britz BA/BR/BZ families have useful exact-model tokens but remain unapproved.",
      ],
      inclusionRule: "Only later consider rows with brand + exact model token + portable speaker device class + no accessory/bundle-only wording.",
      holdRule: "Hold family-only, unknown variant, brand-only, set/bundle, accessory-only, and novelty rows.",
      nextPrep: [
        "Backfill official/durable product-family source evidence for a small selected subset.",
        "Add negative overlap checks for brand-only JBL/Marshall/Britz titles before any parser proposal.",
      ],
    },
    {
      deviceClass: "desktop_bookshelf_speaker",
      decision: "manual_review",
      comparableKeyPolicy: "separate_lane_required",
      examples: desktopExamples,
      observedEvidence: [
        "Observed desktop/bookshelf examples include Audioengine, KRK, Yamaha HS4, Sharp CP-200a, and Britz br-1100 style rows.",
        "These rows differ from portable Bluetooth speakers by stereo pair/unit count, powered/passive state, monitor/subwoofer roles, and desk-fi use.",
      ],
      inclusionRule: "Treat as a separate desktop/bookshelf lane with pair/single, active/passive, subwoofer, and monitor-speaker axes.",
      holdRule: "Do not compare with portable Bluetooth speakers or generic speaker rows.",
      nextPrep: [
        "Create a pair-vs-single fixture set.",
        "Separate subwoofer/center/monitor speaker rows before any comparable-key design.",
      ],
    },
    {
      deviceClass: "soundbar",
      decision: "manual_review",
      comparableKeyPolicy: "separate_lane_required",
      examples: soundbarExamples,
      observedEvidence: [
        "Set-top soundbar and SoundSticks-like rows appear inside the broad speaker/audio sample.",
        "Soundbar rows need TV/set-top/package and channel-count axes that portable speakers do not use.",
      ],
      inclusionRule: "Keep soundbar rows in their own manual-review lane until model and package axes are explicit.",
      holdRule: "Do not let soundbar/generic Bluetooth wording create portable speaker comparable keys.",
      nextPrep: [
        "Collect soundbar-specific title examples.",
        "Define set-top bundle, subwoofer bundle, and bar-only distinctions.",
      ],
    },
    {
      deviceClass: "amp_receiver",
      decision: "hold",
      comparableKeyPolicy: "separate_lane_required",
      examples: ampRows.flatMap(modelExamples),
      observedEvidence: [
        `${splitPrep.metrics.ampReceiverUnits} amp/receiver units were observed in split prep.`,
        "Marantz Model/SR rows are boundary exclusions from portable speaker candidate policy.",
      ],
      inclusionRule: "Amp/receiver needs a separate audio electronics lane, not speaker comparable keys.",
      holdRule: "Always keep amp, receiver, preamp, power amp, tuner, and integrated amp tokens out of portable speaker keys.",
      nextPrep: [
        "Create amp/receiver negative boundary fixtures.",
        "If pursued later, define an audio electronics taxonomy separate from speaker/audio expansion.",
      ],
    },
    {
      deviceClass: "pa_speaker_system",
      decision: "hold",
      comparableKeyPolicy: "separate_lane_required",
      examples: [...paRows.flatMap(modelExamples), ...paExamples].slice(0, 8),
      observedEvidence: [
        `${splitPrep.metrics.paSpeakerUnits} PA speaker unit was observed in prior split prep, with additional raw examples around partybox/karaoke/mic systems.`,
        "JBL EON and karaoke/party speaker rows require venue/pro-audio and set/bundle semantics.",
      ],
      inclusionRule: "PA/karaoke systems require a dedicated pro-audio or party-speaker lane.",
      holdRule: "Keep PA, karaoke, partybox, mic set, 15-inch cabinet, and pro-audio rows out of portable speaker comparables.",
      nextPrep: [
        "Separate PA speaker body, mic bundle, karaoke machine, and cabinet/system rows.",
        "Build negative fixtures against portable JBL GO/Boombox rows.",
      ],
    },
    {
      deviceClass: "novelty_generic_parts_accessory",
      decision: "hold",
      comparableKeyPolicy: "no_comparable_key",
      examples: genericRows.slice(0, 8).map((row) => row.title),
      observedEvidence: [
        `${splitPrep.metrics.genericExampleRows} generic example rows were already tracked as exclusion candidates.`,
        "Observed exclusions include novelty speakers, brand-only rows, bundle/component mix, cross-device rows, and accessory-like listings.",
        `${unknownVariantRows.length} family rows also remain hold because the exact model variant is missing.`,
      ],
      inclusionRule: "No broad comparable key; only use as negative/hold fixture evidence.",
      holdRule: "Hold novelty/character, generic no-model, brand-only, accessory, damaged/parts, buying, and cross-device titles.",
      nextPrep: [
        "Expand generic negative fixture coverage.",
        "Keep brand-only overlap rows separate from exact model portable rows.",
      ],
    },
  ];

  const exactModelRowsForLater = portableRows.map((row) => ({
    family: row.family,
    brand: row.brand,
    modelExamples: modelExamples(row),
    currentDecision: "reference_only_not_runtime_candidate",
    whyLaterCandidate: [
      "exact model token exists",
      "device class can plausibly be portable speaker",
      "still needs official/durable product evidence and main approval",
    ],
    blockers: [
      "not runtime approved",
      "sample count may be thin",
      "must prove no amp/receiver/PA/soundbar/generic contamination",
    ],
  }));

  const ownerDecisions = [
    "Choose whether the first later speaker subset should be limited to portable Bluetooth speaker exact-model families only.",
    "Decide whether desktop/bookshelf speakers, soundbars, amp/receivers, and PA systems should become separate categories or permanent exclusions.",
    "Require official/durable product evidence for selected portable models before any runtime proposal.",
    "Keep whole speaker_audio_discovered approval blocked.",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "speaker_audio_discovered",
    scope: "Agent C speaker device-class runtime prep; split architecture only",
    sourceReportsRead: [
      "reports/category-wide-runtime-rollout-plan-2026-05-12.md",
      "reports/subagent-implementation-prep-next-gate-latest.md",
      "reports/category-runtime-readiness-board-latest.md",
      "reports/pass-category-expansion-rollup-latest.md",
      "reports/speaker-model-family-device-class-fixture-packet-latest.md/json",
      "reports/speaker-audio-device-class-split-prep-latest.md/json",
      "reports/speaker-no-mutation-runtime-dry-run-latest.md/json",
      "reports/speaker-artifact-consistency-audit-latest.md/json",
      "category-intelligence/speaker_audio_discovered/* read-only",
    ],
    metrics: {
      totalSamples: splitPrep.metrics.total,
      normalRows: splitPrep.metrics.normal,
      modelMatchedRate: splitPrep.metrics.modelMatchedRate,
      genericFamilyRate: splitPrep.metrics.genericFamilyRate,
      dryRunRows: fixturePacket.metrics.dryRunRows,
      dryRunFailedRows: fixturePacket.metrics.dryRunFailedRows,
      referenceOnlyRows: fixturePacket.metrics.referenceOnlyRows,
      holdRows: fixturePacket.metrics.holdRows,
      candidatePositiveOnlyRows: fixturePacket.metrics.candidatePositiveOnlyRows,
      runtimeApprovedRows: fixturePacket.metrics.runtimeApprovedRows,
      portableReferenceFamilies: portableRows.length,
      boundaryHoldFamilies: boundaryRows.length,
      genericOverlapRows: genericRows.length,
    },
    deviceClassRows,
    exactModelRowsForLater,
    boundaryAssertions: [
      "Amp/receiver, PA/karaoke systems, soundbars, and desktop/bookshelf speakers must stay out of portable speaker comparable keys.",
      "Portable exact-model rows are reference-only until main approval and source evidence backfill.",
      "Brand-only overlap is not model-coded evidence.",
      "Generic/novelty/parts/accessory rows are hold fixtures, not candidate rows.",
    ],
    ownerDecisions,
    blockedRuntimeActions: [
      "Do not approve whole speaker_audio_discovered.",
      "Do not edit runtime parser, catalog, candidate pool, Supabase, cron, lifecycle, or pack UI.",
      "Do not claim candidate-pool/public readiness.",
      "Do not compare amp/receiver/PA/soundbar/desktop speaker rows against portable Bluetooth speaker keys.",
    ],
    nextReportOnlySteps: [
      "Prepare official/durable source evidence for a small portable exact-model subset.",
      "Prepare desktop/bookshelf pair-vs-single and active/passive fixture examples if that lane is kept.",
      "Prepare soundbar and PA/karaoke negative boundary packets before any broad speaker work.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "speaker-device-class-runtime-prep-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const classRows = deviceClassRows
    .map((row) => {
      const examples = row.examples.length > 0 ? row.examples.join("<br>") : "-";
      return `| ${row.deviceClass} | ${row.decision} | ${row.comparableKeyPolicy} | ${examples.replace(/\|/g, "/")} | ${row.holdRule.replace(/\|/g, "/")} |`;
    })
    .join("\n");

  const laterRows = exactModelRowsForLater
    .map((row) => `| ${row.family} | ${row.brand} | ${row.modelExamples.join("<br>")} | ${row.currentDecision} |`)
    .join("\n");

  const md = [
    "# Speaker Device-Class Runtime Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only implementation prep for Agent C. This keeps speaker/audio in split-architecture mode and does not approve runtime wiring, public promotion, candidate-pool policy, production DB mutation, or direct project-log edits.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.totalSamples}`,
    `- model-matched/generic-family rate: ${report.metrics.modelMatchedRate}% / ${report.metrics.genericFamilyRate}%`,
    `- dry-run rows/failed rows: ${report.metrics.dryRunRows}/${report.metrics.dryRunFailedRows}`,
    `- reference-only/hold rows: ${report.metrics.referenceOnlyRows}/${report.metrics.holdRows}`,
    `- runtime-approved/candidate-positive rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.candidatePositiveOnlyRows}`,
    `- portable reference families: ${report.metrics.portableReferenceFamilies}`,
    `- boundary hold families: ${report.metrics.boundaryHoldFamilies}`,
    "",
    "## Device-Class Split",
    "",
    "| device_class | decision | comparable_key_policy | examples | hold_rule |",
    "| --- | --- | --- | --- | --- |",
    classRows,
    "",
    "## Exact-Model Rows For Later Narrow Review",
    "",
    "These remain reference-only and are not runtime candidates yet.",
    "",
    "| family | brand | model_examples | current_decision |",
    "| --- | --- | --- | --- |",
    laterRows,
    "",
    "## Boundary Assertions",
    "",
    ...report.boundaryAssertions.map((line) => `- ${line}`),
    "",
    "## Owner Decisions Still Blocked",
    "",
    ...ownerDecisions.map((line) => `- ${line}`),
    "",
    "## Blocked Runtime Actions",
    "",
    ...report.blockedRuntimeActions.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Steps",
    "",
    ...report.nextReportOnlySteps.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-device-class-runtime-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-device-class-runtime-prep-latest.json");
  console.log("wrote reports/speaker-device-class-runtime-prep-latest.md");
  console.log(
    `speaker device-class runtime prep: classes=${deviceClassRows.length}, later_exact_model_rows=${exactModelRowsForLater.length}, runtimeApprovedRows=${report.metrics.runtimeApprovedRows}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
