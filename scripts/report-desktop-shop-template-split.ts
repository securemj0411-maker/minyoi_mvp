import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Seller = {
  review_rating: number;
  review_count: number;
  sales_count: number;
  proshop: boolean;
  is_official: boolean;
};

type DesktopSample = {
  pid: string;
  title: string;
  price: number;
  condition: string;
  description: string;
  url: string;
  seller: Seller;
};

type NormalizationPrep = {
  currentMetrics: {
    total: number;
    normal: number;
    parserReady: number;
    parserReadyRate: number;
    generic: number;
    runtimeApprovedRows: number;
  };
  normalizationPolicies: Array<{
    axis: string;
    family: string;
    observedTokens: string[];
    keyBehavior: string;
  }>;
  ownerDecisions: string[];
};

type RuntimeDryRun = {
  metrics: {
    rows: number;
    passedRows: number;
    failedRows: number;
    candidatePositiveOnlyRows: number;
  };
};

type FixtureSeed = {
  caseId: string;
  pid: string;
  expectedBucket: string;
  decision: string;
  reason: string;
};

type FixtureRow = FixtureSeed & {
  title: string;
  price: number;
  condition: string;
  salesCount: number;
  reviewCount: number;
  signals: string[];
  evidenceSnippet: string;
  url: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const desktopDir = path.join(process.cwd(), "category-intelligence", "desktop_pc_discovered");

const signalPatterns: Array<{ key: string; pattern: RegExp; policyUse: string }> = [
  {
    key: "option_select",
    pattern: /옵션\s*선택|옵션|선택\s*가능/i,
    policyUse: "Treat as configurable/shop unless a single fixed private-used spec and price is explicit.",
  },
  {
    key: "configuration_change",
    pattern: /구성\s*변경|변경\s*가능|변경가격|추가\s*가능|추가시|업글|업그레이드/i,
    policyUse: "Do not compare to private used rows because CPU/GPU/RAM/SSD/case can change per buyer.",
  },
  {
    key: "quote_or_consultation",
    pattern: /견적|상담|문의\s*주세요|톡주시면|가격.?비교|맞춤/i,
    policyUse: "Hold as shop/configurable when the listing invites specification changes or custom estimates.",
  },
  {
    key: "new_custom_build",
    pattern: /새상품|새제품|조립\s*후|조립.*발송|조립컴퓨터\s*전문|출고|발송/i,
    policyUse: "Separate new/custom build templates from one-off private used PCs.",
  },
  {
    key: "store_business_as",
    pattern: /매장|업체|A\/S건|A\/S\s*처리|무상AS|무상\s*한달\s*A\/?S|초기불량\s*무상AS|사후관리|세금계산서|카드결제|현금영수증|사업자|프로상점/i,
    policyUse: "Treat store/service-backed rows as commercial until owner approves a separate shop-template lane.",
  },
  {
    key: "full_set_or_peripheral_option",
    pattern: /풀셋|풀세트|모니터|키보드|마우스|사운드바|장패드/i,
    policyUse: "Hold from body-only comps unless body-only price is explicit and separated.",
  },
  {
    key: "private_used_language",
    pattern: /사용했|사용\s*안|실사용|게임끊|이사로|넘어가기 위해|직거래|팝니다|네고/i,
    policyUse: "Private-use evidence only; still requires CPU/GPU and must not be overridden by shop/configurable signals.",
  },
  {
    key: "buying_or_key_accessory",
    pattern: /매입|삽니다|정품키|오피스|라이선스|부품/i,
    policyUse: "Hard hold from desktop full-unit comparable keys.",
  },
];

const fixtureSeeds: FixtureSeed[] = [
  {
    caseId: "DESKTOP-SHOP-SPLIT-PRIVATE-USED-01",
    pid: "407330838",
    expectedBucket: "private_used_pc_review_candidate",
    decision: "manual_review_candidate_after_cpu_gpu_policy",
    reason: "Low seller history, 8-month use statement, and CPU/GPU visible in title make this a private-used fixture candidate after CPU/GPU policy.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-PRIVATE-USED-02",
    pid: "403834426",
    expectedBucket: "private_used_pc_review_candidate",
    decision: "manual_review_candidate_after_cpu_gpu_policy",
    reason: "Single fixed spec, recent purchase/use duration, direct-deal wording, and no store-template boilerplate.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-PRIVATE-USED-03",
    pid: "407321515",
    expectedBucket: "private_used_pc_review_candidate",
    decision: "manual_review_candidate_after_cpu_gpu_policy",
    reason: "Personal upgrade reason and one fixed CPU/GPU spec; warranty is deferred context, not a shop-template signal by itself.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-PRIVATE-HOLD-04",
    pid: "407283659",
    expectedBucket: "private_used_gpu_led_hold",
    decision: "hold_until_cpu_title_or_description_key_review",
    reason: "Private-use wording exists, but the title is GPU-led and CPU is description-only; keep out of candidate-positive rows.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-SHOP-01",
    pid: "52257536",
    expectedBucket: "shop_multi_configuration_hold",
    decision: "hold_shop_multi_configuration",
    reason: "Multiple numbered PC configurations, tax/card receipt language, upgrade pricing, and high seller history.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-SHOP-02",
    pid: "395278830",
    expectedBucket: "shop_full_set_template_hold",
    decision: "hold_shop_full_set_multi_configuration",
    reason: "Full-set/event template with shop identity, configurable parts, receipts, delivery, and A/S language.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-SHOP-03",
    pid: "407063663",
    expectedBucket: "new_custom_build_configurable_hold",
    decision: "manual_review_shop_template_split",
    reason: "New direct-deal title is paired with warranty blocks, cooler/SSD configuration changes, and option pricing.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-SHOP-04",
    pid: "407329585",
    expectedBucket: "shop_upgrade_option_hold",
    decision: "hold_shop_upgrade_option_template",
    reason: "Certified-shop wording, tax/card receipts, A/S, monitor/case add-ons, and RTX 3060 Ti collection/template wording.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-SHOP-05",
    pid: "406930303",
    expectedBucket: "shop_custom_quote_hold",
    decision: "hold_shop_quote_template",
    reason: "Custom estimate, store, tax receipt, A/S, and commercial boilerplate signals outweigh the single GPU title token.",
  },
  {
    caseId: "DESKTOP-SHOP-SPLIT-SHOP-06",
    pid: "330388864",
    expectedBucket: "store_service_build_review",
    decision: "manual_review_shop_template_split",
    reason: "Strong CPU/GPU title tokens, but store location, direct delivery/install, add-ons, and service promises make it unsuitable for private-used comps.",
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function mdEscape(value: string | number | null | undefined): string {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

function textFor(sample: DesktopSample): string {
  return `${sample.title}\n${sample.description}`;
}

function detectSignals(sample: DesktopSample): string[] {
  const text = textFor(sample);
  return signalPatterns.filter(({ pattern }) => pattern.test(text)).map(({ key }) => key);
}

function snippetFor(sample: DesktopSample, signals: string[]): string {
  const lines = textFor(sample)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const signal = signalPatterns.find(({ key }) => signals.includes(key));
  if (!signal) {
    return lines[0] ?? sample.title;
  }
  return lines.find((line) => signal.pattern.test(line)) ?? lines[0] ?? sample.title;
}

function sampleByPid(samples: DesktopSample[], pid: string): DesktopSample {
  const sample = samples.find((row) => row.pid === pid);
  if (!sample) {
    throw new Error(`Missing desktop sample ${pid}`);
  }
  return sample;
}

function buildSignalCounts(samples: DesktopSample[]): Array<{ key: string; count: number; policyUse: string }> {
  return signalPatterns.map(({ key, pattern, policyUse }) => ({
    key,
    count: samples.filter((sample) => pattern.test(textFor(sample))).length,
    policyUse,
  }));
}

function buildMarkdown(report: {
  generatedAt: string;
  metrics: Record<string, number>;
  signalCounts: Array<{ key: string; count: number; policyUse: string }>;
  fixtures: FixtureRow[];
  normalizationReference: NormalizationPrep["normalizationPolicies"];
  ownerDecisions: string[];
  sourceReportsRead: string[];
}): string {
  const privateRows = report.fixtures.filter((row) => row.expectedBucket.includes("private"));
  const shopRows = report.fixtures.filter((row) => !row.expectedBucket.includes("private"));

  return `# Desktop Shop Template Split

- generatedAt: ${report.generatedAt}
- category: desktop_pc_discovered
- conclusion: desktop_shop_template_split_ready_for_main_review_report_only
- reportOnly: true
- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false
- productionDbMutation/directThirtyDayPlanEdit: false/false

## Scope

Agent D implementation-prep only. This packet separates private used desktop PC rows from shop/configurable templates before any CPU/GPU runtime normalization. It does not approve desktop runtime wiring, public promotion, candidate-pool wiring, Supabase changes, cron/lifecycle changes, pack UI changes, or 30-day-plan edits.

## Metrics

${table(
    ["metric", "value"],
    Object.entries(report.metrics).map(([key, value]) => [key, value]),
  )}

## Shop / Listing-Type Signals

${table(
    ["signal", "observed rows", "policy use"],
    report.signalCounts.map((row) => [row.key, row.count, row.policyUse]),
  )}

## Private Used Fixture Rows

${table(
    ["caseId", "pid", "decision", "signals", "title", "evidence"],
    privateRows.map((row) => [
      row.caseId,
      row.pid,
      row.decision,
      row.signals.join(", "),
      row.title,
      row.evidenceSnippet,
    ]),
  )}

## Shop / Configurable Template Fixture Rows

${table(
    ["caseId", "pid", "expected bucket", "decision", "signals", "title", "evidence"],
    shopRows.map((row) => [
      row.caseId,
      row.pid,
      row.expectedBucket,
      row.decision,
      row.signals.join(", "),
      row.title,
      row.evidenceSnippet,
    ]),
  )}

## CPU/GPU Reference Only

${table(
    ["axis", "family", "observed tokens", "current behavior"],
    report.normalizationReference.map((row) => [
      row.axis,
      row.family,
      row.observedTokens.join(", "),
      row.keyBehavior,
    ]),
  )}

CPU/GPU normalization remains reference-only until the seller/listing-type split is stable. Rows with good CPU/GPU title tokens still stay manual/hold if they have shop-template, configurable, quote, store, A/S, or full-set signals.

## No-Runtime Implementation Prep Contract

${table(
    ["rule", "implementation-prep expectation"],
    [
      ["private_used_pc_review_candidate", "May become a parser fixture only after CPU/GPU normal forms are approved and no shop/configurable signal is present."],
      ["private_used_gpu_led_hold", "Remain hold until CPU identity is title-visible or owner approves description-backed CPU keys."],
      ["shop_multi_configuration_hold", "Always hold from private used-PC comps; future owner may approve a separate shop-template lane."],
      ["new_custom_build_configurable_hold", "Hold when new/custom-build rows expose upgrade choices or option pricing."],
      ["shop_custom_quote_hold", "Hold when quote/consultation/store-service language means the title price is not one fixed used-PC spec."],
      ["full_set_or_peripheral_option", "Hold unless body-only price is explicit and isolated from monitor/keyboard/mouse bundles."],
    ],
  )}

## Blocked Owner Decisions

${report.ownerDecisions.map((decision) => `- ${decision}`).join("\n")}
- Decide whether shop/configurable rows should get a separate comparable lane or remain excluded from desktop private-used comps.
- Decide the minimum proof for shop-template classification when seller history is low but description has option pricing or warranty blocks.
- Decide whether private rows with a single upgrade option stay private-used manual review or move to configurable-template hold.

## Source Reports Read

${report.sourceReportsRead.map((source) => `- ${source}`).join("\n")}

## Next Report-Only Actions

- Add more private used rows with fixed CPU/GPU title tokens and no shop/configurable wording.
- Add negative fixtures for option-choice, quote, store/A/S, full-set, and Windows-key/accessory rows.
- After main-agent owner decisions, run a no-mutation parser comparison without candidate-pool or runtime catalog wiring.
`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const samples = await readJson<DesktopSample[]>(path.join(desktopDir, "normalized_samples.json"));
  const normalizationPrep = await readJson<NormalizationPrep>(
    path.join(reportsDir, "desktop-cpu-gpu-normalization-prep-latest.json"),
  );
  const runtimeDryRun = await readJson<RuntimeDryRun>(
    path.join(reportsDir, "desktop-no-mutation-runtime-dry-run-latest.json"),
  );

  const fixtures = fixtureSeeds.map((seed) => {
    const sample = sampleByPid(samples, seed.pid);
    const signals = detectSignals(sample);
    return {
      ...seed,
      title: sample.title,
      price: sample.price,
      condition: sample.condition,
      salesCount: sample.seller.sales_count,
      reviewCount: sample.seller.review_count,
      signals,
      evidenceSnippet: snippetFor(sample, signals),
      url: sample.url,
    };
  });

  const metrics = {
    totalSamples: samples.length,
    parserReadyRateReference: normalizationPrep.currentMetrics.parserReadyRate,
    runtimeApprovedRows: normalizationPrep.currentMetrics.runtimeApprovedRows,
    priorNoMutationRows: runtimeDryRun.metrics.rows,
    priorNoMutationFailedRows: runtimeDryRun.metrics.failedRows,
    priorCandidatePositiveOnlyRows: runtimeDryRun.metrics.candidatePositiveOnlyRows,
    fixtureRows: fixtures.length,
    privateUsedFixtureRows: fixtures.filter((row) => row.expectedBucket.includes("private")).length,
    shopTemplateFixtureRows: fixtures.filter((row) => !row.expectedBucket.includes("private")).length,
  };

  const sourceReportsRead = [
    "reports/subagent-continuous-wave-2-work-orders-2026-05-12.md",
    "reports/category-orchestration-loop-2026-05-12.md",
    "reports/legacy-subagent-to-parallel-bridge-2026-05-12.md",
    "reports/parallel-category-subagent-integration-review-2026-05-12.md",
    "reports/camera-package-axis-schema-2026-05-12.md",
    "reports/desktop-cpu-gpu-normalization-prep-latest.md/json",
    "reports/desktop-cpu-gpu-policy-draft-latest.md",
    "reports/desktop-no-mutation-runtime-dry-run-latest.md/json",
    "category-intelligence/desktop_pc_discovered/normalized_samples.json",
  ];

  const report = {
    generatedAt,
    category: "desktop_pc_discovered",
    conclusion: "desktop_shop_template_split_ready_for_main_review_report_only",
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope:
      "Implementation-prep fixture packet for separating private used desktop PCs from shop/configurable templates before CPU/GPU runtime normalization.",
    metrics,
    signalCounts: buildSignalCounts(samples),
    fixtures,
    normalizationReference: normalizationPrep.normalizationPolicies,
    ownerDecisions: normalizationPrep.ownerDecisions,
    additionalBlockedOwnerDecisions: [
      "Decide whether shop/configurable rows should get a separate comparable lane or remain excluded from desktop private-used comps.",
      "Decide the minimum proof for shop-template classification when seller history is low but description has option pricing or warranty blocks.",
      "Decide whether private rows with a single upgrade option stay private-used manual review or move to configurable-template hold.",
    ],
    sourceReportsRead,
    nextReportOnlyActions: [
      "Add more private used rows with fixed CPU/GPU title tokens and no shop/configurable wording.",
      "Add negative fixtures for option-choice, quote, store/A/S, full-set, and Windows-key/accessory rows.",
      "After main-agent owner decisions, run a no-mutation parser comparison without candidate-pool or runtime catalog wiring.",
    ],
  };

  await writeFile(
    path.join(reportsDir, "desktop-shop-template-split-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(path.join(reportsDir, "desktop-shop-template-split-latest.md"), buildMarkdown(report));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
