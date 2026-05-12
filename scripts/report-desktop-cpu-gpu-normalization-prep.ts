import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DesktopParserReport = {
  total: number;
  normal: number;
  normalRate: number;
  parserReady: number;
  parserReadyRate: number;
  generic: number;
  genericRate: number;
  gateCounts: Array<{ key: string; count: number }>;
};

type BoundaryRow = {
  pid: string;
  title: string;
  price: number;
  key: string | null;
  keyClass: string;
  reviewClass: string;
  cpuTitleToken?: string;
  gpuTitleToken?: string;
  cpuTokenClass?: string;
  gpuTokenClass?: string;
  keyMismatchClass?: string;
};

type BoundaryReport = {
  metrics: {
    titleRows: number;
    rowsWithBothTitleTokens: number;
    ambiguousCpuTokenRows: number;
    genericKeyDespiteTokensRows: number;
    unresolvedKeyDespiteTitleTokenRows: number;
    runtimeApprovedRows: number;
  };
  rows: BoundaryRow[];
};

type TokenReviewReport = {
  metrics: {
    reviewRows: number;
    classCounts: Array<{ key: string; count: number }>;
  };
  rows: BoundaryRow[];
};

type NormalizedSample = {
  pid: string;
  title: string;
  price: number;
  condition: string;
  salesCount: number;
  reviewCount: number;
  reviewRating: number;
  isProshop: boolean;
  description: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const desktopDir = path.join(process.cwd(), "category-intelligence", "desktop_pc_discovered");

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

function sampleByPid(samples: NormalizedSample[], pid: string): NormalizedSample {
  const sample = samples.find((row) => row.pid === pid);
  if (!sample) {
    throw new Error(`Missing desktop sample ${pid}`);
  }
  return sample;
}

function listingSignals(sample: NormalizedSample): string[] {
  const text = `${sample.title}\n${sample.description}`;
  const signals: Array<[string, RegExp]> = [
    ["shop_template", /전국최저가|번장1등|카드결제|세금계산서|현금영수증|업체|상점|매장|A\/S|조립의뢰|추가 가능|변경 가능/i],
    ["configurable_build", /추가시|변경가격|변경 가능|구매 가능합니다|문의|수냉쿨러로 변경|SSD 추가 가능/i],
    ["full_set_option", /풀셋|풀세트|모니터|키보드|마우스|사운드바/i],
    ["private_used_language", /사용했|게임끊|팝니다|거의 사용 안|직거래만/i],
    ["gpu_only_title", /^(RTX)?\s*5080|RTX\s*5080/i],
  ];

  return signals.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const parser = await readJson<DesktopParserReport>(path.join(reportsDir, "desktop-parser-latest.json"));
  const boundary = await readJson<BoundaryReport>(
    path.join(reportsDir, "desktop-cpu-gpu-title-token-boundary-evidence-latest.json"),
  );
  const tokenReview = await readJson<TokenReviewReport>(path.join(reportsDir, "desktop-token-review-latest.json"));
  const samples = await readJson<NormalizedSample[]>(path.join(desktopDir, "normalized_samples.json"));

  const officialEvidence = [
    {
      vendor: "AMD",
      subject: "Ryzen 7 9800X3D",
      url: "https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9800x3d.html",
      policyUse: "Confirms 9800X3D is a Ryzen 9000 Series desktop CPU; normalize only with Ryzen generation/model context.",
    },
    {
      vendor: "AMD",
      subject: "Radeon RX 9070 XT",
      url: "https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html",
      policyUse: "Confirms RX 9070 XT belongs to Radeon RX 9000 Series desktop GPUs; do not collapse to RX 7000 or generic Radeon.",
    },
    {
      vendor: "Intel",
      subject: "Core Ultra 5 225F",
      url: "https://www.intel.com/content/www/us/en/products/sku/241069/intel-core-ultra-5-processor-225f-20m-cache-up-to-4-90-ghz/specifications.html",
      policyUse: "Confirms explicit Ultra 5 225F is a desktop Core Ultra Series 2 CPU token, not legacy Core i5 shorthand.",
    },
    {
      vendor: "Intel",
      subject: "Core Ultra 7 270K Plus",
      url: "https://newsroom.intel.com/client-computing/intel-announces-new-intel-core-ultra-200s-plus-series-desktop-processors",
      policyUse: "Confirms 270K Plus as a current Core Ultra 200S Plus desktop CPU family; naked 270K remains manual-review unless Plus/Core Ultra context is present.",
    },
    {
      vendor: "NVIDIA",
      subject: "GeForce RTX 5080",
      url: "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5080/",
      policyUse: "Confirms RTX 5080 is a GeForce RTX 50 Series desktop GPU; title token 5080 still needs GPU prefix or description support.",
    },
  ];

  const normalizationPolicies = [
    {
      axis: "cpu",
      family: "AMD X3D CPUs",
      observedTokens: ["7800X3D", "9800X3D"],
      proposedNormalForm: ["ryzen-7-7800x3d", "ryzen-7-9800x3d"],
      keyBehavior: "key_axis_after_main_review",
      rule: "Require an AMD/Ryzen or description CPU context; preserve Ryzen generation/model and X3D suffix; never collapse X3D models across generations.",
      blocker: "Current reports have title tokens but GPU/listing-type instability, so no runtime-positive case is approved.",
    },
    {
      axis: "cpu",
      family: "Intel Core Ultra ambiguity",
      observedTokens: ["울트라5 225F", "270K", "Core Ultra 7 270K Plus"],
      proposedNormalForm: ["core-ultra-5-225f", "manual-review-270k", "core-ultra-7-270k-plus"],
      keyBehavior: "key_axis_only_when_explicit",
      rule: "Normalize Ultra 5/7 only when the title or description contains Core/Ultra plus processor number. Naked 270K title tokens stay manual-review because Plus/Core Ultra context is absent from the title.",
      blocker: "The 270K row has description support, but the title-only token remains too ambiguous for parser inference.",
    },
    {
      axis: "gpu",
      family: "NVIDIA RTX 40/50 Series",
      observedTokens: ["RTX3080Ti", "RTX 4070", "RTX 5070", "RTX 5070 Ti", "5080", "RTX5080"],
      proposedNormalForm: ["rtx-3080ti", "rtx-4070", "rtx-5070", "rtx-5070ti", "rtx-5080"],
      keyBehavior: "key_axis_after_gpu_prefix_or_description_support",
      rule: "Normalize RTX tokens by generation and Ti suffix. Bare 5080 can map to RTX 5080 only when the description or nearby title text supplies GPU/RTX/GeForce context.",
      blocker: "GPU-only rows remain hold until CPU identity is present.",
    },
    {
      axis: "gpu",
      family: "Radeon RX 7000/9000 ambiguity",
      observedTokens: ["RX5700", "9070xt", "RX9070XT"],
      proposedNormalForm: ["rx-5700", "rx-9070xt"],
      keyBehavior: "key_axis_after_rx_prefix_or_description_support",
      rule: "Preserve RX generation and XT suffix. Do not interpret 9070xt as a comparable GPU unless title or description supplies Radeon/RX/GPU context.",
      blocker: "RX 9070 XT and RX 5700 rows need separate series-aware normalization before any comparable key is allowed.",
    },
  ];

  const axisPolicy = [
    {
      field: "CPU",
      status: "key_axis",
      reason: "Desktop PC value cannot be compared without CPU family/model; X3D and Core Ultra tokens materially change price class.",
    },
    {
      field: "GPU",
      status: "key_axis",
      reason: "GPU dominates gaming desktop price; RTX/RX series and Ti/XT suffixes must be preserved.",
    },
    {
      field: "RAM",
      status: "deferred_axis",
      reason: "Important for price, but current lane first needs stable CPU/GPU and listing-type gates. Keep as later variant field.",
    },
    {
      field: "SSD",
      status: "deferred_axis",
      reason: "Capacity and model matter, but configurable shop templates often offer upgrades; defer until shop template split is stable.",
    },
    {
      field: "warranty/newness",
      status: "deferred_axis",
      reason: "New parts and remaining warranty affect value, but should not override CPU/GPU identity or seller/listing-type classification.",
    },
    {
      field: "case color/aesthetic",
      status: "deferred_non_key_axis",
      reason: "White builds and aesthetic cases can explain price, but must not form comparable identity keys.",
    },
  ];

  const listingExamples = [
    {
      bucket: "private_used_pc_review_candidate",
      row: sampleByPid(samples, "407330838"),
      decision: "manual_review_candidate_after_cpu_gpu_policy",
      reason: "Short private-use wording, 8 months used, low seller history; CPU/GPU visible in title.",
    },
    {
      bucket: "private_used_gpu_only_hold",
      row: sampleByPid(samples, "407283659"),
      decision: "hold_until_cpu_title_or_description_key_review",
      reason: "Private-use wording and full specs in description, but title is GPU-led and current key is unknown CPU.",
    },
    {
      bucket: "commercial_or_configurable_template",
      row: sampleByPid(samples, "330388864"),
      decision: "manual_review_shop_template_split",
      reason: "Strong CPU/GPU title tokens, but delivery service, shop promises, add-ons, and high seller history make it unsuitable for used-PC comps.",
    },
    {
      bucket: "commercial_or_configurable_template",
      row: sampleByPid(samples, "407063663"),
      decision: "manual_review_shop_template_split",
      reason: "Title says direct deal, but description includes warranty blocks and many configurable upgrade choices.",
    },
    {
      bucket: "commercial_or_configurable_template",
      row: sampleByPid(samples, "52257536"),
      decision: "hold_shop_multi_configuration",
      reason: "Multiple PC configurations, shop boilerplate, card/tax receipt language, and upgrade pricing.",
    },
    {
      bucket: "commercial_or_full_set_template",
      row: sampleByPid(samples, "395278830"),
      decision: "hold_shop_full_set_multi_configuration",
      reason: "Full-set wording, shop identity, configurable parts, and high seller history.",
    },
  ].map((entry) => ({
    bucket: entry.bucket,
    pid: entry.row.pid,
    title: entry.row.title,
    price: entry.row.price,
    condition: entry.row.condition,
    salesCount: entry.row.salesCount,
    reviewCount: entry.row.reviewCount,
    signals: listingSignals(entry.row),
    decision: entry.decision,
    reason: entry.reason,
  }));

  const fixturePrepRows = [
    ...boundary.rows.map((row) => ({
      caseId: row.pid === "405428599" ? "DESKTOP-NORM-MANUAL-INTEL-270K" : `DESKTOP-NORM-MANUAL-${row.pid}`,
      expected: "manual_review",
      title: row.title,
      cpuToken: row.cpuTitleToken ?? "-",
      gpuToken: row.gpuTitleToken ?? "-",
      policyReason: row.keyMismatchClass ?? row.keyClass,
    })),
    ...tokenReview.rows
      .filter((row) => row.reviewClass === "gpu_only_missing_cpu")
      .map((row) => ({
        caseId: `DESKTOP-NORM-HOLD-${row.pid}`,
        expected: "hold",
        title: row.title,
        cpuToken: "-",
        gpuToken: row.gpuTitleToken ?? row.title.match(/RTX\s*5080|RTX\s*3080Ti|5080/i)?.[0] ?? "gpu_only",
        policyReason: "GPU-only title/listing cannot form desktop comparable key.",
      })),
  ];

  const ownerDecisions = [
    "Approve exact CPU normal forms for Ryzen X3D and Core Ultra tokens before parser work.",
    "Decide whether bare 5080/9070xt can use description context, or must require title-level RTX/RX prefix.",
    "Decide whether configurable shop builds get a separate shop-template lane instead of private used-PC comparable keys.",
    "Decide when RAM/SSD/warranty/newness graduate from deferred fields into comparable key or price-adjustment fields.",
  ];

  const report = {
    generatedAt,
    category: "desktop_pc_discovered",
    conclusion: "desktop_cpu_gpu_normalization_policy_prep_report_only",
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Desktop CPU/GPU normalization and seller/listing-type policy prep only.",
    nonScope: [
      "runtime parser edits",
      "candidate-pool wiring",
      "public promotion",
      "whole desktop category approval",
      "desktop PC price comparison before CPU/GPU and listing-type policy is stable",
    ],
    sourceReportsRead: [
      "reports/category-wide-runtime-rollout-plan-2026-05-12.md",
      "reports/subagent-implementation-prep-next-gate-latest.md",
      "reports/category-runtime-readiness-board-latest.md",
      "reports/pass-category-expansion-rollup-latest.md",
      "reports/desktop-cpu-gpu-policy-draft-latest.md",
      "reports/desktop-cpu-gpu-implementation-prep-latest.md",
      "reports/desktop-no-mutation-runtime-dry-run-latest.md",
      "reports/desktop-artifact-consistency-audit-latest.md",
      "reports/desktop-cpu-gpu-title-token-boundary-evidence-latest.json",
      "reports/desktop-token-review-latest.json",
      "category-intelligence/desktop_pc_discovered/normalized_samples.json",
    ],
    currentMetrics: {
      total: parser.total,
      normal: parser.normal,
      normalRate: parser.normalRate,
      parserReady: parser.parserReady,
      parserReadyRate: parser.parserReadyRate,
      generic: parser.generic,
      genericRate: parser.genericRate,
      gateCounts: parser.gateCounts,
      titleRows: boundary.metrics.titleRows,
      rowsWithBothTitleTokens: boundary.metrics.rowsWithBothTitleTokens,
      ambiguousCpuTokenRows: boundary.metrics.ambiguousCpuTokenRows,
      genericKeyDespiteTokensRows: boundary.metrics.genericKeyDespiteTokensRows,
      unresolvedKeyDespiteTitleTokenRows: boundary.metrics.unresolvedKeyDespiteTitleTokenRows,
      runtimeApprovedRows: boundary.metrics.runtimeApprovedRows,
    },
    officialEvidence,
    normalizationPolicies,
    axisPolicy,
    observedTokenRows: boundary.rows,
    listingTypeSplit: listingExamples,
    fixturePrepRows,
    ownerDecisions,
    nextReportOnlyActions: [
      "Add more private used rows with both CPU and GPU visible in title and description.",
      "Build a shop-template fixture set from configurable, delivery, tax receipt, and upgrade-choice descriptions.",
      "Run a no-mutation parser comparison only after main-agent approves normalization terms.",
    ],
  };

  const md = `# Desktop CPU/GPU Normalization Prep

- generatedAt: ${generatedAt}
- category: desktop_pc_discovered
- conclusion: desktop_cpu_gpu_normalization_policy_prep_report_only
- reportOnly: true
- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false
- productionDbMutation/directThirtyDayPlanEdit: false/false

## Scope

Policy-prep only for desktop CPU/GPU normalization and listing-type separation. This does not edit parser/runtime code, does not approve desktop_pc_discovered, and does not compare desktop PCs before CPU/GPU plus seller/listing-type policy is stable.

## Current Evidence Snapshot

${table(
    ["metric", "value"],
    [
      ["total samples", parser.total],
      ["normal rows", `${parser.normal} (${parser.normalRate}%)`],
      ["parser-ready among normal", `${parser.parserReady} (${parser.parserReadyRate}%)`],
      ["generic rows among normal", `${parser.generic} (${parser.genericRate}%)`],
      ["title rows with both CPU/GPU tokens", boundary.metrics.rowsWithBothTitleTokens],
      ["unresolved key despite title tokens", boundary.metrics.unresolvedKeyDespiteTitleTokenRows],
      ["runtime-approved rows", boundary.metrics.runtimeApprovedRows],
    ],
  )}

## Official Evidence Anchors

${table(
    ["vendor", "subject", "policy use", "url"],
    officialEvidence.map((source) => [source.vendor, source.subject, source.policyUse, source.url]),
  )}

## Normalization Policy Draft

${table(
    ["axis", "family", "observed tokens", "proposed normal form", "key behavior", "blocker"],
    normalizationPolicies.map((policy) => [
      policy.axis,
      policy.family,
      policy.observedTokens.join(", "),
      policy.proposedNormalForm.join(", "),
      policy.keyBehavior,
      policy.blocker,
    ]),
  )}

### Policy Notes

- AMD X3D CPUs: preserve exact model and generation. 7800X3D and 9800X3D must not collapse into a generic x3d bucket.
- Intel Ultra/270K: explicit Ultra 5 225F can normalize after review. Naked 270K title tokens stay manual-review; Core Ultra 7 270K Plus requires explicit Plus/Core Ultra context.
- RTX 40/50: preserve generation and Ti suffix. Bare 5080 needs RTX/GPU/GeForce support from title or description and still needs CPU identity.
- Radeon RX 7000/9000: preserve RX generation and XT suffix. 9070xt needs RX/Radeon/GPU support and must not be treated like RX 7000.

## Key Axes vs Deferred Axes

${table(
    ["field", "status", "reason"],
    axisPolicy.map((axis) => [axis.field, axis.status, axis.reason]),
  )}

## Observed Token Rows

${table(
    ["pid", "expected prep class", "cpu token", "gpu token", "current key class", "title"],
    boundary.rows.map((row) => [
      row.pid,
      "manual_review",
      row.cpuTitleToken ?? "-",
      row.gpuTitleToken ?? "-",
      row.keyClass,
      row.title,
    ]),
  )}

## Listing-Type Split

${table(
    ["bucket", "pid", "decision", "signals", "title"],
    listingExamples.map((row) => [row.bucket, row.pid, row.decision, row.signals.join(", "), row.title]),
  )}

## Fixture Prep Rows

${table(
    ["caseId", "expected", "cpu", "gpu", "reason", "title"],
    fixturePrepRows.map((row) => [row.caseId, row.expected, row.cpuToken, row.gpuToken, row.policyReason, row.title]),
  )}

## Owner Decisions Still Needed

${ownerDecisions.map((item) => `- ${item}`).join("\n")}

## Next Report-Only Actions

- Add more private used rows with both CPU and GPU visible in title and description.
- Build a shop-template fixture set from configurable, delivery, tax receipt, and upgrade-choice descriptions.
- Run a no-mutation parser comparison only after main-agent approves normalization terms.

## Stop Condition

Stop before editing runtime parser/catalog/pipeline/candidate-pool files. Desktop remains evidence-backfill-first with zero runtime-approved rows.
`;

  await writeFile(path.join(reportsDir, "desktop-cpu-gpu-normalization-prep-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "desktop-cpu-gpu-normalization-prep-latest.md"), md);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
