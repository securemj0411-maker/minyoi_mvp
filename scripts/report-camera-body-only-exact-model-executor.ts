import fs from "node:fs";
import path from "node:path";

type NormalizedSample = {
  pid: string;
  title?: string;
  name?: string;
  price?: number;
};

type Fixture = {
  caseId: string;
  pid: string;
  expectedDecision: "candidate_positive_contract_only" | "manual_review" | "hold_or_exclusion";
  expectedComparableKey: string | null;
  reason: string;
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^0-9a-z가-힣+./&-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text: string) {
  return normalizeText(text).replace(/\s+/g, "");
}

function inferModel(title: string) {
  const compact = compactText(title);
  const patterns: Array<[RegExp, { family: string; bodyModel: string }]> = [
    [/eosr6markii|r6markii|r6m2|알육막투/, { family: "canon", bodyModel: "eos_r6_mark_ii" }],
    [/eosm6|m6mark2|m6마크2/, { family: "canon", bodyModel: "eos_m6" }],
    [/eos6d|캐논6d/, { family: "canon", bodyModel: "eos_6d" }],
    [/eosr10|캐논r10|r10바디/, { family: "canon", bodyModel: "eos_r10" }],
    [/eosr8|캐논r8/, { family: "canon", bodyModel: "eos_r8" }],
    [/eosrp|캐논rp/, { family: "canon", bodyModel: "eos_rp" }],
    [/a7c2|ilce-?7cm2/, { family: "sony", bodyModel: "a7c_ii" }],
    [/a7c|ilce-?7c/, { family: "sony", bodyModel: "a7c" }],
    [/a5100|ilce-?5100/, { family: "sony", bodyModel: "a5100" }],
    [/a7m3|a7iii|ilce-?7m3/, { family: "sony", bodyModel: "a7m3" }],
    [/z9|니콘z9/, { family: "nikon", bodyModel: "z9" }],
    [/x-t4|xt4|후지필름x-t4/, { family: "fujifilm", bodyModel: "x_t4" }],
    [/g7x|powershotg7x|파워샷g7x/, { family: "canon", bodyModel: "g7x" }],
  ];
  for (const [pattern, model] of patterns) {
    if (pattern.test(compact)) return model;
  }
  return null;
}

function classifyBodyOnlyExact(title: string) {
  const text = normalizeText(title);
  const compact = compactText(title);
  const model = inferModel(title);
  const hardExclusion =
    /구매|삽니다|구합니다|업자x|사기꾼/.test(text) ||
    /하자|수리필요|부품용|고장/.test(text) ||
    /바디캡|렌즈캡|뒷캡|캡\s*악세|케이스|가방/.test(text);
  const fixedLensCompact = /g7x|powershot|파워샷|cyber-?shot|사이버샷/.test(compact);
  const lensSignal =
    /렌즈|번들|킷|세트|일괄|탐론|시그마|삼양|ttartisan|mm|f[0-9.]+/.test(text) ||
    /\+\s*[0-9]/.test(title);
  const explicitBodyOnly =
    /바디만|바디\s*단품|바디\s*판매|카메라\s*바디|미러리스\s*바디|dslr\s*바디|<\s*바디만\s*>|\(바디\)/.test(text) ||
    /(^|\s)바디($|\s)/.test(text) ||
    /바디$/.test(text) ||
    /바디셋/.test(text);
  const fullBoxOnly = /풀박스|풀구성|풀셋|풀셋트/.test(text);

  if (hardExclusion || fixedLensCompact) {
    return {
      decision: "hold_or_exclusion" as const,
      family: model?.family ?? null,
      bodyModel: model?.bodyModel ?? null,
      comparableKey: null,
      reason: hardExclusion ? "hard_exclusion" : "fixed_lens_compact_out_of_lane",
    };
  }
  if (!model) {
    if (lensSignal) {
      return {
        decision: "hold_or_exclusion" as const,
        family: null,
        bodyModel: null,
        comparableKey: null,
        reason: "lens_only_or_lens_signal_without_body_model",
      };
    }
    return {
      decision: "manual_review" as const,
      family: null,
      bodyModel: null,
      comparableKey: null,
      reason: "missing_exact_body_model",
    };
  }
  if (lensSignal) {
    return {
      decision: "hold_or_exclusion" as const,
      family: model.family,
      bodyModel: model.bodyModel,
      comparableKey: null,
      reason: "lens_or_bundle_signal_not_body_only",
    };
  }
  if (!explicitBodyOnly || fullBoxOnly) {
    return {
      decision: "manual_review" as const,
      family: model.family,
      bodyModel: model.bodyModel,
      comparableKey: null,
      reason: fullBoxOnly ? "full_box_without_no_lens_proof" : "exact_model_without_body_only_signal",
    };
  }
  return {
    decision: "candidate_positive_contract_only" as const,
    family: model.family,
    bodyModel: model.bodyModel,
    comparableKey: `camera|${model.family}|${model.bodyModel}|body_only|no_lens`,
    reason: "exact_model_body_only_no_lens_signal",
  };
}

const fixtureRows: Fixture[] = [
  {
    caseId: "CAMERA-BODY-ONLY-POS-01",
    pid: "392737375",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|canon|eos_r6_mark_ii|body_only|no_lens",
    reason: "Canon R6 Mark II body-only exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-POS-02",
    pid: "394633226",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|sony|a7c|body_only|no_lens",
    reason: "Sony A7C body-only exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-POS-03",
    pid: "372639361",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|sony|a5100|body_only|no_lens",
    reason: "Sony A5100 body single-item exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-POS-04",
    pid: "407231564",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|canon|eos_m6|body_only|no_lens",
    reason: "Canon EOS M6 body-only exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-POS-05",
    pid: "400946361",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|nikon|z9|body_only|no_lens",
    reason: "Nikon Z9 body sale exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-POS-06",
    pid: "406050015",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|canon|eos_6d|body_only|no_lens",
    reason: "Canon EOS 6D body-only exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-POS-07",
    pid: "374220730",
    expectedDecision: "candidate_positive_contract_only",
    expectedComparableKey: "camera|fujifilm|x_t4|body_only|no_lens",
    reason: "Fujifilm X-T4 body-only exact model.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-MANUAL-01",
    pid: "407308705",
    expectedDecision: "manual_review",
    expectedComparableKey: null,
    reason: "Exact model but no body-only evidence.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-MANUAL-02",
    pid: "399955865",
    expectedDecision: "manual_review",
    expectedComparableKey: null,
    reason: "Full-box wording does not prove lens exclusion.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-MANUAL-03",
    pid: "403733957",
    expectedDecision: "manual_review",
    expectedComparableKey: null,
    reason: "Body full-set wording should not infer no-lens automatically.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-01",
    pid: "406559555",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Lens set included; must not merge with body-only.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-02",
    pid: "357513813",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Body plus 18-45 lens package; not body-only.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-03",
    pid: "402644064",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Lens-only listing.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-04",
    pid: "403509133",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Body cap/lens cap accessory-only listing.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-05",
    pid: "403131771",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Damaged/defect body-only row stays held.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-06",
    pid: "281480782",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Buying-intent row.",
  },
  {
    caseId: "CAMERA-BODY-ONLY-HOLD-07",
    pid: "407321410",
    expectedDecision: "hold_or_exclusion",
    expectedComparableKey: null,
    reason: "Fixed-lens compact out of interchangeable body-only lane.",
  },
];

const samples = JSON.parse(
  fs.readFileSync("category-intelligence/camera_discovered/normalized_samples.json", "utf8"),
) as NormalizedSample[];
const sampleByPid = new Map(samples.map((row) => [row.pid, row]));

const rows = fixtureRows.map((fixture) => {
  const sample = sampleByPid.get(fixture.pid);
  const title = sample?.title ?? sample?.name ?? "";
  const actual = classifyBodyOnlyExact(title);
  const found = Boolean(sample);
  const pass =
    found &&
    actual.decision === fixture.expectedDecision &&
    actual.comparableKey === fixture.expectedComparableKey;
  return {
    ...fixture,
    found,
    title,
    price: sample?.price ?? null,
    actualDecision: actual.decision,
    family: actual.family,
    bodyModel: actual.bodyModel,
    packageAxis: actual.decision === "candidate_positive_contract_only" ? "body_only" : null,
    lensAxis: actual.decision === "candidate_positive_contract_only" ? "no_lens" : null,
    actualComparableKey: actual.comparableKey,
    actualReason: actual.reason,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);
const positiveRows = rows.filter((row) => row.actualDecision === "candidate_positive_contract_only");
const distinctPositiveFamilies = new Set(positiveRows.map((row) => row.family).filter(Boolean)).size;

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "camera_discovered",
  lane: "interchangeable_body_only_exact_model",
  inputFiles: [
    "reports/camera-smaller-exact-subset-latest.json",
    "category-intelligence/camera_discovered/normalized_samples.json",
  ],
  metrics: {
    rows: rows.length,
    positiveRows: positiveRows.length,
    manualRows: rows.filter((row) => row.actualDecision === "manual_review").length,
    holdRows: rows.filter((row) => row.actualDecision === "hold_or_exclusion").length,
    distinctPositiveFamilies,
    failedRows: failedRows.length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  contract: {
    positiveRule:
      "recognized interchangeable camera family + exact body model + explicit body-only/body sale/main-unit token + no lens/bundle/fixed-lens/damaged/buying/accessory override",
    comparableKey: "camera|{family}|{body_model}|body_only|no_lens",
    minimumBeforeRuntime: "at least 5 positives across at least 2 families, with manual and hold contamination fixtures",
  },
  rows,
  failedRows,
  conclusion:
    failedRows.length === 0 && positiveRows.length >= 5 && distinctPositiveFamilies >= 2
      ? "camera_body_only_exact_model_no_mutation_executor_passed"
      : "camera_body_only_exact_model_no_mutation_executor_needs_review",
  nextAction:
    "Run runtime impact review before any src/lib camera parser/category patch. Keep body-plus-lens, fixed-lens compact, and lens-only lanes held.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-body-only-exact-model-no-mutation-executor-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-exact-model-no-mutation-executor-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Camera Body-Only Exact-Model No-Mutation Executor",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- lane: ${report.lane}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- positiveRows: ${report.metrics.positiveRows}`,
  `- manualRows: ${report.metrics.manualRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- distinctPositiveFamilies: ${report.metrics.distinctPositiveFamilies}`,
  `- failedRows: ${report.metrics.failedRows}`,
  "",
  "## Contract",
  "",
  `- positiveRule: ${report.contract.positiveRule}`,
  `- comparableKey: \`${report.contract.comparableKey}\``,
  `- minimumBeforeRuntime: ${report.contract.minimumBeforeRuntime}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | key | pass | title | reason |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) =>
    `| ${row.caseId} | ${row.expectedDecision} | ${row.actualDecision} | ${row.actualComparableKey ?? "null"} | ${
      row.pass ? "yes" : "no"
    } | ${row.title.replace(/\|/g, "\\|")} | ${row.actualReason} |`,
  ),
  "",
  "## Failed Rows",
  "",
  failedRows.length === 0
    ? "- none"
    : failedRows
        .map(
          (row) =>
            `- ${row.caseId}: expected ${row.expectedDecision}/${row.expectedComparableKey ?? "null"}, actual ${
              row.actualDecision
            }/${row.actualComparableKey ?? "null"}`,
        )
        .join("\n"),
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
      conclusion: report.conclusion,
      rows: report.metrics.rows,
      positiveRows: report.metrics.positiveRows,
      distinctPositiveFamilies: report.metrics.distinctPositiveFamilies,
      failedRows: report.metrics.failedRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
