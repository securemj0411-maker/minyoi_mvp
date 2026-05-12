import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
  condition?: string;
  salesCount?: number;
  reviewCount?: number;
  url?: string;
};

type SourceReport = {
  metrics?: Record<string, unknown>;
  currentMetrics?: Record<string, unknown>;
};

type Decision = "positive_contract_candidate" | "manual_owner_decision" | "hold_negative_fixture";

type Seed = {
  caseId: string;
  pid: string;
  decision: Decision;
  bucket: string;
  cpuIdentity: string | null;
  gpuIdentity: string | null;
  evidenceRule: string;
  reason: string;
  sourcePath?: string;
};

type Fixture = Seed & {
  title: string;
  price: number | null;
  condition: string | null;
  salesCount: number | null;
  reviewCount: number | null;
  url: string | null;
  evidenceSnippet: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
};

type AuditRow = {
  pid: string;
  title: string;
  cpuTitleToken: string | null;
  gpuTitleToken: string | null;
  classification: "strict_positive" | "manual_or_negative";
  reason: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const samplesPath = path.join(appDir, "category-intelligence", "desktop_pc_discovered", "normalized_samples.json");

const sourceReportsRead = [
  "reports/desktop-private-used-runtime-impact-review-2026-05-12.md",
  "reports/desktop-private-used-cpu-gpu-contract-latest.md",
  "reports/desktop-private-used-cpu-gpu-contract-latest.json",
  "reports/desktop-cpu-gpu-normalization-prep-latest.md",
  "reports/desktop-cpu-gpu-normalization-prep-latest.json",
  "reports/desktop-shop-template-split-latest.md",
  "reports/desktop-shop-template-split-latest.json",
  "reports/category-orchestration-status-latest.md",
  "category-intelligence/desktop_pc_discovered/normalized_samples.json",
  "reports/desktop-exclusion-readiness-latest.json",
  "reports/desktop-cpu-gpu-implementation-prep-latest.json",
];

const positiveSeeds: Seed[] = [
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-POS-01",
    pid: "407330838",
    decision: "positive_contract_candidate",
    bucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "ryzen-5-7500f",
    gpuIdentity: "rtx-5060",
    evidenceRule: "title_visible_cpu_title_rtx_private_duration",
    reason: "Title has CPU and RTX GPU; description has 8-month use and personal sale reason; no shop/configurable signal in reviewed text.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-POS-02",
    pid: "403834426",
    decision: "positive_contract_candidate",
    bucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "core-i5-14400f",
    gpuIdentity: "rtx-4060",
    evidenceRule: "title_visible_cpu_title_rtx_private_use_duration",
    reason: "Title has CPU and RTX GPU; description states purchase timing, 3-4 months of real use, direct deal, and one fixed spec.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-POS-03",
    pid: "407321515",
    decision: "positive_contract_candidate",
    bucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "ryzen-7-9800x3d",
    gpuIdentity: "rtx-5070",
    evidenceRule: "title_visible_cpu_title_rtx_private_upgrade_reason",
    reason: "Title has CPU and RTX GPU; description says it was built in early May and is sold for a higher-spec move; fixed full-unit spec.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-POS-04",
    pid: "388185776",
    decision: "positive_contract_candidate",
    bucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "ryzen-7-9800x3d",
    gpuIdentity: "rtx-5070",
    evidenceRule: "title_visible_cpu_title_rtx_private_low_use",
    reason: "Title has CPU and RTX GPU; description says it was bought late last year, barely used, and is Busan direct-deal only.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-POS-05",
    pid: "392520754",
    decision: "positive_contract_candidate",
    bucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "ryzen-9-9950x3d",
    gpuIdentity: "rtx-4070",
    evidenceRule: "title_visible_cpu_title_rtx_fixed_direct_deal",
    reason: "Title has CPU and RTX GPU; description is one fixed full-unit spec with direct-deal wording and no option menu in the reviewed text.",
  },
];

const manualSeeds: Seed[] = [
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-01",
    pid: "407283659",
    decision: "manual_owner_decision",
    bucket: "description_backed_cpu_hold",
    cpuIdentity: "ryzen-7-9700x",
    gpuIdentity: "rtx-5080",
    evidenceRule: "gpu_title_cpu_description_only",
    reason: "Private-used context exists, but CPU appears only in description; stays owner decision/manual instead of positive.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-02",
    pid: "407326368",
    decision: "manual_owner_decision",
    bucket: "bare_5080_missing_title_cpu_hold",
    cpuIdentity: null,
    gpuIdentity: "manual-bare-5080",
    evidenceRule: "bare_gpu_token_no_rtx_prefix",
    reason: "Private-used context exists, but title has bare 5080 and no title CPU; do not promote bare 5080 to positive.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-03",
    pid: "407063663",
    decision: "manual_owner_decision",
    bucket: "bare_9070xt_shop_configurable_hold",
    cpuIdentity: "ryzen-7-7800x3d",
    gpuIdentity: "manual-bare-9070xt",
    evidenceRule: "bare_gpu_token_and_option_pricing",
    reason: "Title has bare 9070xt without RX prefix and description has cooler/SSD option pricing; owner decision/manual.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-04",
    pid: "330388864",
    decision: "manual_owner_decision",
    bucket: "bare_5080_shop_service_hold",
    cpuIdentity: "ryzen-7-9800x3d",
    gpuIdentity: "manual-bare-5080",
    evidenceRule: "bare_gpu_token_and_shop_service",
    reason: "Title has CPU plus bare 5080, but store/service and add-on pricing keep it out of private-used positives.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-05",
    pid: "405428599",
    decision: "manual_owner_decision",
    bucket: "ambiguous_270k_bare_5080_configurable_hold",
    cpuIdentity: "manual-core-ultra-7-270k-plus",
    gpuIdentity: "manual-bare-5080",
    evidenceRule: "ambiguous_cpu_bare_gpu_custom_build",
    reason: "Title CPU is naked 270K and GPU is bare 5080; description invites similar custom-build requests.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-06",
    pid: "382788230",
    decision: "manual_owner_decision",
    bucket: "new_parts_gpu_optional_hold",
    cpuIdentity: "ryzen-7-9800x3d",
    gpuIdentity: "rtx-5070ti",
    evidenceRule: "title_cpu_rtx_but_gpu_without_purchase_option",
    reason: "Title has CPU and RTX GPU, but description is new-parts build and allows buying without GPU; not a private-used full-unit positive.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-07",
    pid: "393636906",
    decision: "manual_owner_decision",
    bucket: "new_parts_upgrade_option_hold",
    cpuIdentity: "ryzen-7-5700x",
    gpuIdentity: "rtx-5060",
    evidenceRule: "title_cpu_rtx_but_new_parts_and_ram_option",
    reason: "Title has CPU and RTX GPU, but description marks parts as new and includes RAM upgrade pricing; keep manual.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-08",
    pid: "401614618",
    decision: "manual_owner_decision",
    bucket: "title_cpu_rx_missing_private_used_language",
    cpuIdentity: "core-ultra-5-225f",
    gpuIdentity: "rx-5700",
    evidenceRule: "title_cpu_rx_but_no_private_used_context",
    reason: "Title has CPU and RX GPU, but reviewed evidence lacks private-used seller wording; not positive.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-09",
    pid: "407003941",
    decision: "manual_owner_decision",
    bucket: "assembled_new_used_parts_no_personal_use",
    cpuIdentity: "ryzen-7-5700x",
    gpuIdentity: "rtx-2080ti",
    evidenceRule: "title_cpu_rtx_but_assembled_for_sale",
    reason: "Title has CPU and RTX GPU, but description says new plus used parts were assembled and not used; not private-used positive.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-10",
    pid: "407003698",
    decision: "manual_owner_decision",
    bucket: "assembled_new_used_parts_no_personal_use",
    cpuIdentity: "ryzen-7-5700x",
    gpuIdentity: "rtx-3080",
    evidenceRule: "title_cpu_rtx_but_assembled_for_sale",
    reason: "Title has CPU and RTX GPU, but description says new plus used parts were assembled and not used; not private-used positive.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-MANUAL-11",
    pid: "395764441",
    decision: "manual_owner_decision",
    bucket: "title_cpu_rtx_missing_private_used_language",
    cpuIdentity: "core-i5-12400f",
    gpuIdentity: "rtx-4060",
    evidenceRule: "title_cpu_rtx_but_only_formatting_context",
    reason: "Title has CPU and RTX GPU, but reviewed evidence only states format/reinstall and game usability; private-used proof is insufficient.",
  },
];

const holdSeeds: Seed[] = [
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-01",
    pid: "52257536",
    decision: "hold_negative_fixture",
    bucket: "shop_multi_configuration_template",
    cpuIdentity: null,
    gpuIdentity: null,
    evidenceRule: "shop_template_options_receipts_full_set",
    reason: "Store/service language, multiple PC menus, upgrade pricing, tax/card receipt wording, and full-set/peripheral offers.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-02",
    pid: "395278830",
    decision: "hold_negative_fixture",
    bucket: "shop_full_set_template",
    cpuIdentity: null,
    gpuIdentity: null,
    evidenceRule: "shop_template_full_set",
    reason: "Commercial full-set/event template with configurable body, monitor/peripheral bundle, receipt, delivery, and A/S language.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-03",
    pid: "407329585",
    decision: "hold_negative_fixture",
    bucket: "shop_upgrade_option_template",
    cpuIdentity: null,
    gpuIdentity: "rtx-3060ti",
    evidenceRule: "shop_template_gpu_family_menu",
    reason: "RTX 3060 Ti body collection/template with monitor and case add-ons; not one fixed private-used unit.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-04",
    pid: "406930303",
    decision: "hold_negative_fixture",
    bucket: "shop_custom_quote_template",
    cpuIdentity: null,
    gpuIdentity: "rtx-5060",
    evidenceRule: "shop_custom_quote",
    reason: "Store-backed listing with custom quote, receipt, A/S, SSD change, and consultation language.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-05",
    pid: "261143845",
    decision: "hold_negative_fixture",
    bucket: "shop_configurable_template",
    cpuIdentity: "core-i5-10400f",
    gpuIdentity: "rtx-3060",
    evidenceRule: "shop_template_event_options",
    reason: "Title has CPU/RTX tokens but description is a commercial special-discount template with shipping, receipts, and option changes.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-06",
    pid: "176853126",
    decision: "hold_negative_fixture",
    bucket: "gpu_only_missing_cpu",
    cpuIdentity: null,
    gpuIdentity: "rtx-3080ti",
    evidenceRule: "gpu_title_without_cpu",
    reason: "Private-used full-unit context exists, but title lacks CPU identity; hold from comparable positives.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-07",
    pid: "406336665",
    decision: "hold_negative_fixture",
    bucket: "software_key_accessory",
    cpuIdentity: null,
    gpuIdentity: null,
    evidenceRule: "windows_office_key",
    reason: "Windows/Office license key listing; hard accessory/software exclusion.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-08",
    pid: "407251294",
    decision: "hold_negative_fixture",
    bucket: "shop_cpu_gpu_template",
    cpuIdentity: "core-i5-9400f",
    gpuIdentity: "rtx-2060",
    evidenceRule: "shop_template_orderable_options",
    reason: "Title has CPU/RTX tokens, but description is a shop template with order options, A/S, monitor/peripheral add-ons, and receipts.",
  },
];

const reportOnlyBooleans = {
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
};

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

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function titleFor(sample: Sample): string {
  return sample.title ?? sample.name ?? "";
}

function byPid(samples: Sample[], pid: string): Sample | null {
  return samples.find((sample) => String(sample.pid) === pid) ?? null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function snippet(sample: Sample | null, fallback: string): string {
  const description = sample?.description ?? "";
  const needles = [
    "8개월정도 사용",
    "실사용은 3~4개월",
    "좀더 고사양으로 넘어가기",
    "실사용이 거의 없어서",
    "부산 직거래용",
    "구매 후 거의 사용 안",
    "2월19일쯤 컴퓨존",
    "수냉쿨러로 변경",
    "램방열판 2개 추가시",
    "조립의뢰도 가능합니다",
    "실사용 몇번 안해서",
    "RAM : 16 G",
    "바로 사용 가능한 상태",
    "새제품+중고 조립 후 사용x",
    "포멧 후 윈도우10",
    "업글추천",
    "단품시 신품 LED",
    "신품 모니터 추가 가능",
    "모든 용도 맞춤 견적",
    "특별할인 이벤트",
    "다운그레이드 예정",
    "정품키",
    "원하는 사양 번개톡 오더 가능",
  ];
  const needle = needles.find((candidate) => description.includes(candidate));
  if (!description) {
    return fallback;
  }
  if (!needle) {
    return normalizeWhitespace(description).slice(0, 220);
  }
  const index = description.indexOf(needle);
  return normalizeWhitespace(description.slice(Math.max(0, index - 60), Math.min(description.length, index + needle.length + 160)));
}

function fallbackSample(seed: Seed): Sample {
  if (seed.pid === "382714578") {
    return {
      pid: "382714578",
      title: "파이 노드 컴퓨터 위탁 월 4만원  최저가",
      price: 50000,
      description: "Commercial/mining/node consignment fixture from desktop-exclusion-readiness-latest.json.",
    };
  }
  return {
    pid: seed.pid,
    title: `missing sample ${seed.pid}`,
    description: "Missing from current normalized_samples.json; retained only if sourced from a referenced report.",
  };
}

function buildFixture(seed: Seed, samples: Sample[]): Fixture {
  const sample = byPid(samples, seed.pid) ?? fallbackSample(seed);
  return {
    ...seed,
    title: titleFor(sample),
    price: sample.price ?? null,
    condition: sample.condition ?? null,
    salesCount: sample.salesCount ?? null,
    reviewCount: sample.reviewCount ?? null,
    url: sample.url ?? null,
    evidenceSnippet: snippet(sample, seed.reason),
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
  };
}

function cpuTitleToken(title: string): string | null {
  return (
    title.match(
      /(라이젠\s*\d\s*\d{4}\s*x?3?d?|ryzen\s*\d\s*\d{4}\s*x?3?d?|\b\d{4}x3d\b|\bi[3579][ -]?\d{4,5}[a-z]{0,2}\b|울트라\s*\d\s*\d{3}f|\b7500f\b|\b14400f\b|\b9800x3d\b|\b7800x3d\b|\b5700x\b|\b12400f\b|\b10400f\b|\b9400f\b)/i,
    )?.[0] ?? null
  );
}

function gpuTitleToken(title: string): string | null {
  return title.match(/(rtx\s*\d{4}\s*(?:ti|super)?|rx\s*\d{4}\s*xt?)/i)?.[0] ?? null;
}

function buildAudit(samples: Sample[], fixtures: Fixture[]): AuditRow[] {
  const positivePids = new Set(fixtures.filter((fixture) => fixture.decision === "positive_contract_candidate").map((fixture) => fixture.pid));
  const manualOrHoldPids = new Set(fixtures.filter((fixture) => fixture.decision !== "positive_contract_candidate").map((fixture) => fixture.pid));

  return samples
    .map((sample) => {
      const title = titleFor(sample);
      return {
        pid: String(sample.pid),
        title,
        cpuTitleToken: cpuTitleToken(title),
        gpuTitleToken: gpuTitleToken(title),
      };
    })
    .filter((row) => row.cpuTitleToken && row.gpuTitleToken)
    .map((row) => ({
      ...row,
      classification: positivePids.has(row.pid) ? "strict_positive" : "manual_or_negative",
      reason: positivePids.has(row.pid)
        ? "Included as strict positive in backfill."
        : manualOrHoldPids.has(row.pid)
          ? "Included in manual/hold fixtures because private-used, bare-token, or shop/configurable proof is unresolved."
          : "Not included as positive: title token row lacks strict private-used fixed one-off confidence or is a duplicate/shop-like sample.",
    }));
}

function renderReport(report: {
  generatedAt: string;
  metrics: Record<string, unknown>;
  fixtures: Fixture[];
  sourceReportsRead: string[];
  ownerDecisionPoints: string[];
  targetStatus: string;
}): string {
  const positives = report.fixtures.filter((fixture) => fixture.decision === "positive_contract_candidate");
  const manuals = report.fixtures.filter((fixture) => fixture.decision === "manual_owner_decision");
  const holds = report.fixtures.filter((fixture) => fixture.decision === "hold_negative_fixture");

  return `# Desktop Private-Used Positive Backfill

- generatedAt: ${report.generatedAt}
- lane: desktop_private_used_cpu_gpu
- conclusion: ${report.targetStatus}
- reportOnly: true
- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false
- runtimeApproved/public/candidatePool rows: 0/0/0

## Scope

Report-only sample backfill for private-used desktop full-unit CPU/GPU evidence. This file does not edit runtime, catalog, candidate pool, public promotion, Supabase, cron, lifecycle, pack UI, tests, src/lib, or the 30-day plan.

## Metrics

${table(
  ["metric", "value"],
  [
    ["sourceSamples", report.metrics.sourceSamples],
    ["titleCpuAndRtxRxGpuRows", report.metrics.titleCpuAndRtxRxGpuRows],
    ["positiveRows", report.metrics.positiveRows],
    ["manualRows", report.metrics.manualRows],
    ["holdRows", report.metrics.holdRows],
    ["runtimeApprovedRows", report.metrics.runtimeApprovedRows],
    ["publicPromotionRows", report.metrics.publicPromotionRows],
    ["candidatePoolRows", report.metrics.candidatePoolRows],
    ["strictPositiveTarget", report.metrics.strictPositiveTarget],
    ["strictPositiveTargetMet", report.metrics.strictPositiveTargetMet],
  ],
)}

## Strict Positive Backfill

${table(
  ["caseId", "pid", "cpu", "gpu", "rule", "title", "evidence"],
  positives.map((fixture) => [
    fixture.caseId,
    fixture.pid,
    fixture.cpuIdentity,
    fixture.gpuIdentity,
    fixture.evidenceRule,
    fixture.title,
    fixture.evidenceSnippet,
  ]),
)}

## Manual Owner Decision Rows

${table(
  ["caseId", "pid", "bucket", "cpu", "gpu", "reason", "title"],
  manuals.map((fixture) => [
    fixture.caseId,
    fixture.pid,
    fixture.bucket,
    fixture.cpuIdentity,
    fixture.gpuIdentity,
    fixture.reason,
    fixture.title,
  ]),
)}

## Negative / Hold Fixtures

${table(
  ["caseId", "pid", "bucket", "reason", "title"],
  holds.map((fixture) => [fixture.caseId, fixture.pid, fixture.bucket, fixture.reason, fixture.title]),
)}

## Runtime Gating Result

No rows are runtime-approved, public-promotion-ready, or candidate-pool-ready. The strict positive count increased from 3 to 5, but the 10-15 row minimum is not met from the reviewed source set, so desktop runtime remains blocked.

## Owner / Main-Agent Decision Points

${report.ownerDecisionPoints.map((point) => `- ${point}`).join("\n")}

## Source Reports Read

${report.sourceReportsRead.map((source) => `- ${source}`).join("\n")}
`;
}

function renderAudit(report: { generatedAt: string; auditRows: AuditRow[]; metrics: Record<string, unknown> }): string {
  return `# Desktop Private-Used Positive Backfill Audit

- generatedAt: ${report.generatedAt}
- lane: desktop_private_used_cpu_gpu
- reportOnly: true
- runtimeApproved/public/candidatePool rows: 0/0/0

## Audit Metrics

${table(
  ["metric", "value"],
  [
    ["titleCpuAndRtxRxGpuRows", report.metrics.titleCpuAndRtxRxGpuRows],
    ["strictPositiveRows", report.metrics.positiveRows],
    ["manualOrNegativeTitleRows", report.metrics.manualOrNegativeTitleRows],
  ],
)}

## Title CPU + RTX/RX GPU Audit Rows

${table(
  ["pid", "cpu title token", "gpu title token", "classification", "reason", "title"],
  report.auditRows.map((row) => [row.pid, row.cpuTitleToken, row.gpuTitleToken, row.classification, row.reason, row.title]),
)}
`;
}

async function main(): Promise<void> {
  const [samples, contract, normalizationPrep, shopSplit] = await Promise.all([
    readJson<Sample[]>(samplesPath),
    readJson<SourceReport>(path.join(reportsDir, "desktop-private-used-cpu-gpu-contract-latest.json")),
    readJson<SourceReport>(path.join(reportsDir, "desktop-cpu-gpu-normalization-prep-latest.json")),
    readJson<SourceReport>(path.join(reportsDir, "desktop-shop-template-split-latest.json")),
  ]);

  const miningSeed: Seed = {
    caseId: "DESKTOP-PRIVATE-USED-BACKFILL-HOLD-09",
    pid: "382714578",
    decision: "hold_negative_fixture",
    bucket: "commercial_or_mining_node_consignment",
    cpuIdentity: null,
    gpuIdentity: null,
    evidenceRule: "mining_node_consignment_report_fixture",
    reason: "Referenced desktop exclusion fixture for node/mining-like consignment; hard hold from private-used full-unit comparables.",
    sourcePath: "reports/desktop-exclusion-readiness-latest.json",
  };

  const fixtures = [...positiveSeeds, ...manualSeeds, ...holdSeeds, miningSeed].map((seed) => buildFixture(seed, samples));
  const auditRows = buildAudit(samples, fixtures);
  const generatedAt = new Date().toISOString();

  const metrics = {
    sourceSamples: samples.length,
    titleCpuAndRtxRxGpuRows: auditRows.length,
    positiveRows: fixtures.filter((fixture) => fixture.decision === "positive_contract_candidate").length,
    manualRows: fixtures.filter((fixture) => fixture.decision === "manual_owner_decision").length,
    holdRows: fixtures.filter((fixture) => fixture.decision === "hold_negative_fixture").length,
    strictPositiveTarget: "10-15",
    strictPositiveTargetMet: false,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    inheritedContractPositiveRows: contract.metrics?.positiveCandidateRows ?? null,
    inheritedContractHoldRows: contract.metrics?.holdRows ?? null,
    inheritedNormalizationTitleRows: normalizationPrep.currentMetrics?.rowsWithBothTitleTokens ?? null,
    inheritedShopTemplateRows: shopSplit.metrics?.shopTemplateFixtureRows ?? null,
  };

  const report = {
    generatedAt,
    lane: "desktop_private_used_cpu_gpu",
    conclusion: "desktop_private_used_positive_backfill_report_only_target_not_met",
    targetStatus: "strict_positive_backfill_found_5_of_10_15_target_runtime_still_blocked",
    ...reportOnlyBooleans,
    metrics,
    fixtures,
    ownerDecisionPoints: [
      "Decide whether the 5 strict positives are enough for a no-mutation executor preflight, or require additional external sample mining to reach 10-15.",
      "Keep description-backed CPU rows out of positives until owner approves CPU identity from description for GPU-led titles.",
      "Keep bare 5080 and bare 9070xt rows manual until owner decides whether RTX/RX prefix is mandatory at title level.",
      "Keep shop/configurable rows in a separate negative fixture lane unless owner approves a distinct shop-template comparable lane.",
      "If runtime work resumes, start with an internal-only no-mutation executor and keep public promotion/candidate-pool rows at zero.",
    ],
    sourceReportsRead,
  };

  const auditMetrics = {
    titleCpuAndRtxRxGpuRows: auditRows.length,
    positiveRows: metrics.positiveRows,
    manualOrNegativeTitleRows: auditRows.filter((row) => row.classification === "manual_or_negative").length,
  };
  const auditReport = {
    generatedAt,
    lane: "desktop_private_used_cpu_gpu",
    ...reportOnlyBooleans,
    metrics: auditMetrics,
    auditRows,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-private-used-positive-backfill-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "desktop-private-used-positive-backfill-latest.md"), renderReport(report));
  await writeFile(
    path.join(reportsDir, "desktop-private-used-positive-backfill-audit-latest.json"),
    `${JSON.stringify(auditReport, null, 2)}\n`,
  );
  await writeFile(path.join(reportsDir, "desktop-private-used-positive-backfill-audit-latest.md"), renderAudit(auditReport));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
