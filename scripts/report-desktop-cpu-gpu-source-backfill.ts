import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReadSummary = {
  path: string;
  bytes: number;
  kind: "json" | "markdown";
  topLevelKeys?: string[];
  rows?: number | null;
  metrics?: unknown;
};

type SourceEvidence = {
  id: string;
  axis: "cpu" | "gpu";
  vendor: "AMD" | "Intel" | "NVIDIA";
  observedTokens: string[];
  normalizedToken: string;
  productName: string;
  sourceTier: "official_product" | "official_press_or_partner" | "official_support" | "secondary_spec_database";
  sourceUrl: string;
  sourceUse: string;
  generationOrSeries: string;
  releaseYear: number | null;
  releaseYearConfidence: "high" | "medium" | "low";
  normalizationGuidance: string;
  ambiguityGuidance: string;
};

type MarketplaceRiskRow = {
  caseId: string;
  pid: string | null;
  title: string;
  cpuToken: string | null;
  gpuToken: string | null;
  sourceReport: string;
  sourceRisk: "title_visible" | "description_only" | "bare_gpu" | "bare_cpu" | "shop_template" | "gpu_only" | "software_or_non_body";
  ownerDecisionEvidenceQuality: "strong" | "medium" | "weak";
  recommendedPolicy: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  directThirtyDayPlanEdit: false;
  lane: "desktop_private_used_cpu_gpu_source_backfill";
  sourceWorkOrder: string;
  inputFiles: Record<string, ReadSummary>;
  metrics: {
    sourceEvidenceRows: number;
    officialSourceRows: number;
    secondarySourceRows: number;
    marketplaceRiskRows: number;
    titleVisiblePolicyRows: number;
    descriptionOnlyRiskRows: number;
    bareGpuRiskRows: number;
    shopTemplateRiskRows: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
  };
  sourceEvidence: SourceEvidence[];
  marketplaceRiskRows: MarketplaceRiskRow[];
  ownerDecisionEvidenceQuality: string[];
  blockedRuntimePatchReasons: string[];
  conclusion: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const inputFiles = {
  workOrder: "reports/subagent-source-backfill-wave-2026-05-12.md",
  ownerDecisionPacket: "reports/desktop-owner-decision-packet-latest.json",
  ownerDecisionPacketMd: "reports/desktop-owner-decision-packet-latest.md",
  runtimeReviewPacket: "reports/desktop-private-used-runtime-review-packet-latest.json",
  privateUsedPositiveBackfill: "reports/desktop-private-used-positive-backfill-latest.json",
  privateUsedTargetedAcquisition: "reports/desktop-private-used-targeted-acquisition-latest.json",
  normalizationPrep: "reports/desktop-cpu-gpu-normalization-prep-latest.json",
  titleTokenBoundaryEvidence: "reports/desktop-cpu-gpu-title-token-boundary-evidence-latest.json",
};

const sourceEvidence: SourceEvidence[] = [
  {
    id: "SRC-CPU-AMD-9800X3D",
    axis: "cpu",
    vendor: "AMD",
    observedTokens: ["9800x3d", "Ryzen 7 9800X3D"],
    normalizedToken: "ryzen-7-9800x3d",
    productName: "AMD Ryzen 7 9800X3D",
    sourceTier: "official_product",
    sourceUrl: "https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9800x3d.html",
    sourceUse: "Confirms product identity as an AMD Ryzen 9000-series desktop processor.",
    generationOrSeries: "Ryzen 9000 Series / Zen 5 desktop X3D",
    releaseYear: 2024,
    releaseYearConfidence: "high",
    normalizationGuidance: "Keep full Ryzen 7 9800X3D token; never collapse to generic x3d or 9800.",
    ambiguityGuidance: "Title token 9800x3d is strong CPU evidence, but still needs full desktop body and GPU evidence.",
  },
  {
    id: "SRC-CPU-AMD-7800X3D",
    axis: "cpu",
    vendor: "AMD",
    observedTokens: ["7800x3d", "Ryzen 7 7800X3D"],
    normalizedToken: "ryzen-7-7800x3d",
    productName: "AMD Ryzen 7 7800X3D",
    sourceTier: "official_press_or_partner",
    sourceUrl: "https://www.amd.com/content/dam/amd/en/documents/partner-hub/ryzen/amd-ryzen-7-7800x3d-gaming-performance-battlecard.pdf",
    sourceUse: "AMD partner battlecard identifies Ryzen 7 7800X3D and April 2023 evidence context.",
    generationOrSeries: "Ryzen 7000 Series / Zen 4 desktop X3D",
    releaseYear: 2023,
    releaseYearConfidence: "high",
    normalizationGuidance: "Keep full Ryzen 7 7800X3D token; do not merge with 9800X3D.",
    ambiguityGuidance: "Title token 7800x3d is strong CPU evidence, but rows with 새상품/configurable text need shop-template review.",
  },
  {
    id: "SRC-CPU-INTEL-225F",
    axis: "cpu",
    vendor: "Intel",
    observedTokens: ["울트라5 225F", "ultra5 225f", "Core Ultra 5 225F"],
    normalizedToken: "core-ultra-5-225f",
    productName: "Intel Core Ultra 5 processor 225F",
    sourceTier: "official_product",
    sourceUrl:
      "https://www.intel.com/content/www/us/en/products/sku/241069/intel-core-ultra-5-processor-225f-20m-cache-up-to-4-90-ghz/specifications.html",
    sourceUse: "Confirms Core Ultra 5 225F as an Intel Core Ultra Series 2 desktop processor.",
    generationOrSeries: "Intel Core Ultra Processors Series 2 / desktop",
    releaseYear: 2025,
    releaseYearConfidence: "high",
    normalizationGuidance: "Normalize explicit 울트라5 225F/Core Ultra 5 225F to core-ultra-5-225f.",
    ambiguityGuidance: "Korean shorthand is acceptable only when Ultra/i5/225F context is title-visible.",
  },
  {
    id: "SRC-CPU-INTEL-270K-PLUS",
    axis: "cpu",
    vendor: "Intel",
    observedTokens: ["270K Plus", "Core Ultra 7 270K Plus"],
    normalizedToken: "core-ultra-7-270k-plus",
    productName: "Intel Core Ultra 7 processor 270K Plus",
    sourceTier: "official_product",
    sourceUrl:
      "https://www.intel.com/content/www/us/en/products/sku/245692/intel-core-ultra-7-processor-270k-plus-36m-cache-up-to-5-50-ghz/specifications.html",
    sourceUse: "Confirms explicit 270K Plus as a Core Ultra Series 2 desktop CPU.",
    generationOrSeries: "Intel Core Ultra 200S Plus / desktop",
    releaseYear: 2026,
    releaseYearConfidence: "high",
    normalizationGuidance: "Normalize only explicit Core Ultra 7 270K Plus or 270K Plus context.",
    ambiguityGuidance: "Bare 270K remains manual/hold; do not infer Core Ultra 7 270K Plus from title-only 270K.",
  },
  {
    id: "SRC-GPU-NVIDIA-RTX5080",
    axis: "gpu",
    vendor: "NVIDIA",
    observedTokens: ["RTX5080", "RTX 5080", "5080"],
    normalizedToken: "rtx-5080",
    productName: "NVIDIA GeForce RTX 5080",
    sourceTier: "official_product",
    sourceUrl: "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5080/",
    sourceUse: "Confirms GeForce RTX 5080 as an RTX 50-series desktop graphics card.",
    generationOrSeries: "GeForce RTX 50 Series / Blackwell",
    releaseYear: 2025,
    releaseYearConfidence: "high",
    normalizationGuidance: "Normalize RTX 5080/RTX5080 to rtx-5080 while preserving generation.",
    ambiguityGuidance: "Bare 5080 without RTX/GeForce/GPU context is ambiguous and must remain manual/hold.",
  },
  {
    id: "SRC-GPU-NVIDIA-RTX5070-FAMILY",
    axis: "gpu",
    vendor: "NVIDIA",
    observedTokens: ["RTX 5070", "RTX5070", "RTX 5070 Ti", "RTX5070Ti"],
    normalizedToken: "rtx-5070-or-rtx-5070ti",
    productName: "NVIDIA GeForce RTX 5070 Family",
    sourceTier: "official_product",
    sourceUrl: "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/",
    sourceUse: "Confirms RTX 5070 Ti and RTX 5070 as distinct RTX 50-series family members.",
    generationOrSeries: "GeForce RTX 50 Series / Blackwell",
    releaseYear: 2025,
    releaseYearConfidence: "high",
    normalizationGuidance: "Preserve Ti suffix; rtx-5070 and rtx-5070ti are separate normal forms.",
    ambiguityGuidance: "Bare 5070 is weaker than RTX 5070 and should not pass without RTX/GPU context.",
  },
  {
    id: "SRC-GPU-NVIDIA-RTX4070-FAMILY",
    axis: "gpu",
    vendor: "NVIDIA",
    observedTokens: ["RTX 4070", "RTX4070", "RTX 4070 Ti", "RTX4070Ti"],
    normalizedToken: "rtx-4070-or-rtx-4070ti",
    productName: "NVIDIA GeForce RTX 4070 Family",
    sourceTier: "official_product",
    sourceUrl: "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4070-family/",
    sourceUse: "Confirms RTX 4070, 4070 SUPER, 4070 Ti, and 4070 Ti SUPER as separate 40-series products.",
    generationOrSeries: "GeForce RTX 40 Series / Ada Lovelace",
    releaseYear: 2023,
    releaseYearConfidence: "medium",
    normalizationGuidance: "Preserve RTX generation and Ti/SUPER suffixes where title-visible.",
    ambiguityGuidance: "4070 without RTX/GPU context is not enough for auto-positive desktop keying.",
  },
  {
    id: "SRC-GPU-NVIDIA-RTX3080TI",
    axis: "gpu",
    vendor: "NVIDIA",
    observedTokens: ["RTX3080Ti", "RTX 3080 Ti"],
    normalizedToken: "rtx-3080ti",
    productName: "NVIDIA GeForce RTX 3080 Ti",
    sourceTier: "secondary_spec_database",
    sourceUrl: "https://www.techpowerup.com/gpu-specs/geforce-rtx-3080-ti.c3735",
    sourceUse: "Secondary spec database fallback for older RTX 30-series Ti token identity and release year.",
    generationOrSeries: "GeForce RTX 30 Series / Ampere",
    releaseYear: 2021,
    releaseYearConfidence: "medium",
    normalizationGuidance: "Preserve Ti suffix; rtx-3080ti is not equivalent to rtx-3080.",
    ambiguityGuidance: "GPU-only RTX3080Ti title rows remain hold without CPU identity.",
  },
  {
    id: "SRC-GPU-AMD-RX9070XT",
    axis: "gpu",
    vendor: "AMD",
    observedTokens: ["RX9070XT", "RX 9070 XT", "9070xt"],
    normalizedToken: "rx-9070xt",
    productName: "AMD Radeon RX 9070 XT",
    sourceTier: "official_product",
    sourceUrl: "https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html",
    sourceUse: "Confirms Radeon RX 9070 XT as an AMD Radeon RX 9000-series desktop GPU.",
    generationOrSeries: "Radeon RX 9000 Series / RDNA 4",
    releaseYear: 2025,
    releaseYearConfidence: "high",
    normalizationGuidance: "Normalize RX 9070 XT/RX9070XT to rx-9070xt; preserve XT suffix.",
    ambiguityGuidance: "Bare 9070xt without RX/Radeon/GPU context is ambiguous and should remain manual.",
  },
  {
    id: "SRC-GPU-AMD-RX5700",
    axis: "gpu",
    vendor: "AMD",
    observedTokens: ["RX5700", "RX 5700", "Radeon RX 5700"],
    normalizedToken: "rx-5700",
    productName: "AMD Radeon RX 5700",
    sourceTier: "official_support",
    sourceUrl:
      "https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-rx/radeon-rx-5000-series/amd-radeon-rx-5700.html",
    sourceUse: "Official AMD support page confirms Radeon RX 5700 under Radeon RX 5000 Series.",
    generationOrSeries: "Radeon RX 5000 Series / RDNA",
    releaseYear: 2019,
    releaseYearConfidence: "medium",
    normalizationGuidance: "Normalize RX5700/RX 5700 to rx-5700 only with RX/Radeon context.",
    ambiguityGuidance: "5700 without RX/Radeon/GPU context is too broad for automatic desktop GPU inference.",
  },
];

async function readSummary(file: string): Promise<ReadSummary> {
  const fullPath = path.join(appDir, file);
  const raw = await readFile(fullPath, "utf8");
  if (!file.endsWith(".json")) {
    return { path: file, bytes: raw.length, kind: "markdown" };
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rows = Array.isArray(parsed.rows)
    ? parsed.rows.length
    : Array.isArray(parsed.fixtures)
      ? parsed.fixtures.length
      : null;
  return {
    path: file,
    bytes: raw.length,
    kind: "json",
    topLevelKeys: Object.keys(parsed),
    rows,
    metrics: parsed.metrics ?? parsed.currentMetrics ?? null,
  };
}

async function readInputSummaries(): Promise<Record<string, ReadSummary>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => [key, await readSummary(file)] as const),
  );
  return Object.fromEntries(entries);
}

function buildMarketplaceRiskRows(): MarketplaceRiskRow[] {
  return [
    {
      caseId: "DESKTOP-SOURCE-RISK-001",
      pid: "330388864",
      title: "9800x3d, 5080 올화이트pc팝니다",
      cpuToken: "9800x3d",
      gpuToken: "5080",
      sourceReport: "desktop-cpu-gpu-title-token-boundary-evidence-latest",
      sourceRisk: "bare_gpu",
      ownerDecisionEvidenceQuality: "medium",
      recommendedPolicy: "Normalize CPU to ryzen-7-9800x3d, but keep GPU/manual until title has RTX/GeForce or trusted description GPU context.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-002",
      pid: "407063663",
      title: "(새상품)(직거래) 7800X3D 9070xt 게이밍 컴퓨터 본체",
      cpuToken: "7800x3d",
      gpuToken: "9070xt",
      sourceReport: "desktop-cpu-gpu-title-token-boundary-evidence-latest",
      sourceRisk: "bare_gpu",
      ownerDecisionEvidenceQuality: "medium",
      recommendedPolicy: "Normalize CPU to ryzen-7-7800x3d; hold 9070xt unless RX/Radeon context is title-visible or owner accepts description-backed GPU.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-003",
      pid: "401614618",
      title: "게이밍 컴퓨터 PC 본체 울트라5 225F RX5700 배그 데스크탑",
      cpuToken: "울트라5 225F",
      gpuToken: "RX5700",
      sourceReport: "desktop-cpu-gpu-title-token-boundary-evidence-latest",
      sourceRisk: "title_visible",
      ownerDecisionEvidenceQuality: "strong",
      recommendedPolicy: "Strong source-backed normalization row: core-ultra-5-225f plus rx-5700 are both title-visible; still no runtime approval until owner accepts category axis.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-004",
      pid: "405428599",
      title: "270K 5080 컴퓨터 본체 붉은사막 게이밍 작업용 PC",
      cpuToken: "270K",
      gpuToken: "5080",
      sourceReport: "desktop-cpu-gpu-title-token-boundary-evidence-latest",
      sourceRisk: "bare_cpu",
      ownerDecisionEvidenceQuality: "weak",
      recommendedPolicy: "Hold: bare 270K must not become core-ultra-7-270k-plus; bare 5080 also needs RTX/GeForce/GPU context.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-005",
      pid: "407283659",
      title: "RTX5080 완본체 팝니다",
      cpuToken: null,
      gpuToken: "RTX5080",
      sourceReport: "desktop-cpu-gpu-normalization-prep-latest",
      sourceRisk: "gpu_only",
      ownerDecisionEvidenceQuality: "medium",
      recommendedPolicy: "GPU token can normalize to rtx-5080, but missing CPU identity keeps the row hold/manual.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-006",
      pid: "330388864",
      title: "9800x3d, 5080 올화이트pc팝니다",
      cpuToken: "9800x3d",
      gpuToken: "5080",
      sourceReport: "desktop-cpu-gpu-normalization-prep-latest",
      sourceRisk: "shop_template",
      ownerDecisionEvidenceQuality: "medium",
      recommendedPolicy: "Shop/configurable-template signals should split from private-used one-off comparable keys even when CPU/GPU evidence exists.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-007",
      pid: null,
      title: "Description menu contains optional CPU/GPU upgrades",
      cpuToken: null,
      gpuToken: null,
      sourceReport: "desktop-owner-decision-packet-latest",
      sourceRisk: "description_only",
      ownerDecisionEvidenceQuality: "weak",
      recommendedPolicy: "Description-only CPU/GPU stays manual-only because configurable menus can mention unrelated options.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
    {
      caseId: "DESKTOP-SOURCE-RISK-008",
      pid: null,
      title: "윈도우/오피스 product-key or software-only listing",
      cpuToken: null,
      gpuToken: null,
      sourceReport: "desktop-private-used packets",
      sourceRisk: "software_or_non_body",
      ownerDecisionEvidenceQuality: "strong",
      recommendedPolicy: "Hard hold: not a desktop body and no CPU/GPU comparable key should be emitted.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ];
}

function markdownEscape(value: string | number | null): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: Report): string {
  const lines = [
    "# Desktop CPU/GPU Source Backfill",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply: false",
    "- runtimeApply: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "- runtimeApprovedRows/publicPromotionRows/candidatePoolRows/runtimeApplyRows: 0/0/0/0",
    "",
    "## Metrics",
    "",
    `- sourceEvidenceRows: ${report.metrics.sourceEvidenceRows}`,
    `- officialSourceRows: ${report.metrics.officialSourceRows}`,
    `- secondarySourceRows: ${report.metrics.secondarySourceRows}`,
    `- marketplaceRiskRows: ${report.metrics.marketplaceRiskRows}`,
    `- titleVisiblePolicyRows: ${report.metrics.titleVisiblePolicyRows}`,
    `- descriptionOnlyRiskRows: ${report.metrics.descriptionOnlyRiskRows}`,
    `- bareGpuRiskRows: ${report.metrics.bareGpuRiskRows}`,
    `- shopTemplateRiskRows: ${report.metrics.shopTemplateRiskRows}`,
    "",
    "## Source Evidence",
    "",
    "| id | axis | vendor | observed tokens | normalized token | generation/year | source tier | source |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.sourceEvidence.map((row) =>
      `| ${row.id} | ${row.axis} | ${row.vendor} | ${markdownEscape(row.observedTokens.join(", "))} | ${row.normalizedToken} | ${markdownEscape(`${row.generationOrSeries} / ${row.releaseYear ?? "unknown"}`)} | ${row.sourceTier} | ${markdownEscape(row.sourceUrl)} |`,
    ),
    "",
    "## Marketplace Risk Rows",
    "",
    "| caseId | pid | risk | cpu | gpu | evidence quality | recommended policy | title |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.marketplaceRiskRows.map((row) =>
      `| ${row.caseId} | ${markdownEscape(row.pid)} | ${row.sourceRisk} | ${markdownEscape(row.cpuToken)} | ${markdownEscape(row.gpuToken)} | ${row.ownerDecisionEvidenceQuality} | ${markdownEscape(row.recommendedPolicy)} | ${markdownEscape(row.title)} |`,
    ),
    "",
    "## Owner Decision Evidence Quality",
    "",
    ...report.ownerDecisionEvidenceQuality.map((item) => `- ${item}`),
    "",
    "## Blocked Runtime Patch Reasons",
    "",
    ...report.blockedRuntimePatchReasons.map((item) => `- ${item}`),
    "",
    "## Next Action",
    "",
    "- Owner/main-agent can use this source packet to decide CPU/GPU normalization terms, but this packet does not approve parser/runtime/catalog/candidate-pool/public changes.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputSummaries = await readInputSummaries();
  const marketplaceRiskRows = buildMarketplaceRiskRows();
  const officialSourceRows = sourceEvidence.filter((row) => row.sourceTier !== "secondary_spec_database").length;
  const secondarySourceRows = sourceEvidence.length - officialSourceRows;
  const report: Report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    lane: "desktop_private_used_cpu_gpu_source_backfill",
    sourceWorkOrder: inputFiles.workOrder,
    inputFiles: inputSummaries,
    metrics: {
      sourceEvidenceRows: sourceEvidence.length,
      officialSourceRows,
      secondarySourceRows,
      marketplaceRiskRows: marketplaceRiskRows.length,
      titleVisiblePolicyRows: marketplaceRiskRows.filter((row) => row.sourceRisk === "title_visible").length,
      descriptionOnlyRiskRows: marketplaceRiskRows.filter((row) => row.sourceRisk === "description_only").length,
      bareGpuRiskRows: marketplaceRiskRows.filter((row) => row.sourceRisk === "bare_gpu").length,
      shopTemplateRiskRows: marketplaceRiskRows.filter((row) => row.sourceRisk === "shop_template").length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    sourceEvidence,
    marketplaceRiskRows,
    ownerDecisionEvidenceQuality: [
      "Strong: title-visible Core Ultra 5 225F + RX5700 can be normalized from official Intel/AMD source anchors, but remains report-only.",
      "Medium: Ryzen X3D CPU tokens are source-backed, but bare GPU tokens such as 5080/9070xt still need RTX/RX/Radeon context.",
      "Weak: description-only CPU/GPU should stay manual because shop templates and configurable menus can mention non-selected options.",
      "Medium: RTX/RX family pages support generation-aware GPU normalization, but GPU-only rows cannot form full desktop comparable keys.",
    ],
    blockedRuntimePatchReasons: [
      "Desktop category axis still needs owner approval before any runtime patch.",
      "Initial readiness must be internal_only or blocked, never public ready.",
      "Candidate pool and public promotion remain closed.",
      "Shop/configurable-template rows need a separate split before private-used one-off comparable keys are safe.",
      "Bare GPU and bare CPU tokens remain manual/hold without explicit RTX/RX/Core Ultra/Ryzen context.",
    ],
    conclusion: "desktop_cpu_gpu_source_backfill_complete_report_only_owner_decision_evidence",
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "desktop-cpu-gpu-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "desktop-cpu-gpu-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, buildMarkdown(report));

  JSON.parse(await readFile(jsonPath, "utf8")) as Report;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
