import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type CategoryNode = {
  id: string;
  title: string;
  count?: number;
  categories?: CategoryNode[];
};

type CategoryTree = {
  categories: CategoryNode[];
};

type SampleInventoryRow = {
  category: string;
  samples: number;
  normalizedSamples: number;
  hasSkuCatalog: boolean;
  hasApprovalQueue: boolean;
  hasClusterAnalysis: boolean;
  dataDepth: "broad" | "medium" | "shallow" | "none";
};

type CoverageStatus =
  | "covered_by_existing_phase"
  | "existing_runtime_or_prior_mining"
  | "candidate_for_mining"
  | "needs_split"
  | "blocked"
  | "ignore";

type CoverageRow = {
  id: string;
  title: string;
  path: string;
  count: number;
  mappedPhase: string;
  status: CoverageStatus;
  localEvidence: string;
  sampleCount: number;
  rationale: string;
  deferred: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const categoryDir = path.join(process.cwd(), "category-intelligence");

const forbiddenSurfaces = [
  "runtime catalog",
  "src/lib/catalog.ts",
  "src/lib/category-readiness.ts",
  "src/lib/option-parser.ts",
  "src/lib/pipeline.ts",
  "src/lib/tick-pipeline.ts",
  "src/lib/pack-open.ts",
  "src/lib/candidate-pool-builder.ts",
  "src/app/api/cron/*",
  "src/app/debug/*",
  "pack UI components",
  "supabase/schema.sql",
  "Supabase data/schema/RPC/policies/migrations",
  "candidate pool policy",
  "public promotion or runtime catalog apply",
  "30일_실행계획.md",
];

const schemaFields = [
  "caseId",
  "phase",
  "category",
  "scope",
  "inputTitle",
  "inputDescription",
  "expectedClass",
  "blockerType",
  "productIdentityTokens",
  "variantTokens",
  "conditionTokens",
  "sellerIntentTokens",
  "bundleOrQuantityTokens",
  "accessoryOrPartTokens",
  "evidenceSource",
  "externalEvidence",
  "laterRuntimeFiles",
  "confidence",
  "notes",
];

const taxonomyAxes = [
  "product identity",
  "brand/model/family",
  "variant/edition/generation",
  "connector/capacity/size/connectivity",
  "accessory/parts/side-only/case-only",
  "condition/damage/fake/counterfeit",
  "seller intent",
  "bundle/full-set/multi-unit",
  "subtype/device class",
  "manual-review ambiguity",
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function readOptionalJson(file: string): Promise<unknown | null> {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

function countRows(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    for (const key of ["samples", "rows", "items", "queue", "clusters"]) {
      const child = record[key];
      if (Array.isArray(child)) return child.length;
    }
  }
  return 0;
}

async function sampleInventory(): Promise<SampleInventoryRow[]> {
  const entries = await readJson<string[]>("/dev/null").catch(() => null);
  void entries;
  const { readdir } = await import("node:fs/promises");
  const dirents = await readdir(categoryDir, { withFileTypes: true });
  const rows: SampleInventoryRow[] = [];

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const category = dirent.name;
    const base = path.join(categoryDir, category);
    const samples = countRows(await readOptionalJson(path.join(base, "samples.json")));
    const normalizedSamples = countRows(await readOptionalJson(path.join(base, "normalized_samples.json")));
    const skuCatalog = await readOptionalJson(path.join(base, "sku_catalog.json"));
    const approvalQueue = await readOptionalJson(path.join(base, "approval_queue.json"));
    const clusterAnalysis = await readOptionalJson(path.join(base, "cluster_analysis.json"));
    if (samples === 0 && normalizedSamples === 0 && !skuCatalog && !approvalQueue && !clusterAnalysis) continue;
    const sampleCount = Math.max(samples, normalizedSamples);
    const dataDepth = sampleCount >= 500 ? "broad" : sampleCount >= 300 ? "medium" : sampleCount > 0 ? "shallow" : "none";
    rows.push({
      category,
      samples,
      normalizedSamples,
      hasSkuCatalog: Boolean(skuCatalog),
      hasApprovalQueue: Boolean(approvalQueue),
      hasClusterAnalysis: Boolean(clusterAnalysis),
      dataDepth,
    });
  }

  return rows.sort((a, b) => b.samples - a.samples || a.category.localeCompare(b.category));
}

function flattenCategoryTree(nodes: CategoryNode[], parents: string[] = []): Array<CategoryNode & { pathTitles: string[] }> {
  const rows: Array<CategoryNode & { pathTitles: string[] }> = [];
  for (const node of nodes) {
    const pathTitles = [...parents, node.title];
    rows.push({ ...node, pathTitles });
    rows.push(...flattenCategoryTree(node.categories ?? [], pathTitles));
  }
  return rows;
}

function sampleCountFor(inventory: SampleInventoryRow[], categories: string[]): { evidence: string; count: number } {
  const found = inventory.filter((row) => categories.includes(row.category));
  if (found.length === 0) return { evidence: "-", count: 0 };
  return {
    evidence: found.map((row) => `${row.category}:${row.samples}`).join(", "),
    count: found.reduce((sum, row) => sum + row.samples, 0),
  };
}

function classifyCoverage(row: CategoryNode & { pathTitles: string[] }, inventory: SampleInventoryRow[]): CoverageRow | null {
  const pathText = row.pathTitles.join(" > ");
  const title = row.title;
  const count = row.count ?? 0;
  const leafOrImportant = (row.categories?.length ?? 0) === 0 || row.pathTitles.length <= 2;
  if (!leafOrImportant) return null;
  if (!row.pathTitles.includes("디지털") && !row.pathTitles.includes("가전제품")) return null;

  let mappedPhase = "-";
  let status: CoverageStatus = "candidate_for_mining";
  let categories: string[] = [];
  let rationale = "Tech category exists in Bunjang tree but is not covered by the current 10-category implementation-prep queue.";
  let deferred = "Decide whether targeted mining is worth doing after current deep phases.";

  if (pathText.includes("스마트폰") || pathText.includes("휴대폰")) {
    mappedPhase = "existing smartphone/readiness";
    status = title.includes("케이스") || title.includes("케이블") || title.includes("액세서리") ? "ignore" : "existing_runtime_or_prior_mining";
    categories = ["smartphone"];
    rationale = status === "ignore" ? "Accessory/mobile peripheral category; not a comparable product target for this queue." : "Prior smartphone mining exists and is outside this parser-prep queue.";
    deferred = status === "ignore" ? "Only revisit if accessory resale becomes a product strategy." : "Keep separate from discovered parser-prep; phone-specific battery/carrier/refurb gates remain a separate program.";
  } else if (pathText.includes("태블릿")) {
    mappedPhase = "prior tablet/internal roadmap";
    status = title.includes("케이스") || title.includes("케이블") ? "ignore" : "candidate_for_mining";
    rationale = status === "ignore" ? "Tablet accessory branch, not a main product identity target." : "Tablet is known roadmap/internal but not in the 10-category prep queue.";
    deferred = status === "ignore" ? "Revisit only for accessory strategy." : "Needs targeted tablet mining for generation/storage/connectivity/pen-keyboard bundle gates.";
  } else if (pathText.includes("웨어러블")) {
    mappedPhase = "Phase 6 lightweight";
    status = title.includes("케이스") || title.includes("케이블") ? "ignore" : "covered_by_existing_phase";
    categories = ["smartwatch_discovered", "applewatch", "galaxywatch"];
    rationale = status === "ignore" ? "Wearable accessory branch." : "Smartwatch ambiguity prep covers watch/band identity but existing runtime smartwatch readiness must not be copied.";
    deferred = status === "ignore" ? "Hold as accessory." : "Phase 6 only representative split prep; deeper runtime changes require owner approval.";
  } else if (title === "이어폰") {
    mappedPhase = "Phase 1 deep";
    status = "covered_by_existing_phase";
    categories = ["earphone_discovered", "airpods"];
    rationale = "Earphone/AirPods implementation-prep is covered, but AirPods is the deep scope, not whole earphone public readiness.";
    deferred = "Non-AirPods earphone remains hold unless separately mined.";
  } else if (title === "헤드폰") {
    mappedPhase = "Phase 2 deep";
    status = "covered_by_existing_phase";
    categories = ["headphone_discovered"];
    rationale = "Matched-SKU headphone prep covers this branch only for known SKUs.";
    deferred = "Broad wireless headphone without model remains hold/manual-review.";
  } else if (title.includes("스피커") || title.includes("오디오/홈시어터")) {
    mappedPhase = "Phase 8 lightweight";
    status = "needs_split";
    categories = ["speaker_audio_discovered"];
    rationale = "Audio category mixes portable speakers, amps, receivers, soundbars, PA, and home theater.";
    deferred = "Do representative split prep only; runtime class architecture is later work.";
  } else if (title.includes("MP3") || title.includes("비디오") || title.includes("프로젝터")) {
    mappedPhase = "future mining";
    status = "candidate_for_mining";
    rationale = "Adjacent digital category not covered by current phases.";
    deferred = "Add targeted mining only after core implementation-prep candidates are ranked.";
  } else if (title === "데스크탑") {
    mappedPhase = "Phase 5 deep";
    status = "covered_by_existing_phase";
    categories = ["desktop_pc_discovered"];
    rationale = "Desktop complete CPU/GPU body prep covers this branch.";
    deferred = "Components, configurable shop, RAM/SSD/warranty gates remain later implementation details.";
  } else if (title.includes("노트북")) {
    mappedPhase = "existing laptop/internal roadmap";
    status = title.includes("가방") || title.includes("액세서리") ? "ignore" : "existing_runtime_or_prior_mining";
    categories = ["laptop"];
    rationale = status === "ignore" ? "Laptop accessory branch." : "Laptop mining exists but is outside the current implementation-prep queue.";
    deferred = status === "ignore" ? "Hold as accessory." : "MacBook/laptop needs separate year/chip/RAM/SSD/battery-cycle program.";
  } else if (title === "모니터") {
    mappedPhase = "Phase 4 deep";
    status = "covered_by_existing_phase";
    categories = ["monitor_discovered"];
    rationale = "Monitor model-code rows are a deep prep phase.";
    deferred = "Size/resolution/Hz-only rows remain hold/manual-review.";
  } else if (title.includes("키보드") || title.includes("마우스") || title.includes("PC 주변기기")) {
    mappedPhase = "future mining";
    status = "candidate_for_mining";
    rationale = "Peripheral categories could be products, but are not part of current 10-category evidence closure.";
    deferred = "Potential future category if market/velocity justifies separate SKU strategy.";
  } else if (pathText.includes("PC부품")) {
    mappedPhase = "future split mining";
    status = title.includes("소모품") || title.includes("USB") ? "ignore" : "needs_split";
    rationale = status === "ignore" ? "Consumable/peripheral branch is not a comparable product target now." : "PC parts need their own component-specific identity logic, not desktop body logic.";
    deferred = status === "ignore" ? "Revisit only for parts marketplace strategy." : "CPU/GPU/RAM/SSD/network/printer each needs separate mining before prep.";
  } else if (pathText.includes("게임/타이틀")) {
    mappedPhase = title.includes("PC게임") ? "ignore" : "Phase 3 deep plus broad contamination hold";
    status = title.includes("PC게임") ? "ignore" : "needs_split";
    categories = ["game_console_body_narrow", "game_console_discovered"];
    rationale = status === "ignore" ? "PC game media/code branch is not current product target." : "Bunjang branch mixes console bodies with titles/accessories; body-narrow prep covers only hardware.";
    deferred = status === "ignore" ? "Keep out of candidate product identity." : "Do not use broad branch as ready source; keep contamination map.";
  } else if (pathText.includes("카메라/DSLR")) {
    mappedPhase = "Phase 7 lightweight";
    status = title.includes("렌즈") || title.includes("삼각대") || title.includes("메모리") ? "needs_split" : "covered_by_existing_phase";
    categories = ["camera_discovered"];
    rationale = "Camera branch needs body/lens/kit/fixed-lens/accessory split.";
    deferred = "Phase 7 is architecture prep only; runtime camera parser requires later owner design.";
  } else if (pathText.includes("가전제품")) {
    mappedPhase = title.includes("청소기") || title.includes("생활가전") ? "Phase 9 lightweight" : "future mining or blocked";
    status = title.includes("청소기") || title.includes("생활가전") ? "needs_split" : "candidate_for_mining";
    categories = ["home_appliance_tech_discovered"];
    rationale = "Appliance data is shallow and generic/logistics-heavy; only subtype split prep is appropriate now.";
    deferred = "Do not deep-prep appliance runtime; mark missing subtypes for targeted mining and logistics architecture.";
  }

  const sample = sampleCountFor(inventory, categories);
  return {
    id: row.id,
    title,
    path: pathText,
    count,
    mappedPhase,
    status,
    localEvidence: sample.evidence,
    sampleCount: sample.count,
    rationale,
    deferred,
  };
}

function markdownTable(rows: string[][]): string {
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

async function writeReport(baseName: string, report: JsonRecord, markdown: string): Promise<void> {
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `${baseName}.json`), JSON.stringify(report, null, 2));
  await writeFile(path.join(reportsDir, `${baseName}.md`), `${markdown}\n`);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inventory = await sampleInventory();
  const tree = await readJson<CategoryTree>(path.join(categoryDir, "category-discovery/category_tree.json"));
  const guardrails = await readJson<JsonRecord>(path.join(reportsDir, "parser-policy-guardrails-latest.json"));
  const reviewCoverage = await readJson<JsonRecord>(path.join(reportsDir, "parser-review-coverage-summary-latest.json"));
  const workOrder = await readJson<JsonRecord>(path.join(reportsDir, "subagent-implementation-prep-work-order-2026-05-11.json"));

  const queueStatus = {
    generatedAt,
    mode: "implementation-prep",
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    workOrderRevision: workOrder.revision,
    guardrailStatus: guardrails.status,
    guardrailFilesChecked: guardrails.filesChecked,
    reviewCoverageClosedCategories: reviewCoverage.reviewCoverageClosedCategories,
    missingReviewEvidenceCategories: reviewCoverage.missingReviewEvidenceCategories,
    nextPhase: "Phase 0.5 - shared fixture schema and taxonomy axes",
    forbiddenSurfaces,
    stopConditions: [
      "runtime code edit required",
      "candidate pool/public promotion required",
      "Supabase/cron/lifecycle/debug/pack UI required",
      "model identity would require guessing",
      "new runtime category architecture required before tests",
    ],
    deferred: [
      "Do not treat shallow 160-row discovered samples as public readiness evidence.",
      "Live Bunjang/API re-mining is not run in this subagent phase; targeted mining needs separate owner approval.",
      "Appliance, speaker, camera, and smartwatch remain lightweight split/architecture prep unless stronger data exists.",
    ],
  };

  const queueMd = [
    "# Subagent Implementation-Prep Queue Status",
    "",
    `Generated: ${generatedAt}`,
    "",
    "This confirms implementation-prep mode. It is not runtime wiring and not public promotion.",
    "",
    `Work order revision: ${queueStatus.workOrderRevision}`,
    `Guardrail status: ${queueStatus.guardrailStatus}`,
    `Guardrail files checked: ${queueStatus.guardrailFilesChecked}`,
    `Review coverage closed categories: ${queueStatus.reviewCoverageClosedCategories}`,
    `Missing review evidence categories: ${queueStatus.missingReviewEvidenceCategories}`,
    `Next phase: ${queueStatus.nextPhase}`,
    "",
    "## Forbidden Surfaces",
    "",
    ...forbiddenSurfaces.map((item) => `- ${item}`),
    "",
    "## Deferred / Remember Later",
    "",
    ...queueStatus.deferred.map((item) => `- ${item}`),
  ].join("\n");
  await writeReport("subagent-implementation-prep-queue-status-latest", queueStatus, queueMd);

  const schemaReport = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    purpose: "Shared fixture/test-case schema for all implementation-prep phases.",
    requiredCaseFields: schemaFields,
    expectedClassValues: ["positive", "hold", "manual_review", "split_only", "ignore"],
    confidenceValues: ["high", "medium", "low"],
    taxonomyAxes,
    phaseReportFields: [
      "scope",
      "nonScope",
      "sourceReportsRead",
      "positiveTestCases",
      "negativeHoldTestCases",
      "manualReviewTestCases",
      "splitOnlyOrArchitectureCases",
      "blockerToTestMapping",
      "externalTaxonomyNotes",
      "proposedRuntimeFilesForLater",
      "dryRunStrategyForMainAgent",
      "stopCondition",
      "nextQueueItem",
    ],
    antiCludgeRules: [
      "Category reports must map evidence into this schema instead of inventing one-off prose structures.",
      "AirPods-specific terms are examples of variant/connector axes, not the schema itself.",
      "Hold/lightweight categories should use representative cases and defer architecture gaps explicitly.",
      "Every blocked or deferred point must remain machine-readable in JSON.",
    ],
  };
  const schemaMd = [
    "# Implementation-Prep Fixture Schema",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Shared schema for implementation-prep reports. This is the anti-cludge layer for future category scaling.",
    "",
    "## Required Case Fields",
    "",
    ...schemaFields.map((field) => `- \`${field}\``),
    "",
    "## Expected Classes",
    "",
    ...schemaReport.expectedClassValues.map((value) => `- \`${value}\``),
    "",
    "## Taxonomy Axes",
    "",
    ...taxonomyAxes.map((axis) => `- ${axis}`),
    "",
    "## Anti-Cludge Rules",
    "",
    ...schemaReport.antiCludgeRules.map((rule) => `- ${rule}`),
  ].join("\n");
  await writeReport("implementation-prep-fixture-schema-latest", schemaReport, schemaMd);

  const flatTree = flattenCategoryTree(tree.categories);
  const coverageRows = flatTree
    .map((row) => classifyCoverage(row, inventory))
    .filter((row): row is CoverageRow => Boolean(row))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  const statusCounts = coverageRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
  const shallowEvidence = inventory.filter((row) => row.dataDepth === "shallow").map((row) => row.category);
  const coverageReport = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    purpose: "Early Bunjang tech/electronics coverage map so the implementation-prep queue is not overfit to the current 10 categories.",
    totalRows: coverageRows.length,
    statusCounts,
    sampleInventory: inventory,
    rows: coverageRows,
    deferred: [
      "Discovered expansion categories mostly have 160 local samples, enough for representative prep but not enough for public quality assurance.",
      "Home appliance, speaker/audio, and camera require split/architecture prep before deeper runtime design.",
      "Tablet, PC parts, projectors/video, keyboards/mice, and some appliance subtypes are visible in the Bunjang tree but outside the current deep phases.",
      "Any fresh Bunjang collection should be targeted by this map and handled by the owner/main agent, not by production cron or DB mutation here.",
    ],
    shallowEvidenceCategories: shallowEvidence,
  };
  const coverageTable = markdownTable([
    ["path", "count", "status", "mapped_phase", "local_evidence", "deferred"],
    ["---", "---:", "---", "---", "---", "---"],
    ...coverageRows.map((row) => [
      row.path,
      String(row.count),
      row.status,
      row.mappedPhase,
      row.localEvidence,
      row.deferred.replace(/\|/g, "/"),
    ]),
  ]);
  const coverageMd = [
    "# Bunjang Tech Category Coverage Implementation-Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Early coverage map for Bunjang tech/electronics categories. This is not runtime category enablement.",
    "",
    "## Status Counts",
    "",
    ...Object.entries(statusCounts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Sample Inventory",
    "",
    markdownTable([
      ["category", "samples", "normalized", "depth"],
      ["---", "---:", "---:", "---"],
      ...inventory.map((row) => [row.category, String(row.samples), String(row.normalizedSamples), row.dataDepth]),
    ]),
    "",
    "## Coverage Rows",
    "",
    coverageTable,
    "",
    "## Deferred / Remember Later",
    "",
    ...coverageReport.deferred.map((item) => `- ${item}`),
  ].join("\n");
  await writeReport("bunjang-tech-category-coverage-implementation-prep-latest", coverageReport, coverageMd);

  console.log("wrote reports/subagent-implementation-prep-queue-status-latest.json");
  console.log("wrote reports/implementation-prep-fixture-schema-latest.json");
  console.log("wrote reports/bunjang-tech-category-coverage-implementation-prep-latest.json");
  console.log(`implementation prep foundation: coverage_rows=${coverageRows.length}, statuses=${JSON.stringify(statusCounts)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
