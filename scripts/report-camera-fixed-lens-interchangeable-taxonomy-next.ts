import fs from "node:fs";
import path from "node:path";

type NextWaveSelector = {
  selectedWorkItems?: Array<{
    category: string;
    lane: string;
    type: string;
    recommendation: string;
  }>;
};

type CameraFixedLensReview = {
  metrics?: Record<string, unknown>;
  fixedLensRows?: SourceRow[];
  accessoryRows?: SourceRow[];
};

type CameraInterchangeableReview = {
  metrics?: Record<string, unknown>;
  rows?: SourceRow[];
};

type CameraPackageFixture = {
  metrics?: Record<string, unknown>;
  fixtureGroups?: Array<{
    group: string;
    currentRows: string[];
    decision: string;
  }>;
  dryRunRows?: SourceRow[];
};

type CameraBodyOnlyExecutor = {
  metrics?: {
    rows?: number;
    positiveRows?: number;
    manualRows?: number;
    holdRows?: number;
    distinctPositiveFamilies?: number;
    failedRows?: number;
  };
  rows?: SourceRow[];
};

type NormalizedSample = {
  pid?: string;
  title?: string;
  name?: string;
  price?: number;
  saleStatus?: string;
  description?: string;
  url?: string;
};

type SourceRow = {
  caseId?: string;
  pid?: string;
  title?: string;
  price?: number;
  model_key?: string | null;
  modelKey?: string | null;
  package_config?: string | null;
  packageSignal?: string;
  reviewAction?: string;
  accessoryClass?: string;
  coverageFamily?: string;
  confidence?: string;
  action?: string;
  expectedDecision?: string;
  actualDecision?: string;
  actualComparableKey?: string | null;
  comparableKey?: string | null;
  actualReason?: string;
  reason?: string;
  pass?: boolean;
};

type TaxonomyDecision =
  | "safest_future_internal_only_runtime_sublane"
  | "manual_or_hold_until_taxonomy_approved"
  | "hard_hold";

type TaxonomyRow = {
  sublane: string;
  decision: TaxonomyDecision;
  source: string;
  pid: string;
  title: string;
  evidence: string;
  futureInternalOnlyRuntimeCandidate: boolean;
};

type SublaneSummary = {
  sublane: string;
  rowCount: number;
  decision: TaxonomyDecision;
  safestForFutureInternalOnlyRuntime: boolean;
  holdReason: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const sourceFiles = [
  "reports/category-next-wave-selector-latest.md",
  "reports/category-next-wave-selector-latest.json",
  "reports/camera-body-lens-package-fixture-packet-latest.md",
  "reports/camera-body-lens-package-fixture-packet-latest.json",
  "reports/camera-fixed-lens-accessory-review-latest.md",
  "reports/camera-fixed-lens-accessory-review-latest.json",
  "reports/camera-interchangeable-package-review-latest.md",
  "reports/camera-interchangeable-package-review-latest.json",
  "reports/camera-smaller-exact-subset-latest.md",
  "reports/camera-smaller-exact-subset-latest.json",
  "reports/camera-body-only-exact-model-no-mutation-executor-latest.md",
  "reports/camera-body-only-exact-model-no-mutation-executor-latest.json",
  "reports/camera-internal-runtime-route-latest.md",
  "reports/camera-internal-runtime-route-latest.json",
  "category-intelligence/camera_discovered/normalized_samples.json",
];

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(appDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function titleOf(row: SourceRow | NormalizedSample): string {
  return String(row.title ?? ("name" in row ? row.name : "") ?? "");
}

function pidOf(row: SourceRow | NormalizedSample, fallback: string): string {
  return String(row.pid ?? fallback);
}

function pushUnique(rows: TaxonomyRow[], row: TaxonomyRow) {
  const key = `${row.sublane}:${row.pid}:${row.title}`;
  if (!rows.some((existing) => `${existing.sublane}:${existing.pid}:${existing.title}` === key)) {
    rows.push(row);
  }
}

function summarize(rows: TaxonomyRow[], sublane: string, decision: TaxonomyDecision, safest: boolean, holdReason: string): SublaneSummary {
  return {
    sublane,
    rowCount: rows.filter((row) => row.sublane === sublane).length,
    decision,
    safestForFutureInternalOnlyRuntime: safest,
    holdReason,
  };
}

function table(rows: string[][]): string {
  const [header, ...body] = rows;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

const nextWave = readJson<NextWaveSelector>("reports/category-next-wave-selector-latest.json") ?? {};
const fixedLensReview = readJson<CameraFixedLensReview>("reports/camera-fixed-lens-accessory-review-latest.json") ?? {};
const interchangeableReview = readJson<CameraInterchangeableReview>("reports/camera-interchangeable-package-review-latest.json") ?? {};
const packageFixture = readJson<CameraPackageFixture>("reports/camera-body-lens-package-fixture-packet-latest.json") ?? {};
const bodyOnlyExecutor = readJson<CameraBodyOnlyExecutor>("reports/camera-body-only-exact-model-no-mutation-executor-latest.json") ?? {};
const normalizedSamples = readJson<NormalizedSample[]>("category-intelligence/camera_discovered/normalized_samples.json") ?? [];

const bodyOnlyPositiveRows = (bodyOnlyExecutor.rows ?? []).filter((row) =>
  String(row.caseId ?? "").includes("POS") &&
  row.actualDecision === "candidate_positive_contract_only"
);

const bodyOnlyManualRows = (bodyOnlyExecutor.rows ?? []).filter((row) =>
  String(row.caseId ?? "").includes("MANUAL")
);

const bodyOnlyHoldRows = (bodyOnlyExecutor.rows ?? []).filter((row) =>
  String(row.caseId ?? "").includes("HOLD")
);

const rows: TaxonomyRow[] = [];

for (const row of bodyOnlyPositiveRows) {
  pushUnique(rows, {
    sublane: "interchangeable_body_only_exact_model",
    decision: "safest_future_internal_only_runtime_sublane",
    source: "camera-body-only-exact-model-no-mutation-executor",
    pid: pidOf(row, row.caseId ?? "body-only-positive"),
    title: titleOf(row),
    evidence: row.actualComparableKey ?? row.actualReason ?? "exact body-only no-lens signal",
    futureInternalOnlyRuntimeCandidate: true,
  });
}

for (const row of fixedLensReview.fixedLensRows ?? []) {
  pushUnique(rows, {
    sublane: "fixed_lens_compact",
    decision: row.confidence === "known_model_key"
      ? "manual_or_hold_until_taxonomy_approved"
      : "hard_hold",
    source: "camera-fixed-lens-accessory-review",
    pid: pidOf(row, "fixed-lens"),
    title: titleOf(row),
    evidence: `${row.coverageFamily ?? "fixed_lens"} / ${row.confidence ?? "unknown_confidence"} / ${row.action ?? "review"}`,
    futureInternalOnlyRuntimeCandidate: false,
  });
}

for (const row of bodyOnlyManualRows) {
  pushUnique(rows, {
    sublane: "interchangeable_unknown_or_full_box_manual",
    decision: "manual_or_hold_until_taxonomy_approved",
    source: "camera-body-only-exact-model-no-mutation-executor",
    pid: pidOf(row, row.caseId ?? "body-only-manual"),
    title: titleOf(row),
    evidence: row.actualReason ?? row.reason ?? "exact model but package/no-lens proof missing",
    futureInternalOnlyRuntimeCandidate: false,
  });
}

for (const row of interchangeableReview.rows ?? []) {
  const signal = row.packageSignal ?? "";
  const sublane = signal.includes("full_box") || signal.includes("bundle")
    ? "interchangeable_unknown_or_full_box_manual"
    : "interchangeable_package_signal_missing_hold";
  pushUnique(rows, {
    sublane,
    decision: "manual_or_hold_until_taxonomy_approved",
    source: "camera-interchangeable-package-review",
    pid: pidOf(row, "interchangeable-review"),
    title: titleOf(row),
    evidence: `${signal || "package_signal_missing"} / ${row.reviewAction ?? "review"}`,
    futureInternalOnlyRuntimeCandidate: false,
  });
}

for (const row of bodyOnlyHoldRows) {
  const title = titleOf(row);
  let sublane = "body_kit_lens_bundle";
  if (/렌즈$|줌렌즈|단렌즈|바디캡|렌즈밑캡|캡/.test(title)) sublane = "lens_only_accessory";
  if (/하자|부품|수리|고장/.test(title)) sublane = "damaged_parts";
  if (/구매|삽니다|구해|매입/.test(title)) sublane = "buying_sold_only";
  if (/G7X|GR3|사이버샷|X70/i.test(title)) sublane = "fixed_lens_compact";

  pushUnique(rows, {
    sublane,
    decision: sublane === "body_kit_lens_bundle" ? "manual_or_hold_until_taxonomy_approved" : "hard_hold",
    source: "camera-body-only-exact-model-no-mutation-executor",
    pid: pidOf(row, row.caseId ?? "body-only-hold"),
    title,
    evidence: row.actualReason ?? row.reason ?? "held by body-only executor",
    futureInternalOnlyRuntimeCandidate: false,
  });
}

for (const row of fixedLensReview.accessoryRows ?? []) {
  pushUnique(rows, {
    sublane: "lens_only_accessory",
    decision: "hard_hold",
    source: "camera-fixed-lens-accessory-review",
    pid: pidOf(row, "accessory"),
    title: titleOf(row),
    evidence: `${row.accessoryClass ?? "camera_accessory"} / ${row.action ?? "exclude"}`,
    futureInternalOnlyRuntimeCandidate: false,
  });
}

for (const group of packageFixture.fixtureGroups ?? []) {
  if (group.group !== "true_lens_kit_references" && group.group !== "lens_or_accessory_hard_holds") continue;
  for (const [index, title] of group.currentRows.entries()) {
    pushUnique(rows, {
      sublane: group.group === "true_lens_kit_references" ? "body_kit_lens_bundle" : "lens_only_accessory",
      decision: group.group === "true_lens_kit_references"
        ? "manual_or_hold_until_taxonomy_approved"
        : "hard_hold",
      source: "camera-body-lens-package-fixture-packet",
      pid: `${group.group}-${index + 1}`,
      title,
      evidence: `${group.decision}; must not merge with body-only`,
      futureInternalOnlyRuntimeCandidate: false,
    });
  }
}

const normalizedSoldRows = normalizedSamples
  .filter((row) => row.saleStatus === "SOLD_OUT")
  .filter((row) => /바디|렌즈|카메라|미러리스|디카/i.test(titleOf(row)))
  .slice(0, 6);

for (const row of normalizedSoldRows) {
  pushUnique(rows, {
    sublane: "buying_sold_only",
    decision: "hard_hold",
    source: "camera normalized samples",
    pid: pidOf(row, "sold-only"),
    title: titleOf(row),
    evidence: `saleStatus=${row.saleStatus}; sold-only row is not live acquisition/runtime input`,
    futureInternalOnlyRuntimeCandidate: false,
  });
}

const normalizedDamagedRows = normalizedSamples
  .filter((row) => /하자|고장|수리필요|부품용|파손|작동불/i.test(`${titleOf(row)} ${row.description ?? ""}`))
  .slice(0, 5);

for (const row of normalizedDamagedRows) {
  pushUnique(rows, {
    sublane: "damaged_parts",
    decision: "hard_hold",
    source: "camera normalized samples",
    pid: pidOf(row, "damaged"),
    title: titleOf(row),
    evidence: "damaged/parts/repair signal",
    futureInternalOnlyRuntimeCandidate: false,
  });
}

const explicitBuyingRows = normalizedSamples
  .filter((row) => /구매하고싶|삽니다|구합니다|매입|구해요/i.test(`${titleOf(row)} ${row.description ?? ""}`))
  .slice(0, 4);

for (const row of explicitBuyingRows) {
  pushUnique(rows, {
    sublane: "buying_sold_only",
    decision: "hard_hold",
    source: "camera normalized samples",
    pid: pidOf(row, "buying"),
    title: titleOf(row),
    evidence: "buying-intent/callout signal",
    futureInternalOnlyRuntimeCandidate: false,
  });
}

const summaries: SublaneSummary[] = [
  summarize(
    rows,
    "interchangeable_body_only_exact_model",
    "safest_future_internal_only_runtime_sublane",
    true,
    "Safe only for future internal-only runtime because exact model + explicit body/no-lens semantics already passed no-mutation fixtures; public and pool stay closed.",
  ),
  summarize(
    rows,
    "fixed_lens_compact",
    "manual_or_hold_until_taxonomy_approved",
    false,
    "Fixed-lens compact models need a separate taxonomy and must not share interchangeable body keys.",
  ),
  summarize(
    rows,
    "interchangeable_unknown_or_full_box_manual",
    "manual_or_hold_until_taxonomy_approved",
    false,
    "Exact interchangeable model without body-only/no-lens proof, full-box wording, and accessory inclusion must not infer package axis.",
  ),
  summarize(
    rows,
    "interchangeable_package_signal_missing_hold",
    "manual_or_hold_until_taxonomy_approved",
    false,
    "Known body model with missing package signal stays manual/hold until body-only, body+kit, or full-box policy is explicit.",
  ),
  summarize(
    rows,
    "body_kit_lens_bundle",
    "manual_or_hold_until_taxonomy_approved",
    false,
    "Body+kit/lens bundle needs lens identity and kit-vs-aftermarket policy; must not merge with body-only.",
  ),
  summarize(
    rows,
    "lens_only_accessory",
    "hard_hold",
    false,
    "Lens-only, cap, case, bag, cage, battery, strap, and accessory rows are not camera body comparables.",
  ),
  summarize(
    rows,
    "damaged_parts",
    "hard_hold",
    false,
    "Damaged, repair-needed, and parts rows are condition/exclusion rows, not normal camera comparables.",
  ),
  summarize(
    rows,
    "buying_sold_only",
    "hard_hold",
    false,
    "Buying-intent and sold-only rows are not live normal-sale candidates for runtime/pool readiness.",
  ),
];

const selectedNextWave = nextWave.selectedWorkItems?.find((item) =>
  item.category === "camera_discovered" ||
  item.lane.includes("camera")
);

const metrics = {
  taxonomyRows: rows.length,
  sublanes: summaries.length,
  safestFutureInternalOnlySublaneRows: summaries.filter((summary) => summary.safestForFutureInternalOnlyRuntime).length,
  fixedLensCompactRows: summaries.find((summary) => summary.sublane === "fixed_lens_compact")?.rowCount ?? 0,
  interchangeableBodyOnlyRows: summaries.find((summary) => summary.sublane === "interchangeable_body_only_exact_model")?.rowCount ?? 0,
  interchangeableUnknownOrFullBoxRows: summaries.find((summary) => summary.sublane === "interchangeable_unknown_or_full_box_manual")?.rowCount ?? 0,
  packageSignalMissingRows: summaries.find((summary) => summary.sublane === "interchangeable_package_signal_missing_hold")?.rowCount ?? 0,
  bodyKitLensBundleRows: summaries.find((summary) => summary.sublane === "body_kit_lens_bundle")?.rowCount ?? 0,
  lensOnlyAccessoryRows: summaries.find((summary) => summary.sublane === "lens_only_accessory")?.rowCount ?? 0,
  damagedPartsRows: summaries.find((summary) => summary.sublane === "damaged_parts")?.rowCount ?? 0,
  buyingSoldOnlyRows: summaries.find((summary) => summary.sublane === "buying_sold_only")?.rowCount ?? 0,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_taxonomy_split_only",
  category: "camera_discovered",
  conclusion: "camera_taxonomy_split_recommends_interchangeable_body_only_exact_model_for_future_internal_only_runtime_report_only",
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  runtimeApply: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  selectedNextWave,
  metrics,
  recommendedSublane: {
    lane: "interchangeable_body_only_exact_model",
    reason: "It is the only sublane with exact model + explicit body-only/no-lens evidence, 7 positive fixture rows, 4 positive families, and no-mutation/internal-route evidence while public and candidate-pool gates remain closed.",
    futureRuntimeScope: "future_internal_only_runtime_candidate_after_owner_review",
  },
  holdSublanes: summaries.filter((summary) => !summary.safestForFutureInternalOnlyRuntime),
  summaries,
  rows,
  sourceFilesRead: sourceFiles.filter((file) => fs.existsSync(path.join(appDir, file))),
};

function renderMarkdown(): string {
  return [
    "# Camera Fixed-Lens / Interchangeable Taxonomy Next",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    "- ownership: camera_taxonomy_split_only",
    "- reportOnly: true",
    "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring/runtimeApply: false/false/false/false",
    "- runtimeApproved/public/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "",
    "## Scope",
    "",
    "Report-only taxonomy split for camera rows. This does not edit runtime/src/lib, Supabase, cron/lifecycle, candidate pool, pack UI, public promotion, or the 30-day plan.",
    "",
    "## Metrics",
    "",
    table([
      ["metric", "value"],
      ["taxonomyRows", String(metrics.taxonomyRows)],
      ["sublanes", String(metrics.sublanes)],
      ["interchangeableBodyOnlyRows", String(metrics.interchangeableBodyOnlyRows)],
      ["fixedLensCompactRows", String(metrics.fixedLensCompactRows)],
      ["interchangeableUnknownOrFullBoxRows", String(metrics.interchangeableUnknownOrFullBoxRows)],
      ["packageSignalMissingRows", String(metrics.packageSignalMissingRows)],
      ["bodyKitLensBundleRows", String(metrics.bodyKitLensBundleRows)],
      ["lensOnlyAccessoryRows", String(metrics.lensOnlyAccessoryRows)],
      ["damagedPartsRows", String(metrics.damagedPartsRows)],
      ["buyingSoldOnlyRows", String(metrics.buyingSoldOnlyRows)],
      ["runtimeApprovedRows", "0"],
      ["publicPromotionRows", "0"],
      ["candidatePoolRows", "0"],
      ["runtimeApplyRows", "0"],
    ]),
    "",
    "## Sublane Decision",
    "",
    table([
      ["sublane", "rows", "decision", "future internal-only runtime", "hold reason"],
      ...summaries.map((summary) => [
        summary.sublane,
        String(summary.rowCount),
        summary.decision,
        summary.safestForFutureInternalOnlyRuntime ? "yes" : "no",
        summary.holdReason,
      ]),
    ]),
    "",
    "## Recommended Safest Sublane",
    "",
    "**interchangeable_body_only_exact_model** is the safest future internal-only runtime sublane. It has exact model identity plus explicit body-only/no-lens wording, already passed no-mutation body-only fixtures, and avoids fixed-lens compact, body+렌즈 bundle, lens-only, accessory, damaged, buying, and sold-only contamination.",
    "",
    "This is still not runtime approval. Any future runtime work must remain internal-only until owner/main-agent review, and public/candidate-pool gates stay closed.",
    "",
    "## Rows",
    "",
    table([
      ["sublane", "decision", "pid", "title", "evidence"],
      ...rows.map((row) => [
        row.sublane,
        row.decision,
        row.pid,
        row.title,
        row.evidence,
      ]),
    ]),
    "",
    "## Hold Rules",
    "",
    "- Fixed-lens compact rows stay separate from interchangeable body-only keys.",
    "- Interchangeable exact model rows without body-only/no-lens proof stay manual or hold.",
    "- Full-box and accessory-included wording does not prove no-lens or lens-kit package identity.",
    "- Body+kit/lens bundle rows need explicit lens identity and must not merge with body-only.",
    "- Lens-only and accessory rows are hard holds from camera body comparables.",
    "- Damaged/parts, buying-intent, and sold-only rows are hard holds for runtime/pool readiness.",
    "",
    "## Source Files Read",
    "",
    ...report.sourceFilesRead.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-fixed-lens-interchangeable-taxonomy-next-latest.json");
const mdPath = path.join(reportsDir, "camera-fixed-lens-interchangeable-taxonomy-next-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown());

console.log(JSON.stringify({
  conclusion: report.conclusion,
  taxonomyRows: metrics.taxonomyRows,
  recommendedSublane: report.recommendedSublane.lane,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  jsonPath,
  mdPath,
}, null, 2));
