import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");
const samplePath = path.join(
  process.cwd(),
  "category-intelligence",
  "desktop_pc_discovered",
  "normalized_samples.json",
);

const sourceReportsRead = [
  "reports/subagent-continuous-wave-3-work-orders-2026-05-12.md",
  "reports/desktop-shop-template-split-latest.md",
  "reports/desktop-shop-template-split-latest.json",
  "reports/desktop-cpu-gpu-normalization-prep-latest.md",
  "reports/desktop-cpu-gpu-normalization-prep-latest.json",
  "reports/desktop-cpu-gpu-title-token-boundary-evidence-latest.md",
  "reports/desktop-cpu-gpu-title-token-boundary-evidence-latest.json",
  "category-intelligence/desktop_pc_discovered/normalized_samples.json",
];

const fixtureSeeds = [
  {
    caseId: "DESKTOP-PRIVATE-USED-POS-01",
    pid: "407330838",
    expectedDecision: "positive_contract_candidate",
    expectedBucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "ryzen-5-7500f",
    gpuIdentity: "rtx-5060",
    gpuEvidenceRule: "title_rtx_prefix",
    inclusionReason:
      "Private-use duration and personal sale reason; single fixed listing; CPU/GPU both visible in title; no shop/configurable/full-set/accessory signal.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-POS-02",
    pid: "403834426",
    expectedDecision: "positive_contract_candidate",
    expectedBucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "core-i5-14400f",
    gpuIdentity: "rtx-4060",
    gpuEvidenceRule: "title_rtx_prefix",
    inclusionReason:
      "Recent personal purchase and 3-4 month use statement; single fixed spec; direct-deal wording; CPU/GPU both visible in title and spec block.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-POS-03",
    pid: "407321515",
    expectedDecision: "positive_contract_candidate",
    expectedBucket: "private_used_fixed_cpu_gpu",
    cpuIdentity: "ryzen-7-9800x3d",
    gpuIdentity: "rtx-5070",
    gpuEvidenceRule: "title_rtx_prefix",
    inclusionReason:
      "Personal upgrade reason and one fixed spec; CPU/GPU visible in title and description; warranty/newness stays deferred context.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-01",
    pid: "407283659",
    expectedDecision: "hold",
    expectedBucket: "gpu_led_cpu_description_only",
    holdReason:
      "Private-used wording exists, but title is GPU-led and CPU identity is description-only; hold until owner approves description-backed CPU keys.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-02",
    pid: "407326368",
    expectedDecision: "hold",
    expectedBucket: "bare_5080_missing_cpu",
    holdReason:
      "Bare 5080 title without RTX prefix and no visible CPU identity in available snippet; hold as missing CPU plus ambiguous GPU context.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-03",
    pid: "176853126",
    expectedDecision: "hold",
    expectedBucket: "gpu_only_missing_cpu",
    holdReason:
      "RTX3080Ti title has GPU identity, but no CPU identity; hold from full-unit comparable positives.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-04",
    pid: "406336665",
    expectedDecision: "hold",
    expectedBucket: "windows_key_accessory",
    holdReason:
      "Windows/Office key listing, not a desktop full unit; hard accessory hold.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-05",
    pid: "52257536",
    expectedDecision: "hold",
    expectedBucket: "shop_multi_configuration_template",
    holdReason:
      "Multiple PC configurations, upgrade pricing, tax/card receipt, store/service language, and peripheral bundle signals.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-06",
    pid: "395278830",
    expectedDecision: "hold",
    expectedBucket: "shop_full_set_template",
    holdReason:
      "Full-set/event template with configurable parts, receipt/delivery/A/S language, and high seller history.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-07",
    pid: "407063663",
    expectedDecision: "hold",
    expectedBucket: "new_custom_configurable_bare_9070xt",
    holdReason:
      "New/custom-build row with cooler/SSD option pricing; title has bare 9070xt without RX prefix, so it must not enter private-used positives.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-08",
    pid: "330388864",
    expectedDecision: "hold",
    expectedBucket: "shop_service_configurable_bare_5080",
    holdReason:
      "Store/service language and add-on pricing; title has bare 5080 without RTX prefix, so this is not comparable to private used rows.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-09",
    pid: "401614618",
    expectedDecision: "hold",
    expectedBucket: "missing_private_used_language",
    holdReason:
      "CPU/GPU tokens are visible, but the row lacks private-used/fixed one-off seller language in the reviewed evidence.",
  },
  {
    caseId: "DESKTOP-PRIVATE-USED-HOLD-10",
    pid: "405428599",
    expectedDecision: "hold",
    expectedBucket: "configurable_shop_and_ambiguous_270k",
    holdReason:
      "Description allows similar custom-build requests, uses mostly-new part language, and title CPU is ambiguous naked 270K.",
  },
];

const contractRules = [
  {
    id: "positive_private_used_language",
    decision: "require",
    rule: "Positive rows must include personal/private-used language such as use duration, personal upgrade/downshift reason, or direct personal sale wording.",
  },
  {
    id: "positive_fixed_one_off_listing",
    decision: "require",
    rule: "Positive rows must describe one fixed desktop full-unit spec and price, not a menu, quote, build request, selectable option, or configurable template.",
  },
  {
    id: "positive_cpu_identity",
    decision: "require",
    rule: "CPU identity is required before any private-used desktop comparable key. Current positive fixtures use title-visible CPU identity.",
  },
  {
    id: "positive_gpu_identity",
    decision: "require",
    rule: "GPU identity must include RTX/RX prefix in the title or have unambiguous GPU context approved for review; bare 5080 and bare 9070xt stay held for now.",
  },
  {
    id: "exclude_shop_configurable",
    decision: "hold",
    rule: "Hold rows with store/service, quote/consultation, tax/card receipt, A/S boilerplate, upgrade pricing, option-choice, or multiple configuration signals.",
  },
  {
    id: "exclude_full_set_accessory",
    decision: "hold",
    rule: "Hold full-set/peripheral rows, Windows or Office key rows, GPU-only rows, mining rigs, missing CPU rows, and accessory/part rows.",
  },
];

const ownerDecisions = [
  "Approve exact CPU normal forms for Ryzen 5 7500F, Core i5-14400F, Ryzen 7 9800X3D, Ryzen 7 7800X3D, Core Ultra 5 225F, and Core Ultra 7 270K Plus before parser implementation.",
  "Decide whether description-backed CPU identity can qualify when the title is GPU-led, as in RTX5080 full-unit rows.",
  "Decide whether bare 5080 and bare 9070xt can use description context, or must require title-level RTX/RX prefix.",
  "Decide whether shop/configurable desktop builds should get a separate comparable lane or remain excluded from private-used desktop comps.",
  "Decide when RAM, SSD, warranty/newness, and case/aesthetic fields become deferred price-adjustment fields after CPU/GPU/listing-type gates are stable.",
];

const nextReportOnlyActions = [
  "Backfill additional positive private-used fixtures with title-visible CPU plus title RTX/RX GPU prefix.",
  "Backfill negative fixtures for mining rigs and GPU-only part listings if those appear in the desktop sample set.",
  "After owner decisions, produce a no-mutation executor that evaluates this contract without runtime wiring or candidate-pool policy changes.",
];

function mdEscape(value) {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function byPid(samples, pid) {
  const row = samples.find((sample) => String(sample.pid) === pid);
  if (!row) {
    throw new Error(`Missing desktop sample pid=${pid}`);
  }
  return row;
}

function snippet(row, needleFallback) {
  const desc = row.description ?? "";
  const snippets = [
    "8개월정도 사용",
    "실사용은 3~4개월",
    "넘어가기 위해 판매",
    "거의 사용 안",
    "롤만 해서 과스펙",
    "다운그레이드 예정",
    "정품키",
    "업글추천",
    "신품 LED 케이스",
    "수냉쿨러로 변경",
    "램방열판 2개 추가시",
    "바로 사용 가능한 상태",
    "조립의뢰도 가능합니다",
  ];
  const needle = snippets.find((candidate) => desc.includes(candidate)) ?? needleFallback;
  if (!needle) {
    return desc.slice(0, 90);
  }
  const index = desc.indexOf(needle);
  if (index < 0) {
    return desc.slice(0, 90);
  }
  return desc.slice(Math.max(0, index - 30), Math.min(desc.length, index + needle.length + 80));
}

function buildFixture(seed, samples) {
  const row = byPid(samples, seed.pid);
  return {
    ...seed,
    title: row.title ?? row.name,
    price: row.price,
    condition: row.condition,
    salesCount: row.salesCount,
    reviewCount: row.reviewCount,
    url: row.url,
    evidenceSnippet: snippet(row, row.title ?? row.name),
  };
}

function renderMarkdown(report) {
  const positiveRows = report.fixtures.filter((row) => row.expectedDecision === "positive_contract_candidate");
  const holdRows = report.fixtures.filter((row) => row.expectedDecision === "hold");

  return `# Desktop Private-Used CPU/GPU Contract

- generatedAt: ${report.generatedAt}
- category: ${report.category}
- conclusion: ${report.conclusion}
- reportOnly: ${report.reportOnly}
- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: ${report.publicPromotion}/${report.runtimeCatalogApply}/${report.candidatePoolPolicyWiring}
- productionDbMutation/directThirtyDayPlanEdit: ${report.productionDbMutation}/${report.directThirtyDayPlanEdit}

## Scope

Agent P report-only implementation prep for private-used desktop full units. This contract does not runtime-wire desktop, approve CPU/GPU parser patches, compare shop-template rows, mutate production data, touch candidate pools, or edit the 30-day plan.

## Contract Metrics

${table(
  ["metric", "value"],
  [
    ["sourceSamples", report.metrics.sourceSamples],
    ["contractFixtureRows", report.metrics.contractFixtureRows],
    ["positiveCandidateRows", report.metrics.positiveCandidateRows],
    ["holdRows", report.metrics.holdRows],
    ["runtimeApprovedRows", report.metrics.runtimeApprovedRows],
    ["shopTemplateRowsTreatedComparable", report.metrics.shopTemplateRowsTreatedComparable],
  ],
)}

## Positive Contract Rules

${table(
  ["rule id", "decision", "rule"],
  report.contractRules.map((rule) => [rule.id, rule.decision, rule.rule]),
)}

## Positive Fixtures

${table(
  ["caseId", "pid", "cpu", "gpu", "gpu rule", "title", "evidence"],
  positiveRows.map((row) => [
    row.caseId,
    row.pid,
    row.cpuIdentity,
    row.gpuIdentity,
    row.gpuEvidenceRule,
    row.title,
    row.evidenceSnippet,
  ]),
)}

## Hold Fixtures

${table(
  ["caseId", "pid", "bucket", "hold reason", "title", "evidence"],
  holdRows.map((row) => [
    row.caseId,
    row.pid,
    row.expectedBucket,
    row.holdReason,
    row.title,
    row.evidenceSnippet,
  ]),
)}

## Runtime Prep Contract

| implementation-prep item | status |
| --- | --- |
| private-used desktop full unit lane | contract_candidate_only |
| shop/configurable template comparability | explicitly_excluded |
| CPU/GPU parser patch approval | blocked_on_owner_decisions |
| no-mutation executor | not_produced_this_pass |
| runtime/catalog/candidate-pool wiring | not_allowed |

## Blocked Owner Decisions

${report.ownerDecisions.map((decision) => `- ${decision}`).join("\n")}

## Source Reports Read

${report.sourceReportsRead.map((source) => `- ${source}`).join("\n")}

## Next Report-Only Actions

${report.nextReportOnlyActions.map((action) => `- ${action}`).join("\n")}
`;
}

async function main() {
  const [samples, shopSplit, normalizationPrep, tokenBoundary] = await Promise.all([
    readJson(samplePath),
    readJson(path.join(reportsDir, "desktop-shop-template-split-latest.json")),
    readJson(path.join(reportsDir, "desktop-cpu-gpu-normalization-prep-latest.json")),
    readJson(path.join(reportsDir, "desktop-cpu-gpu-title-token-boundary-evidence-latest.json")),
  ]);

  const fixtures = fixtureSeeds.map((seed) => buildFixture(seed, samples));
  const report = {
    generatedAt: new Date().toISOString(),
    category: "desktop_pc_discovered",
    conclusion: "desktop_private_used_cpu_gpu_contract_report_only_blocked_on_owner_decisions",
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope:
      "Report-only contract for private-used desktop full units requiring private-used language, fixed one-off listing, CPU identity, RTX/RX or unambiguous GPU identity, and no shop/configurable/full-set/accessory signal.",
    metrics: {
      sourceSamples: samples.length,
      contractFixtureRows: fixtures.length,
      positiveCandidateRows: fixtures.filter((row) => row.expectedDecision === "positive_contract_candidate").length,
      holdRows: fixtures.filter((row) => row.expectedDecision === "hold").length,
      runtimeApprovedRows: 0,
      shopTemplateRowsTreatedComparable: 0,
      inheritedShopSplitFixtureRows: shopSplit.metrics.fixtureRows,
      inheritedTitleTokenRows: tokenBoundary.metrics.rowsWithBothTitleTokens,
      inheritedParserReadyRateReference: normalizationPrep.currentMetrics.parserReadyRate,
    },
    contractRules,
    fixtures,
    ownerDecisions,
    sourceReportsRead,
    nextReportOnlyActions,
  };

  await writeFile(
    path.join(reportsDir, "desktop-private-used-cpu-gpu-contract-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(
    path.join(reportsDir, "desktop-private-used-cpu-gpu-contract-latest.md"),
    renderMarkdown(report),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
