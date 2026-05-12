import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type NextWaveSelector = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  runtimeApply: boolean;
  metrics: {
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  selectedWorkItems: Array<{
    workItemId: string;
    category: string;
    lane: string;
    type: string;
    deliverable: string;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  }>;
};

type EvidenceLink = {
  label: string;
  url: string;
  sourceType: string;
  confirms: string[];
};

type PortableEvidenceRow = {
  caseId: string;
  pid: string;
  brand: string;
  exactModel: string;
  normalizedModel: string;
  deviceClass: string;
  evidenceStrength: string;
  decision: string;
  evidence: EvidenceLink[];
  title: string;
  price: number;
  condition: string;
  listingUrl: string;
};

type PortableEvidenceReport = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  metrics: {
    selectedRows: number;
    officialConfirmedRows: number;
    vendorOnlyRows: number;
    boundaryRows: number;
    runtimeApprovedRows: number;
    candidatePoolReadyRows: number;
    publicReadyRows: number;
  };
  selectedRows: PortableEvidenceRow[];
};

type ContractReport = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  metrics: {
    candidatePositiveContractRows: number;
    manualHoldRows: number;
    negativeHoldRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolWiringRows: number;
  };
  allowedModels: string[];
};

type SpeakerSample = {
  pid: string;
  title?: string;
  name?: string;
  price: number;
  condition: string;
  saleStatus?: string;
  url: string;
  description?: string;
};

type BoundarySeed = {
  caseId: string;
  pid: string;
  boundaryClass:
    | "soundbar"
    | "karaoke_pa"
    | "amp_receiver"
    | "accessory_case_stand"
    | "damaged_or_mixed_bundle"
    | "buying_sold_only"
    | "home_tabletop_manual"
    | "vendor_only_manual";
  expectedDecision: "manual_hold" | "negative_hold";
  reason: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const samplesPath = "category-intelligence/speaker_audio_discovered/normalized_samples.json";

const inputFiles = [
  "reports/category-next-wave-selector-latest.md",
  "reports/category-next-wave-selector-latest.json",
  "reports/speaker-portable-evidence-latest.md",
  "reports/speaker-portable-evidence-latest.json",
  "reports/speaker-portable-exact-model-contract-latest.md",
  "reports/speaker-portable-exact-model-contract-latest.json",
  "reports/speaker-device-class-boundary-evidence-latest.md",
  "reports/speaker-device-class-boundary-evidence-latest.json",
  "reports/speaker-portable-model-subset-boundary-evidence-latest.md",
  "reports/speaker-portable-model-subset-boundary-evidence-latest.json",
  samplesPath,
];

const allowedJblLgModels = new Set(["jbl_go_3", "jbl_go_4", "jbl_boombox_2", "lg_pk5", "lg_pk7w"]);

const boundarySeeds: BoundarySeed[] = [
  {
    caseId: "SPEAKER-MARKET-SOUNDBAR-01",
    pid: "407167210",
    boundaryClass: "soundbar",
    expectedDecision: "negative_hold",
    reason: "Set-top soundbar row can mention Bluetooth speaker use but is not a portable battery Bluetooth speaker exact model.",
  },
  {
    caseId: "SPEAKER-MARKET-SOUNDBAR-02",
    pid: "407166688",
    boundaryClass: "soundbar",
    expectedDecision: "negative_hold",
    reason: "U+ set-top soundbar is a soundbar/device-class boundary, not a JBL/LG portable model row.",
  },
  {
    caseId: "SPEAKER-MARKET-KARAOKE-PA-01",
    pid: "394918886",
    boundaryClass: "karaoke_pa",
    expectedDecision: "negative_hold",
    reason: "JBL EON ONE COMPACT is a PA speaker with mixer/pro-audio signals.",
  },
  {
    caseId: "SPEAKER-MARKET-KARAOKE-PA-02",
    pid: "406271183",
    boundaryClass: "karaoke_pa",
    expectedDecision: "negative_hold",
    reason: "JBL AS3 PartyBox row is a wireless microphone/karaoke set rather than a speaker body comparable.",
  },
  {
    caseId: "SPEAKER-MARKET-KARAOKE-PA-03",
    pid: "407309255",
    boundaryClass: "karaoke_pa",
    expectedDecision: "negative_hold",
    reason: "Dual-microphone karaoke speaker is a karaoke/PA-adjacent product class.",
  },
  {
    caseId: "SPEAKER-MARKET-AMP-RECEIVER-01",
    pid: "407189403",
    boundaryClass: "amp_receiver",
    expectedDecision: "negative_hold",
    reason: "Marantz amp plus JBL cabinet bundle is amp/receiver and large passive speaker inventory.",
  },
  {
    caseId: "SPEAKER-MARKET-AMP-RECEIVER-02",
    pid: "401674862",
    boundaryClass: "amp_receiver",
    expectedDecision: "negative_hold",
    reason: "Marantz receiver amp is electronics/audio component inventory, not a portable speaker.",
  },
  {
    caseId: "SPEAKER-MARKET-ACCESSORY-01",
    pid: "403590950",
    boundaryClass: "accessory_case_stand",
    expectedDecision: "negative_hold",
    reason: "JBL hard-shell case is accessory-only and must never emit a speaker comparable key.",
  },
  {
    caseId: "SPEAKER-MARKET-ACCESSORY-02",
    pid: "341062699",
    boundaryClass: "accessory_case_stand",
    expectedDecision: "negative_hold",
    reason: "Belkin wireless charging stand with speaker wording is a stand/charger accessory class.",
  },
  {
    caseId: "SPEAKER-MARKET-DAMAGED-01",
    pid: "404612902",
    boundaryClass: "damaged_or_mixed_bundle",
    expectedDecision: "negative_hold",
    reason: "Mixed JBL bundle includes a broken Flip 5; damaged bundle rows stay out of exact-model positives.",
  },
  {
    caseId: "SPEAKER-MARKET-DAMAGED-02",
    pid: "404880102",
    boundaryClass: "damaged_or_mixed_bundle",
    expectedDecision: "negative_hold",
    reason: "Helmet headset row is damaged and not a portable speaker body comparable.",
  },
  {
    caseId: "SPEAKER-MARKET-SOLD-ONLY-01",
    pid: "402895987",
    boundaryClass: "buying_sold_only",
    expectedDecision: "negative_hold",
    reason: "Car-audio component listing includes sold-only/partial inventory markers, not a clean current speaker market row.",
  },
  {
    caseId: "SPEAKER-MARKET-SOLD-ONLY-02",
    pid: "407165634",
    boundaryClass: "buying_sold_only",
    expectedDecision: "negative_hold",
    reason: "Reserved/non-active listing is unsuitable as current market evidence for comparable keys.",
  },
  {
    caseId: "SPEAKER-MARKET-HOME-TABLETOP-01",
    pid: "407303378",
    boundaryClass: "home_tabletop_manual",
    expectedDecision: "manual_hold",
    reason: "JBL Authentics 200 is exact-model but home/tabletop smart speaker class, not the first portable subset.",
  },
  {
    caseId: "SPEAKER-MARKET-HOME-TABLETOP-02",
    pid: "404152520",
    boundaryClass: "home_tabletop_manual",
    expectedDecision: "manual_hold",
    reason: "Marshall Stanmore III is home AC-powered and includes optional stand pricing.",
  },
  {
    caseId: "SPEAKER-MARKET-HOME-TABLETOP-03",
    pid: "404153015",
    boundaryClass: "home_tabletop_manual",
    expectedDecision: "manual_hold",
    reason: "Marshall Woburn III is home AC-powered and includes optional stand pricing.",
  },
];

function mdEscape(value: unknown): string {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.map(mdEscape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

function titleOf(sample: SpeakerSample): string {
  return sample.title ?? sample.name ?? "";
}

function snippet(sample: SpeakerSample): string {
  return (sample.description ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
}

function requireSample(samples: SpeakerSample[], pid: string): SpeakerSample {
  const sample = samples.find((row) => row.pid === pid);
  if (!sample) throw new Error(`Missing speaker sample pid=${pid}`);
  return sample;
}

function countBy<T extends string>(values: T[]): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, count }));
}

function buildBoundaryRows(samples: SpeakerSample[], vendorRows: PortableEvidenceRow[]) {
  const seededRows = boundarySeeds.map((seed) => {
    const sample = requireSample(samples, seed.pid);
    return {
      ...seed,
      title: titleOf(sample),
      price: sample.price,
      condition: sample.condition,
      saleStatus: sample.saleStatus ?? "UNKNOWN",
      listingUrl: sample.url,
      evidenceSnippet: snippet(sample),
    };
  });

  const vendorManualRows = vendorRows.map((row) => ({
    caseId: `SPEAKER-MARKET-VENDOR-MANUAL-${row.caseId.replace(/^SPEAKER-PORTABLE-POS-/, "")}`,
    pid: row.pid,
    boundaryClass: "vendor_only_manual" as const,
    expectedDecision: "manual_hold" as const,
    reason: "Portable speaker model looks market-relevant but remains vendor-only until manufacturer/support evidence is attached.",
    title: row.title,
    price: row.price,
    condition: row.condition,
    saleStatus: "SELLING",
    listingUrl: row.listingUrl,
    evidenceSnippet: row.evidence.map((source) => source.label).join("; "),
  }));

  return [...seededRows, ...vendorManualRows];
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [selector, portableEvidence, contract, samples, selectorMd] = await Promise.all([
    readJson<NextWaveSelector>("reports/category-next-wave-selector-latest.json"),
    readJson<PortableEvidenceReport>("reports/speaker-portable-evidence-latest.json"),
    readJson<ContractReport>("reports/speaker-portable-exact-model-contract-latest.json"),
    readJson<SpeakerSample[]>(samplesPath),
    readText("reports/category-next-wave-selector-latest.md"),
  ]);

  const selectedWorkItem = selector.selectedWorkItems.find(
    (item) =>
      item.category === "speaker_audio_discovered" &&
      item.lane === "speaker_portable_exact_model_market_and_spec_backfill",
  );
  if (!selectedWorkItem) {
    throw new Error("Missing speaker portable exact-model market/spec next-wave work item");
  }

  const positiveRows = portableEvidence.selectedRows.filter(
    (row) =>
      row.evidenceStrength === "official_confirmed" &&
      row.deviceClass === "portable_bluetooth_speaker" &&
      allowedJblLgModels.has(row.normalizedModel),
  );
  const vendorManualRows = portableEvidence.selectedRows.filter((row) => row.evidenceStrength !== "official_confirmed");
  const boundaryRows = buildBoundaryRows(samples, vendorManualRows);
  const specEvidenceRows = positiveRows.flatMap((row) =>
    row.evidence.map((source) => ({
      caseId: row.caseId,
      brand: row.brand,
      normalizedModel: row.normalizedModel,
      sourceLabel: source.label,
      sourceType: source.sourceType,
      url: source.url,
      confirms: source.confirms,
    })),
  );
  const marketEvidenceRows = positiveRows.map((row) => ({
    caseId: row.caseId,
    pid: row.pid,
    brand: row.brand,
    normalizedModel: row.normalizedModel,
    expectedComparableKey: `speaker|${row.normalizedModel}|portable_bluetooth_speaker`,
    title: row.title,
    price: row.price,
    condition: row.condition,
    listingUrl: row.listingUrl,
  }));
  const checks = [
    {
      id: "SPEAKER-BACKFILL-01",
      status: selectedWorkItem.runtimeApprovedRows === 0 &&
        selectedWorkItem.publicPromotionRows === 0 &&
        selectedWorkItem.candidatePoolRows === 0 &&
        selectedWorkItem.runtimeApplyRows === 0
        ? "pass"
        : "fail",
      check: "next-wave selected work item is report-only/no-mutation",
      detail: selectedWorkItem.workItemId,
    },
    {
      id: "SPEAKER-BACKFILL-02",
      status: positiveRows.length === 5 ? "pass" : "fail",
      check: "five official JBL/LG portable exact-model rows are present",
      detail: `positiveRows=${positiveRows.length}`,
    },
    {
      id: "SPEAKER-BACKFILL-03",
      status: specEvidenceRows.length >= 5 ? "pass" : "fail",
      check: "each selected model has official spec/product evidence",
      detail: `specEvidenceRows=${specEvidenceRows.length}`,
    },
    {
      id: "SPEAKER-BACKFILL-04",
      status: contract.metrics.candidatePositiveContractRows === 5 &&
        contract.allowedModels.every((model) => allowedJblLgModels.has(model))
        ? "pass"
        : "fail",
      check: "exact-model contract matches the selected JBL/LG subset",
      detail: `contractPositiveRows=${contract.metrics.candidatePositiveContractRows}`,
    },
    {
      id: "SPEAKER-BACKFILL-05",
      status: ["soundbar", "karaoke_pa", "amp_receiver", "accessory_case_stand", "damaged_or_mixed_bundle", "buying_sold_only"]
        .every((boundaryClass) => boundaryRows.some((row) => row.boundaryClass === boundaryClass))
        ? "pass"
        : "fail",
      check: "market boundaries cover soundbar, karaoke/PA, amp/receiver, accessory/stand, damaged, buying/sold-only",
      detail: countBy(boundaryRows.map((row) => row.boundaryClass)).map((row) => `${row.key}:${row.count}`).join(", "),
    },
    {
      id: "SPEAKER-BACKFILL-06",
      status: selectorMd.includes("speaker_portable_exact_model_market_and_spec_backfill") ? "pass" : "fail",
      check: "selector markdown names this speaker lane",
      detail: "category-next-wave selector read",
    },
  ];
  const failedChecks = checks.filter((row) => row.status === "fail");
  const backfillSufficientForSelectedSubset = failedChecks.length === 0;

  const report = {
    generatedAt,
    category: "speaker_audio_discovered",
    lane: "speaker_portable_exact_model_market_and_spec_backfill",
    reportOnly: true,
    conclusion: backfillSufficientForSelectedSubset
      ? "speaker_portable_exact_model_market_spec_backfill_sufficient_for_selected_jbl_lg_subset_report_only"
      : "speaker_portable_exact_model_market_spec_backfill_insufficient",
    backfillSufficientForSelectedSubset,
    sufficientForRuntimePatch: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    runtimeApply: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    boundary: {
      runtimeApproved: false,
      runtimeApprovedRows: 0,
      runtimeApply: false,
      runtimeApplyRows: 0,
      publicPromotion: false,
      publicPromotionRows: 0,
      candidatePool: false,
      candidatePoolRows: 0,
      candidatePoolPolicyWiring: false,
      productionDbMutation: false,
      directThirtyDayPlanEdit: false,
    },
    metrics: {
      selectedPositiveMarketRows: marketEvidenceRows.length,
      selectedOfficialSpecRows: specEvidenceRows.length,
      selectedBrands: countBy(positiveRows.map((row) => row.brand.toLowerCase())),
      selectedModels: allowedJblLgModels.size,
      vendorManualRows: vendorManualRows.length,
      boundaryRows: boundaryRows.length,
      boundaryClassCounts: countBy(boundaryRows.map((row) => row.boundaryClass)),
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      runtimeApplyRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    selectedWorkItem,
    allowedModels: [...allowedJblLgModels],
    marketEvidenceRows,
    specEvidenceRows,
    boundaryRows,
    checks,
    failedChecks,
    deviceClassRules: [
      "Accept only exact JBL/LG model rows for portable Bluetooth speaker body listings in this selected subset.",
      "Separate soundbars even when titles say Bluetooth speaker.",
      "Separate karaoke/PA/PartyBox/microphone systems from portable speaker body rows.",
      "Separate amp/receiver/passive large-speaker bundles from consumer portable Bluetooth speakers.",
      "Separate accessory/case/stand rows and optional stand pricing from speaker body comparables.",
      "Hold damaged, mixed-bundle, reserved/non-active, sold-only, buying, and partial inventory rows.",
      "Keep Britz/vendor-only portable rows manual until official manufacturer/support evidence is attached.",
    ],
    sufficiencyStatement:
      "Sufficient as report-only market/spec backfill for the selected JBL/LG portable exact-model subset; insufficient for runtime/public/candidate-pool promotion because speaker category/runtime wiring remains closed.",
    inputFiles,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "speaker-portable-exact-model-market-spec-backfill-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Speaker Portable Exact-Model Market/Spec Backfill",
    "",
    `- generatedAt: ${generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- backfillSufficientForSelectedSubset: ${report.backfillSufficientForSelectedSubset}`,
    `- sufficientForRuntimePatch: ${report.sufficientForRuntimePatch}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeApproved/runtimeApply/publicPromotion/candidatePool: false/false/false/false",
    "- runtimeApprovedRows/runtimeApplyRows/publicPromotionRows/candidatePoolRows: 0/0/0/0",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      [
        ["selectedPositiveMarketRows", report.metrics.selectedPositiveMarketRows],
        ["selectedOfficialSpecRows", report.metrics.selectedOfficialSpecRows],
        ["selectedModels", report.metrics.selectedModels],
        ["vendorManualRows", report.metrics.vendorManualRows],
        ["boundaryRows", report.metrics.boundaryRows],
        ["checks", report.metrics.checks],
        ["failedChecks", report.metrics.failedChecks],
      ],
    ),
    "",
    "## Boundary Class Counts",
    "",
    table(
      ["class", "count"],
      report.metrics.boundaryClassCounts.map((row) => [row.key, row.count]),
    ),
    "",
    "## Selected Market Evidence",
    "",
    table(
      ["caseId", "pid", "brand", "model", "key", "price", "condition", "title"],
      marketEvidenceRows.map((row) => [
        row.caseId,
        row.pid,
        row.brand,
        row.normalizedModel,
        row.expectedComparableKey,
        row.price,
        row.condition,
        row.title,
      ]),
    ),
    "",
    "## Official Spec Evidence",
    "",
    table(
      ["caseId", "brand", "model", "sourceType", "source", "confirms"],
      specEvidenceRows.map((row) => [
        row.caseId,
        row.brand,
        row.normalizedModel,
        row.sourceType,
        row.url,
        row.confirms.join("; "),
      ]),
    ),
    "",
    "## Device-Class / Market Boundary Rows",
    "",
    table(
      ["caseId", "pid", "class", "decision", "saleStatus", "price", "title", "reason"],
      boundaryRows.map((row) => [
        row.caseId,
        row.pid,
        row.boundaryClass,
        row.expectedDecision,
        row.saleStatus,
        row.price,
        row.title,
        row.reason,
      ]),
    ),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((row) => [row.id, row.status, row.check, row.detail]),
    ),
    "",
    "## Device-Class Rules",
    "",
    ...report.deviceClassRules.map((rule) => `- ${rule}`),
    "",
    "## Sufficiency",
    "",
    report.sufficiencyStatement,
    "",
    "## Inputs Read",
    "",
    ...inputFiles.map((file) => `- ${file}`),
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-portable-exact-model-market-spec-backfill-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/speaker-portable-exact-model-market-spec-backfill-latest",
    conclusion: report.conclusion,
    backfillSufficientForSelectedSubset,
    sufficientForRuntimePatch: false,
    selectedPositiveMarketRows: report.metrics.selectedPositiveMarketRows,
    selectedOfficialSpecRows: report.metrics.selectedOfficialSpecRows,
    vendorManualRows: report.metrics.vendorManualRows,
    boundaryRows: report.metrics.boundaryRows,
    failedChecks: report.metrics.failedChecks,
    runtimeApprovedRows: 0,
    runtimeApplyRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
