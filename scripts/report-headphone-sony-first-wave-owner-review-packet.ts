import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type StrictContract = {
  category: string;
  lane: string;
  metrics: {
    allowedRows: number;
    allowedSkus: number;
    excludedRows: number;
    maxFutureWriteCap: number;
  };
  allowedSkus: string[];
  explicitlyDeferredSkus: string[];
  requiredGateBeforeAnyFutureWrite: string[];
  allowedRows: Array<{
    pid: number;
    title: string;
    price: number;
    skuId: string;
    comparableKey: string;
    saleStatus: string;
    laneRisk: string;
    extraReviewFlags: string[];
    runtimeListingType: string;
    runtimeSkuId: string;
    runtimeComparableKey: string;
    runtimeNeedsReview: boolean;
  }>;
  excludedRows: Array<{
    pid: number;
    title: string;
    skuId: string;
    reason: string;
  }>;
};

type SourceBackfill = {
  rows: Array<{
    skuId: string;
    brandModel: string;
    sourceTier: string;
    sourceConfidence: string;
    sourceUrl: string;
    verifiedSpec: Record<string, string>;
  }>;
};

type RankingReport = {
  entries: Array<{
    category: string;
    firstTarget: string;
    score: number;
    rankGroup: string;
    reason: string;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function compact(text: unknown, limit = 92) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const strict = await readJson<StrictContract>("headphone-first-wave-strict-write-cap-contract-latest.json");
  const source = await readJson<SourceBackfill>("headphone-sony-first-wave-source-backfill-latest.json");
  const ranking = await readJson<RankingReport>("next-acquisition-readiness-ranking-latest.json");
  const rankingEntry = ranking.entries.find((entry) => entry.category === strict.category);
  const coveredSkus = new Set(source.rows.filter((row) => row.sourceConfidence === "high").map((row) => row.skuId));
  const missingSourceSkus = strict.allowedSkus.filter((sku) => !coveredSkus.has(sku));
  const newOrUnopenedRows = strict.allowedRows.filter((row) => row.extraReviewFlags.includes("new_or_unopened_condition"));

  const packet = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "headphone_sony_first_wave_owner_review_packet",
    category: strict.category,
    target: strict.allowedSkus.join(", "),
    sourceReports: [
      "headphone-first-wave-strict-write-cap-contract-latest.json",
      "headphone-first-wave-fresh-detail-rehearsal-latest.json",
      "headphone-sony-first-wave-source-backfill-latest.json",
      "headphone-matched-sku-evidence-matrix-latest.json",
      "next-acquisition-readiness-ranking-latest.json",
    ],
    metrics: {
      rankScore: rankingEntry?.score ?? null,
      rankGroup: rankingEntry?.rankGroup ?? null,
      allowedRows: strict.metrics.allowedRows,
      allowedSkus: strict.metrics.allowedSkus,
      excludedRows: strict.metrics.excludedRows,
      maxFutureWriteCap: strict.metrics.maxFutureWriteCap,
      sourceCoveredSkus: coveredSkus.size,
      missingSourceSkus,
      newOrUnopenedRows: newOrUnopenedRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      dbMutationRows: 0,
    },
    ownerDecision: {
      recommendedDecision: missingSourceSkus.length === 0
        ? "approve_no_write_or_internal_only_review_after_p0_stability"
        : "hold_execution_and_backfill_missing_source_evidence",
      notApprovedHere: [
        "public candidate pack promotion",
        "candidate pool wiring",
        "runtime catalog apply",
        "DB acquisition executor",
        "schema or migration changes",
      ],
      reviewPrerequisites: [
        ...strict.requiredGateBeforeAnyFutureWrite,
        "source_evidence_for_all_allowed_skus",
        "deferred_bose_qc45_key_normalization_before_bose_rows",
      ],
    },
    sourceEvidenceStatus: {
      rows: source.rows,
      missingSourceSkus,
    },
    riskNotes: [
      "Allowed scope is only Sony WH-1000XM4 and WH-CH520.",
      "Bose QC45, XM5/XM3/XM6, CH720N, QC Ultra, Sennheiser, and Beats remain deferred.",
      "Fresh detail already rejected 5/12 rows, so same SKU/key after detail is mandatory.",
      "Accessory-only, cable/pad/parts, counterfeit/compatible, buying/trade, damaged rows stay hard excluded.",
    ],
    allowedRows: strict.allowedRows,
    excludedRows: strict.excludedRows,
    conclusion: missingSourceSkus.length === 0
      ? "headphone_sony_first_wave_owner_review_packet_ready_report_only_no_execution"
      : "headphone_sony_first_wave_owner_review_packet_source_backfill_required",
    nextStep: missingSourceSkus.length === 0
      ? "Create execution readiness checklist; keep dormant until P0 stability and owner approval."
      : "Backfill missing source evidence before any executor.",
  };

  const jsonPath = path.join(reportsDir, "headphone-sony-first-wave-owner-review-packet-latest.json");
  const mdPath = path.join(reportsDir, "headphone-sony-first-wave-owner-review-packet-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

  const md = [
    "# Headphone Sony First Wave Owner Review Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${packet.conclusion}`,
    "",
    "## Target",
    "",
    `- category: ${packet.category}`,
    `- target: ${packet.target}`,
    `- recommendedDecision: ${packet.ownerDecision.recommendedDecision}`,
    "",
    "## Metrics",
    "",
    `- rankScore: ${packet.metrics.rankScore ?? "-"}`,
    `- rankGroup: ${packet.metrics.rankGroup ?? "-"}`,
    `- allowedRows: ${packet.metrics.allowedRows}`,
    `- allowedSkus: ${packet.metrics.allowedSkus}`,
    `- maxFutureWriteCap: ${packet.metrics.maxFutureWriteCap}`,
    `- sourceCoveredSkus: ${packet.metrics.sourceCoveredSkus}`,
    `- missingSourceSkus: ${packet.metrics.missingSourceSkus.join(", ") || "none"}`,
    `- newOrUnopenedRows: ${packet.metrics.newOrUnopenedRows}`,
    "",
    "## Not Approved Here",
    "",
    ...packet.ownerDecision.notApprovedHere.map((item) => `- ${item}`),
    "",
    "## Review Prerequisites",
    "",
    ...packet.ownerDecision.reviewPrerequisites.map((item) => `- ${item}`),
    "",
    "## Source Evidence",
    "",
    mdTable(
      ["skuId", "brandModel", "tier", "confidence", "source"],
      packet.sourceEvidenceStatus.rows.map((row) => [
        row.skuId,
        row.brandModel,
        row.sourceTier,
        row.sourceConfidence,
        row.sourceUrl,
      ]),
    ),
    "",
    "## Risk Notes",
    "",
    ...packet.riskNotes.map((item) => `- ${item}`),
    "",
    "## Allowed Rows",
    "",
    mdTable(
      ["pid", "title", "price", "skuId", "key", "status", "flags"],
      packet.allowedRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId,
        row.comparableKey,
        row.saleStatus,
        row.extraReviewFlags.join(", "),
      ]),
    ),
    "",
    "## Excluded Rows",
    "",
    mdTable(
      ["pid", "title", "skuId", "reason"],
      packet.excludedRows.map((row) => [row.pid, compact(row.title), row.skuId, row.reason]),
    ),
    "",
    "## Next Step",
    "",
    `- ${packet.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: packet.conclusion,
    allowedRows: packet.metrics.allowedRows,
    missingSourceSkus,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
