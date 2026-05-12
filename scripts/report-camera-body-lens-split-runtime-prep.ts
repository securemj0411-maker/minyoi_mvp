import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExistingReport = {
  generatedAt?: string;
  reportOnly?: boolean;
  metrics?: Record<string, number>;
  conclusion?: string;
};

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  price?: number;
};

type TaxonomyClass =
  | "body_only"
  | "body_plus_kit_lens"
  | "body_plus_multi_lens_kit"
  | "lens_only"
  | "fixed_lens_compact"
  | "accessory_parts_damaged_buying";

type FixtureDecision = "positive_fixture_reference_only" | "manual_review" | "hold";

type FixtureRow = {
  caseId: string;
  taxonomyClass: TaxonomyClass;
  decision: FixtureDecision;
  pid: string;
  title: string;
  dangerousPatterns: string[];
  comparableKeyRule: string;
  reason: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

function mdEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function compact(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function findSample(samples: Sample[], pid: string, fallbackTitle: string): FixtureRow["title"] {
  const sample = samples.find((row) => row.pid === pid);
  return sample?.title ?? sample?.name ?? fallbackTitle;
}

function countBy<T extends string>(items: T[]): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function patternHits(title: string): string[] {
  const text = compact(title);
  const checks: Array<[string, RegExp]> = [
    ["카메라 + 렌즈", /(카메라|바디|body).{0,24}(\+|와|및|랑|,).{0,24}(렌즈|[0-9]{2,3}\s?-\s?[0-9]{2,3}|[0-9]{2,3}mm)/i],
    ["번들렌즈", /(번들렌즈|번들\s?렌즈|번들킷|번들\s?킷|렌즈\s?킷|더블\s?줌)/i],
    ["바디", /(바디|body|본체|바디만|본체만|바디\s?단품)/i],
    ["렌즈만", /(렌즈만|렌즈\s?단품|렌즈\s?단독|줌렌즈|렌즈입니다)/i],
    ["부품용", /(부품용|수리필요|수리용|하자있|고장|불량|에러|매입|구매하고싶|삽니다|바디캡|렌즈\s?캡|뒷캡)/i],
  ];
  return checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const [fixturePacket, splitPrep, dryRun, audit, samples] = await Promise.all([
    readJson<ExistingReport>("reports/camera-body-lens-package-fixture-packet-latest.json"),
    readJson<ExistingReport>("reports/camera-package-split-prep-latest.json"),
    readJson<ExistingReport>("reports/camera-no-mutation-runtime-dry-run-latest.json"),
    readJson<ExistingReport>("reports/camera-artifact-consistency-audit-latest.json"),
    readJson<Sample[]>("category-intelligence/camera_discovered/normalized_samples.json"),
  ]);

  const fixtureRows: FixtureRow[] = ([
    {
      caseId: "CAMERA-BODY-LENS-POS-01",
      taxonomyClass: "body_only",
      decision: "positive_fixture_reference_only",
      pid: "392737375",
      title: findSample(samples, "392737375", "캐논 EOS R6 Mark II 바디 알육막투 바디 보증남음"),
      dangerousPatterns: ["바디"],
      comparableKeyRule: "body key may be body-only only; lens axes must be absent or explicitly excluded",
      reason: "Explicit body wording plus normal body contents can become a future positive fixture after owner review, not runtime approval.",
    },
    {
      caseId: "CAMERA-BODY-LENS-POS-02",
      taxonomyClass: "body_plus_kit_lens",
      decision: "positive_fixture_reference_only",
      pid: "406410263",
      title: findSample(samples, "406410263", "후지필름 X-T4 + 18-55 번들킷 풀박스"),
      dangerousPatterns: ["카메라 + 렌즈", "번들렌즈"],
      comparableKeyRule: "body model and single kit-lens identity must both be part of the key",
      reason: "Explicit body plus 18-55 kit lens wording is useful fixture material, but cannot compare to body-only rows.",
    },
    {
      caseId: "CAMERA-BODY-LENS-POS-03",
      taxonomyClass: "body_plus_multi_lens_kit",
      decision: "positive_fixture_reference_only",
      pid: "406905241",
      title: findSample(samples, "406905241", "니콘 Z5 + 렌즈 2종(24-70,85)풀박스 판매"),
      dangerousPatterns: ["카메라 + 렌즈"],
      comparableKeyRule: "multi-lens package needs a separate package key and must not merge with single kit lens",
      reason: "Two named lenses make this a package fixture, not a generic Nikon Z5 comparable.",
    },
    {
      caseId: "CAMERA-BODY-LENS-MANUAL-01",
      taxonomyClass: "body_only",
      decision: "manual_review",
      pid: "399955865",
      title: findSample(samples, "399955865", "소니 A7M3 풀프레임 카메라 풀박스 가격인하"),
      dangerousPatterns: ["바디"],
      comparableKeyRule: "full-box wording is packaging state; do not infer lens exclusion or lens inclusion",
      reason: "The title has camera/full-box language without explicit body-only or lens identity, so package_config remains blocked.",
    },
    {
      caseId: "CAMERA-BODY-LENS-MANUAL-02",
      taxonomyClass: "body_plus_kit_lens",
      decision: "manual_review",
      pid: "357513813",
      title: findSample(samples, "357513813", "캐논 미러리스 eos  R 10바디+18-45렌즈+ 256+64메모리"),
      dangerousPatterns: ["카메라 + 렌즈", "바디"],
      comparableKeyRule: "conflicting title/detail claims require manual review before assigning body-plus-kit",
      reason: "The row says body plus lens in the title but also describes body-only sale in text, so automation should pause.",
    },
    {
      caseId: "CAMERA-BODY-LENS-MANUAL-03",
      taxonomyClass: "fixed_lens_compact",
      decision: "manual_review",
      pid: "354540949",
      title: findSample(samples, "354540949", "캐논 파워샷 V10 본체 + 케이스 + BR-E1"),
      dangerousPatterns: ["바디"],
      comparableKeyRule: "fixed-lens compact keys are separate from interchangeable body/lens package keys",
      reason: "PowerShot V10 is fixed-lens compact-style evidence with accessory extras; keep it out of interchangeable kit comparison.",
    },
    {
      caseId: "CAMERA-BODY-LENS-HOLD-01",
      taxonomyClass: "lens_only",
      decision: "hold",
      pid: "402644064",
      title: findSample(samples, "402644064", "삼성 NX 20-50 줌렌즈"),
      dangerousPatterns: ["렌즈만", "부품용"],
      comparableKeyRule: "lens-only rows need separate lens category policy and must not enter camera body comparable keys",
      reason: "The listing is a lens resale row with malfunction/repair context in the description.",
    },
    {
      caseId: "CAMERA-BODY-LENS-HOLD-02",
      taxonomyClass: "accessory_parts_damaged_buying",
      decision: "hold",
      pid: "337786308",
      title: findSample(samples, "337786308", "마이크로포써드용 바디캡 + 렌즈 뒷캡"),
      dangerousPatterns: ["바디", "렌즈만", "부품용"],
      comparableKeyRule: "cap/accessory rows are hard exclusion material",
      reason: "Body cap and rear lens cap language can falsely trigger body/lens tokens but is accessory-only.",
    },
    {
      caseId: "CAMERA-BODY-LENS-HOLD-03",
      taxonomyClass: "accessory_parts_damaged_buying",
      decision: "hold",
      pid: "281480782",
      title: findSample(samples, "281480782", "캐논 MOS M200 바디 구매하고싶습니다 업자x"),
      dangerousPatterns: ["바디", "부품용"],
      comparableKeyRule: "buying/매입 intent never becomes a comparable sale key",
      reason: "Buying intent must remain hard hold even when the body model token looks specific.",
    },
  ] satisfies FixtureRow[]).map((row) => ({
    ...row,
    dangerousPatterns: [...new Set([...row.dangerousPatterns, ...patternHits(row.title)])],
  }));

  const taxonomy = [
    {
      class: "body_only",
      candidateShape: "camera body/base unit only",
      requiredSignals: ["body-only/body/main-unit token or explicit no-lens context", "stable body model key"],
      mustNotMergeWith: ["body_plus_kit_lens", "body_plus_multi_lens_kit", "lens_only", "fixed_lens_compact"],
      status: "split_architecture_ready_reference_only",
    },
    {
      class: "body_plus_kit_lens",
      candidateShape: "body plus one kit/bundle lens",
      requiredSignals: ["body model key", "single lens identity such as 16-50, 18-45, 18-55, or bundle-lens token"],
      mustNotMergeWith: ["body_only", "body_plus_multi_lens_kit", "fixed_lens_compact"],
      status: "split_architecture_ready_reference_only",
    },
    {
      class: "body_plus_multi_lens_kit",
      candidateShape: "body plus two or more named lenses",
      requiredSignals: ["body model key", "lens count or multiple lens identities"],
      mustNotMergeWith: ["body_only", "body_plus_kit_lens"],
      status: "manual_package_key_required",
    },
    {
      class: "lens_only",
      candidateShape: "interchangeable lens resale without camera body",
      requiredSignals: ["lens-only/lens model/focal-length token", "no body sale signal"],
      mustNotMergeWith: ["camera body comparable keys"],
      status: "hold_until_separate_lens_policy",
    },
    {
      class: "fixed_lens_compact",
      candidateShape: "compact/digital camera with non-interchangeable lens",
      requiredSignals: ["fixed-lens model family such as PowerShot, G7X, X100, Cyber-shot, EX2F"],
      mustNotMergeWith: ["interchangeable body/lens kit keys"],
      status: "manual_fixed_lens_taxonomy_required",
    },
    {
      class: "accessory_parts_damaged_buying",
      candidateShape: "case/cap/grip/battery/parts/damaged/buying row",
      requiredSignals: ["accessory, damaged, parts, or buyer-intent token"],
      mustNotMergeWith: ["all camera comparable sale keys"],
      status: "hard_hold_or_exclusion",
    },
  ];

  const dangerousTitlePatterns = [
    {
      pattern: "카메라 + 렌즈",
      risk: "Can mean a true kit, an aftermarket lens package, or a body sale with accessory wording.",
      handling: "Require explicit body model plus lens identity; otherwise manual review.",
    },
    {
      pattern: "번들렌즈",
      risk: "Usually package evidence, but not enough to merge with body-only or multi-lens kits.",
      handling: "Treat as kit-lens reference only and preserve lens axis in the comparable key.",
    },
    {
      pattern: "바디",
      risk: "May be true body-only, body plus lens, body cap, or damaged body.",
      handling: "Use only with body model plus no lens sale signal; cap/damaged/buying overrides to hold.",
    },
    {
      pattern: "렌즈만",
      risk: "Lens-only resale can sit inside camera category and distort body price distributions.",
      handling: "Hold under camera body prep; route to future lens-only policy.",
    },
    {
      pattern: "부품용",
      risk: "Parts/damaged context can coexist with exact body/lens tokens.",
      handling: "Hard hold regardless of model specificity.",
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
    category: "camera_discovered",
    assignedPrefix: "camera-body-lens",
    scope: "Camera body/lens/package split architecture implementation prep only",
    nonScope: [
      "runtime parser edits",
      "camera catalog or candidate-pool wiring",
      "public promotion",
      "Supabase/cron/lifecycle changes",
      "treating body and lens package as one comparable without explicit package key",
    ],
    sourceReportsRead: [
      "reports/camera-body-lens-package-fixture-packet-latest.json",
      "reports/camera-package-split-prep-latest.json",
      "reports/camera-no-mutation-runtime-dry-run-latest.json",
      "reports/camera-artifact-consistency-audit-latest.json",
      "category-intelligence/camera_discovered/normalized_samples.json",
    ],
    sourceStatus: {
      priorFixturePacketReportOnly: fixturePacket.reportOnly === true,
      splitPrepReportOnly: splitPrep.reportOnly === true,
      dryRunConclusion: dryRun.conclusion ?? null,
      artifactAuditConclusion: audit.conclusion ?? null,
    },
    metrics: {
      taxonomyClasses: taxonomy.length,
      fixtureRows: fixtureRows.length,
      positiveFixtureReferenceOnlyRows: fixtureRows.filter((row) => row.decision === "positive_fixture_reference_only").length,
      manualReviewRows: fixtureRows.filter((row) => row.decision === "manual_review").length,
      holdRows: fixtureRows.filter((row) => row.decision === "hold").length,
      runtimeApprovedRows: 0,
      candidatePositiveOnlyRows: 0,
      publicPromotionRows: 0,
      productionDbMutationRows: 0,
      priorDryRunRows: dryRun.metrics?.rows ?? 0,
      priorDryRunFailedRows: dryRun.metrics?.failedRows ?? 0,
      priorArtifactAuditFailures: audit.metrics?.failures ?? 0,
    },
    taxonomy,
    fixtureRows,
    dangerousTitlePatterns,
    fixtureDecisionCounts: countBy(fixtureRows.map((row) => row.decision)),
    taxonomyFixtureCounts: countBy(fixtureRows.map((row) => row.taxonomyClass)),
    ownerDecisionsBlocked: [
      "Approve whether body-only can become a future narrow positive class only when lens identity is absent or explicitly excluded.",
      "Approve package-key schema for one kit lens versus multi-lens packages before any comparable price grouping.",
      "Decide whether fixed-lens compact cameras are a separate camera subcategory or held until their own model taxonomy exists.",
      "Decide whether lens-only resale is a separate category lane or hard-excluded from camera_discovered runtime work.",
    ],
    deferredImplementationNotes: [
      "Future runtime parser, if approved by the main agent, should emit package_axis separately from condition/accessory axes.",
      "Accessory extras such as battery, SD card, case, grip, strap, and box should not prove lens-kit identity.",
      "Buying, damaged, parts, cap, and accessory-only overrides should run before body/lens package recovery.",
      "Full-box is a condition/package-completeness signal, not a lens inclusion signal.",
    ],
    conclusion: "camera_body_lens_split_runtime_prep_completed_report_only_no_runtime_approval",
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "camera-body-lens-split-runtime-prep-latest.json");
  const mdPath = path.join(reportsDir, "camera-body-lens-split-runtime-prep-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const taxonomyTable = [
    "| class | candidate shape | required signals | must not merge with | status |",
    "| --- | --- | --- | --- | --- |",
    ...taxonomy.map(
      (row) =>
        `| ${row.class} | ${mdEscape(row.candidateShape)} | ${mdEscape(row.requiredSignals.join("; "))} | ${mdEscape(row.mustNotMergeWith.join(", "))} | ${row.status} |`,
    ),
  ].join("\n");

  const fixtureTable = [
    "| case_id | decision | taxonomy | pid | dangerous patterns | comparable key rule | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...fixtureRows.map(
      (row) =>
        `| ${row.caseId} | ${row.decision} | ${row.taxonomyClass} | ${row.pid} | ${mdEscape(row.dangerousPatterns.join(", "))} | ${mdEscape(row.comparableKeyRule)} | ${mdEscape(row.title)} |`,
    ),
  ].join("\n");

  const patternTable = [
    "| pattern | risk | handling |",
    "| --- | --- | --- |",
    ...dangerousTitlePatterns.map((row) => `| ${row.pattern} | ${mdEscape(row.risk)} | ${mdEscape(row.handling)} |`),
  ].join("\n");

  const md = [
    "# Camera Body/Lens Split Runtime Prep",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: camera_discovered",
    "- assignedPrefix: camera-body-lens",
    "- reportOnly: true",
    "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "- conclusion: camera_body_lens_split_runtime_prep_completed_report_only_no_runtime_approval",
    "",
    "## Scope",
    "",
    "Implementation-prep only. This packet defines body/lens/package split architecture and fixture expectations; it does not approve runtime parser behavior, catalog wiring, candidate-pool wiring, public promotion, or production DB mutation.",
    "",
    "## Source Status",
    "",
    `- priorFixturePacketReportOnly: ${report.sourceStatus.priorFixturePacketReportOnly}`,
    `- splitPrepReportOnly: ${report.sourceStatus.splitPrepReportOnly}`,
    `- dryRunConclusion: ${report.sourceStatus.dryRunConclusion}`,
    `- artifactAuditConclusion: ${report.sourceStatus.artifactAuditConclusion}`,
    "",
    "## Metrics",
    "",
    `- taxonomyClasses: ${report.metrics.taxonomyClasses}`,
    `- fixtureRows: ${report.metrics.fixtureRows}`,
    `- positiveFixtureReferenceOnlyRows: ${report.metrics.positiveFixtureReferenceOnlyRows}`,
    `- manualReviewRows: ${report.metrics.manualReviewRows}`,
    `- holdRows: ${report.metrics.holdRows}`,
    `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
    `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
    `- priorDryRunRows/priorDryRunFailedRows: ${report.metrics.priorDryRunRows}/${report.metrics.priorDryRunFailedRows}`,
    `- priorArtifactAuditFailures: ${report.metrics.priorArtifactAuditFailures}`,
    "",
    "## Split Taxonomy",
    "",
    taxonomyTable,
    "",
    "## Fixture Table",
    "",
    fixtureTable,
    "",
    "## Dangerous Korean Title Patterns",
    "",
    patternTable,
    "",
    "## Owner Decisions Blocked",
    "",
    ...report.ownerDecisionsBlocked.map((line) => `- ${line}`),
    "",
    "## Deferred Implementation Notes",
    "",
    ...report.deferredImplementationNotes.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.nonScope.map((line) => `- ${line}`),
    "",
  ].join("\n");

  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.conclusion,
        fixtureRows: report.metrics.fixtureRows,
        runtimeApprovedRows: report.metrics.runtimeApprovedRows,
        candidatePositiveOnlyRows: report.metrics.candidatePositiveOnlyRows,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
